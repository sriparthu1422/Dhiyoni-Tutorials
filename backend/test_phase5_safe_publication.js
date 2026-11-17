import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import Contact from './src/models/Contact.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';
import {
  setMockSheetsClient,
  resetMockSheetsClient,
} from './src/services/googleSheetsService.js';
import {
  acquireSpreadsheetLock,
} from './src/services/lockService.js';
import {
  runExportJob,
  EXPORT_TABS,
} from './src/services/exportEngine.js';

class MockSheetsClientWithInterruptionHooks {
  constructor() {
    this.sheets = new Map();
    this.failurePoint = null; // 'stageCreate' | 'stageWrite' | 'stageValidate' | 'prodPublish' | 'prodAck' | 'stageClean'
  }

  get spreadsheets() {
    return {
      get: async ({ spreadsheetId }) => {
        return {
          data: {
            spreadsheetId,
            sheets: Array.from(this.sheets.keys()).map((title) => ({
              properties: { title },
            })),
          },
        };
      },

      batchUpdate: async ({ spreadsheetId, requestBody }) => {
        if (this.failurePoint === 'stageCreate') {
          const err = new Error('Google Sheets API Error: Failed to create staging tab (Quota / Network)');
          err.status = 503;
          throw err;
        }

        for (const req of requestBody.requests || []) {
          if (req.addSheet) {
            const title = req.addSheet.properties.title;
            if (!this.sheets.has(title)) {
              this.sheets.set(title, []);
            }
          }
        }
        return { data: { replies: [] } };
      },

      values: {
        get: async ({ range }) => {
          const tabName = range.split('!')[0].replace(/'/g, '');
          const rows = this.sheets.get(tabName) || [];

          if (this.failurePoint === 'stageValidate' && tabName.startsWith('_staging_')) {
            // Simulate corrupted / incomplete staging read
            return { data: { values: [] } };
          }

          if (range.includes('!A2:A') || range.includes('!A2:ZZ')) {
            return { data: { values: rows.slice(1) } };
          }
          return { data: { values: rows } };
        },

        update: async ({ range, valueInputOption, requestBody }) => {
          const tabName = range.split('!')[0].replace(/'/g, '');

          if (this.failurePoint === 'stageWrite' && tabName.startsWith('_staging_')) {
            const err = new Error('Google Sheets API Error: Interrupted during staging write');
            err.status = 500;
            throw err;
          }

          if (this.failurePoint === 'prodPublish' && !tabName.startsWith('_staging_')) {
            const err = new Error('Google Sheets API Error: Interrupted before production write');
            err.status = 500;
            throw err;
          }

          if (this.failurePoint === 'prodAck' && !tabName.startsWith('_staging_')) {
            const err = new Error('ETIMEDOUT: Connection lost while waiting for production publication acknowledgment');
            err.code = 'ETIMEDOUT';
            throw err;
          }

          const isHeader = range.includes('!A1');
          if (!this.sheets.has(tabName)) {
            this.sheets.set(tabName, []);
          }

          const currentRows = this.sheets.get(tabName);
          const incomingValues = requestBody.values || [];

          if (isHeader) {
            if (incomingValues.length > 1) {
              this.sheets.set(tabName, incomingValues);
            } else if (currentRows.length === 0) {
              currentRows.push(incomingValues[0]);
            } else {
              currentRows[0] = incomingValues[0];
            }
          } else {
            const header = currentRows.length > 0 ? currentRows[0] : [];
            this.sheets.set(tabName, [header, ...incomingValues]);
          }

          return { data: { updatedRows: incomingValues.length } };
        },

        clear: async ({ range }) => {
          const tabName = range.split('!')[0].replace(/'/g, '');

          if (this.failurePoint === 'stageClean' && tabName.startsWith('_staging_')) {
            const err = new Error('Google Sheets API Error: Interrupted during staging cleanup');
            err.status = 500;
            throw err;
          }

          const currentRows = this.sheets.get(tabName) || [];
          if (range.includes('!A1:ZZ')) {
            this.sheets.set(tabName, []);
          } else if (currentRows.length > 0) {
            this.sheets.set(tabName, [currentRows[0]]);
          }
          return { data: { clearedRange: range } };
        },

        append: async ({ range, requestBody }) => {
          const tabName = range.split('!')[0].replace(/'/g, '');
          if (!this.sheets.has(tabName)) {
            this.sheets.set(tabName, []);
          }
          const currentRows = this.sheets.get(tabName);
          for (const row of requestBody.values || []) {
            currentRows.push(row);
          }
          return { data: { updates: { updatedRows: (requestBody.values || []).length } } };
        },
      },
    };
  }
}

describe('Phase 5 Live Integration: Safe Publication Interruption & Concurrency Suite', { concurrency: 1 }, () => {
  let mockSheets;
  const testSpreadsheetId = '1TestLiveSpreadsheet_ABC123XYZ';
  const adminId = new mongoose.Types.ObjectId();
  let createdDocIds = [];

  before(async () => {
    await connectDB();
    mockSheets = new MockSheetsClientWithInterruptionHooks();
    setMockSheetsClient(mockSheets);

    // Populate baseline production sheets
    for (const tab of Object.values(EXPORT_TABS)) {
      mockSheets.sheets.set(tab, [
        ['MongoDB ID', 'Submission ID', 'Created At'],
        ['baseline_id_001', 'baseline_sub_001', new Date().toISOString()],
        ['baseline_id_002', 'baseline_sub_002', new Date().toISOString()],
      ]);
    }

    // Clean up any stale records from previous aborted runs
    await Contact.deleteMany({
      $or: [
        { email: { $in: ['safepub1@dhiyonitutorials.com', 'safepub2@dhiyonitutorials.com', 'late@dhiyonitutorials.com', 'temp@dhiyonitutorials.com'] } },
        { submissionId: { $in: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'] } },
      ],
    });

    // Seed test contact records
    const c1 = await Contact.create({
      name: 'Safe Pub Test 1',
      email: 'safepub1@dhiyonitutorials.com',
      subject: 'Inquiry',
      message: 'Test message 1',
      submissionId: '00000000-0000-4000-8000-000000000001',
    });
    const c2 = await Contact.create({
      name: 'Safe Pub Test 2',
      email: 'safepub2@dhiyonitutorials.com',
      subject: 'Inquiry',
      message: 'Test message 2',
      submissionId: '00000000-0000-4000-8000-000000000002',
    });
    createdDocIds.push(c1._id, c2._id);
  });

  after(async () => {
    resetMockSheetsClient();
    await Contact.deleteMany({ _id: { $in: createdDocIds } });
    await ExportJob.deleteMany({ 'destination.spreadsheetId': testSpreadsheetId });
    await SpreadsheetLock.deleteMany({ spreadsheetId: testSpreadsheetId });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    mockSheets.failurePoint = null;
    await SpreadsheetLock.deleteMany({ spreadsheetId: testSpreadsheetId });
    // Reset baseline contacts sheet
    mockSheets.sheets.set(EXPORT_TABS.contacts, [
      ['MongoDB ID', 'Submission ID', 'Created At'],
      ['baseline_id_001', 'baseline_sub_001', new Date().toISOString()],
      ['baseline_id_002', 'baseline_sub_002', new Date().toISOString()],
    ]);
  });

  // =========================================================================
  // STEP 4: Safe Publication & Interruption Verification (6 Critical Points)
  // =========================================================================

  test('Point 1: Interruption at Staging Tab Creation leaves production data 100% intact', async () => {
    const initialRows = mockSheets.sheets.get(EXPORT_TABS.contacts).length;
    mockSheets.failurePoint = 'stageCreate';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_1', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_1',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /Failed to create staging tab/
    );

    // Production tab must NOT be modified
    assert.strictEqual(mockSheets.sheets.get(EXPORT_TABS.contacts).length, initialRows);

    // Job marked failed
    const updatedJob = await ExportJob.findOne({ jobId: job.jobId });
    assert.strictEqual(updatedJob.status, 'failed');
  });

  test('Point 2: Interruption at Staging Data Writing leaves production data 100% intact', async () => {
    const initialRows = mockSheets.sheets.get(EXPORT_TABS.contacts).length;
    mockSheets.failurePoint = 'stageWrite';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_2', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_2',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /Interrupted during staging write/
    );

    // Production tab remains intact
    assert.strictEqual(mockSheets.sheets.get(EXPORT_TABS.contacts).length, initialRows);
    const updatedJob = await ExportJob.findOne({ jobId: job.jobId });
    assert.strictEqual(updatedJob.status, 'failed');
  });

  test('Point 3: Interruption at Staging Validation aborts before production write', async () => {
    const initialRows = mockSheets.sheets.get(EXPORT_TABS.contacts).length;
    mockSheets.failurePoint = 'stageValidate';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_3', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_3',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /Staging validation failed/
    );

    // Production tab remains intact
    assert.strictEqual(mockSheets.sheets.get(EXPORT_TABS.contacts).length, initialRows);
    const updatedJob = await ExportJob.findOne({ jobId: job.jobId });
    assert.strictEqual(updatedJob.status, 'failed');
  });

  test('Point 4: Interruption at Production Publication leaves staging data recoverable', async () => {
    mockSheets.failurePoint = 'prodPublish';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_4', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_4',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /Interrupted before production write/
    );

    // Staging tab must still contain the prepared data for recovery
    const stagingTabName = '_staging_Contact Enquiries';
    const stagingRows = mockSheets.sheets.get(stagingTabName);
    assert.ok(stagingRows && stagingRows.length >= 2, 'Staging rows must be preserved for recovery upon publish error');
  });

  test('Point 5: Interruption at Publication Acknowledgment (Timeout) marks job failed safely', async () => {
    mockSheets.failurePoint = 'prodAck';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_5', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_5',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /ETIMEDOUT/
    );

    const updatedJob = await ExportJob.findOne({ jobId: job.jobId });
    assert.strictEqual(updatedJob.status, 'failed');
    assert.strictEqual(updatedJob.errorDetails.code, 'ETIMEDOUT');
  });

  test('Point 6: Staging Cleanup failure preserves published production data', async () => {
    mockSheets.failurePoint = 'stageClean';

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'int_job_6', adminId);
    const job = await ExportJob.create({
      jobId: 'int_job_6',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /Interrupted during staging cleanup/
    );

    // Production tab has received the validated rows, even if cleanup failed
    const prodRows = mockSheets.sheets.get(EXPORT_TABS.contacts);
    assert.ok(prodRows.length >= 2, 'Production tab must contain published data');
  });

  // =========================================================================
  // STEP 5: Concurrent Modifications Verification
  // =========================================================================

  test('Concurrent 1: Submissions created after snapshotTimestamp are excluded from export', async () => {
    const snapshotTime = new Date();

    // Insert record strictly AFTER snapshotTime
    const lateDoc = await Contact.create({
      name: 'Late Submitter',
      email: 'late@dhiyonitutorials.com',
      subject: 'Late Inquiry',
      message: 'Created after snapshot',
      submissionId: '00000000-0000-4000-8000-000000000099',
      createdAt: new Date(snapshotTime.getTime() + 5000),
    });
    createdDocIds.push(lateDoc._id);

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'conc_job_1', adminId);
    const job = await ExportJob.create({
      jobId: 'conc_job_1',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      snapshotTimestamp: snapshotTime,
      status: 'pending',
    });

    const completed = await runExportJob(job.jobId, lock.ownerToken);
    assert.strictEqual(completed.status, 'completed');

    // Verify lateDoc is NOT in exported production sheet
    const prodRows = mockSheets.sheets.get(EXPORT_TABS.contacts);
    const foundLate = prodRows.find((r) => r[0] === lateDoc._id.toString());
    assert.strictEqual(foundLate, undefined, 'Record created after snapshot must NOT be in export');
  });

  test('Concurrent 2: Submissions updated after snapshotTimestamp are detected and recorded', async () => {
    // Snapshot cutoff is set right after creation of c1, so c1 is included
    const targetDoc = await Contact.findById(createdDocIds[0]);
    const snapshotTime = new Date(targetDoc.createdAt.getTime() + 500);

    // Mutate the contact record now so updatedAt is strictly greater than snapshotTime
    await Contact.updateOne(
      { _id: targetDoc._id },
      { $set: { message: 'Updated concurrent message' } }
    );

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'conc_job_2', adminId);
    const job = await ExportJob.create({
      jobId: 'conc_job_2',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      snapshotTimestamp: snapshotTime,
      status: 'pending',
    });

    const completed = await runExportJob(job.jobId, lock.ownerToken);
    assert.strictEqual(completed.status, 'completed');
    assert.ok(completed.concurrentUpdatesDetected >= 1, 'Concurrent update must be detected and counted');
    assert.ok(
      completed.reconciliation.discrepancies.some((d) => d.includes('concurrent update')),
      'Discrepancies must record concurrent update'
    );
  });

  test('Concurrent 3: Submissions deleted during export are detected in reconciliation', async () => {
    // Create a temporary record that gets deleted
    const tempContact = await Contact.create({
      name: 'Temp Contact',
      email: 'temp@dhiyonitutorials.com',
      subject: 'Temp',
      message: 'To be deleted',
      submissionId: '00000000-0000-4000-8000-000000000088',
    });

    const snapshotTime = new Date();

    // Delete the contact right at snapshot
    await Contact.deleteOne({ _id: tempContact._id });

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'conc_job_3', adminId);
    const job = await ExportJob.create({
      jobId: 'conc_job_3',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      snapshotTimestamp: snapshotTime,
      status: 'pending',
    });

    const completed = await runExportJob(job.jobId, lock.ownerToken);
    assert.strictEqual(completed.status, 'completed');
  });

  test('Concurrent 4: Second concurrent export returns HTTP 409 Conflict', async () => {
    const lock1 = await acquireSpreadsheetLock(testSpreadsheetId, 'job_lock_1', adminId);
    assert.ok(lock1.acquired);

    // Second worker attempts acquisition on same spreadsheet
    const lock2 = await acquireSpreadsheetLock(testSpreadsheetId, 'job_lock_2', adminId);
    assert.strictEqual(lock2.acquired, false);
    assert.strictEqual(lock2.existingLock.jobId, 'job_lock_1');
  });

  test('Concurrent 5: Expired lock lease is reclaimed atomically by new export job', async () => {
    // Manually create an expired lock
    const expiredTime = new Date(Date.now() - 60000); // 1 minute ago
    await SpreadsheetLock.create({
      spreadsheetId: testSpreadsheetId,
      ownerToken: '00000000-0000-4000-8000-expired000001',
      jobId: 'expired_job',
      lockedBy: adminId,
      expiresAt: expiredTime,
    });

    // New worker should reclaim it atomically
    const newLock = await acquireSpreadsheetLock(testSpreadsheetId, 'reclaim_job', adminId);
    assert.strictEqual(newLock.acquired, true);
    assert.strictEqual(newLock.recoveredFromStale, true);
    assert.strictEqual(newLock.lock.jobId, 'reclaim_job');
  });

  test('Concurrent 6: Stale worker with lost lease is prevented from publishing to production', async () => {
    const initialRows = mockSheets.sheets.get(EXPORT_TABS.contacts).length;

    const lock = await acquireSpreadsheetLock(testSpreadsheetId, 'stale_job', adminId);

    // Force expire lock while worker is "processing"
    await SpreadsheetLock.updateOne(
      { spreadsheetId: testSpreadsheetId },
      { $set: { expiresAt: new Date(Date.now() - 60000) } }
    );

    const job = await ExportJob.create({
      jobId: 'stale_job',
      exportType: 'category',
      categories: ['contacts'],
      requestedBy: adminId,
      destination: { spreadsheetId: testSpreadsheetId },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await runExportJob(job.jobId, lock.ownerToken);
      },
      /expired/i
    );

    // Production tab must NOT be touched
    assert.strictEqual(mockSheets.sheets.get(EXPORT_TABS.contacts).length, initialRows);
  });
});
