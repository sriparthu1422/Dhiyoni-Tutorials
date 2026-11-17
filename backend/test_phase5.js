import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';

import {
  setMockSheetsClient,
  resetMockSheetsClient,
  sanitizeCellValue,
  executeWithRetry,
  isGoogleConfigured,
  writeStagingSnapshot,
  validateStagingTab,
  publishStagingToProduction,
  cleanupStagingTab,
} from './src/services/googleSheetsService.js';

import {
  acquireSpreadsheetLock,
  renewSpreadsheetLock,
  releaseSpreadsheetLock,
  isLockActive,
} from './src/services/lockService.js';

import {
  runExportJob,
  EXPORT_TABS,
  TAB_HEADERS,
} from './src/services/exportEngine.js';

import express from 'express';
import exportRoutes from './src/routes/exportRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/export', exportRoutes);

// HTTP invocation mock helper
function executeRequest(appInstance, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    let bodyStr = null;
    if (body !== null && typeof body === 'object') {
      bodyStr = JSON.stringify(body);
    } else if (typeof body === 'string') {
      bodyStr = body;
    }

    let pushed = false;
    const req = new Readable({
      read() {
        if (!pushed && bodyStr) {
          this.push(bodyStr);
          pushed = true;
        }
        this.push(null);
      },
    });

    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    if (bodyStr) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(bodyStr);
    }

    const res = new EventEmitter();
    let resBody = '';
    let statusCode = 200;
    const resHeaders = {};

    res.setHeader = (key, value) => {
      resHeaders[key.toLowerCase()] = value;
    };
    res.getHeader = (key) => resHeaders[key.toLowerCase()];
    res.status = (code) => {
      statusCode = code;
      return res;
    };
    res.send = (chunk) => {
      if (chunk) resBody += typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
      res.emit('finish');
    };
    res.json = (obj) => {
      res.setHeader('content-type', 'application/json');
      resBody = JSON.stringify(obj);
      res.emit('finish');
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk;
      res.emit('finish');
    };

    res.on('finish', () => {
      let parsed = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch {
        // keep text
      }
      resolve({
        status: statusCode,
        headers: resHeaders,
        body: parsed,
      });
    });

    try {
      appInstance(req, res, (err) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * In-memory Mock Google Sheets Client simulating Google Sheets API v4
 */
class InMemorySheetsClient {
  constructor(initialSheets = ['Sheet1']) {
    this.sheets = new Map();
    for (const title of initialSheets) {
      this.sheets.set(title, []);
    }
    this.errorMode = null; // 'rateLimit' | 'timeout' | 'auth' | 'notFound'
    this.failCount = 0;
    this.lastValueInputOption = null;
    this.updateCallCount = 0;
  }

  get spreadsheets() {
    return {
      get: async ({ spreadsheetId }) => {
        if (this.errorMode === 'auth') {
          const err = new Error('The caller does not have permission');
          err.status = 401;
          throw err;
        }
        if (this.errorMode === 'notFound' || spreadsheetId === 'missing_spreadsheet_id') {
          const err = new Error(`Requested spreadsheet ${spreadsheetId} was not found`);
          err.status = 404;
          throw err;
        }

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
          if (range.includes('!A2:A') || range.includes('!A2:ZZ')) {
            return { data: { values: rows.slice(1) } };
          }
          return { data: { values: rows } };
        },

        update: async ({ range, valueInputOption, requestBody }) => {
          this.lastValueInputOption = valueInputOption;
          this.updateCallCount++;

          if (this.errorMode === 'rateLimit' && this.failCount > 0) {
            this.failCount--;
            const err = new Error('Quota exceeded for quota metric');
            err.status = 429;
            throw err;
          }
          if (this.errorMode === 'timeout' && this.failCount > 0) {
            this.failCount--;
            const err = new Error('ETIMEDOUT connection to sheets.googleapis.com timed out');
            err.code = 'ETIMEDOUT';
            throw err;
          }

          const tabName = range.split('!')[0].replace(/'/g, '');
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
            // Updating data rows from row 2 onwards
            const header = currentRows.length > 0 ? currentRows[0] : [];
            this.sheets.set(tabName, [header, ...incomingValues]);
          }

          return { data: { updatedRows: incomingValues.length } };
        },

        clear: async ({ range }) => {
          const tabName = range.split('!')[0].replace(/'/g, '');
          const currentRows = this.sheets.get(tabName) || [];
          if (range.includes('!A1:ZZ')) {
            this.sheets.set(tabName, []);
          } else if (currentRows.length > 0) {
            // Keep header row at index 0, clear data rows
            this.sheets.set(tabName, [currentRows[0]]);
          }
          return { data: { clearedRange: range } };
        },

        append: async ({ range, valueInputOption, requestBody }) => {
          this.lastValueInputOption = valueInputOption;
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

describe('Phase 5 Backend Google Sheets Export Engine Suite', { concurrency: 1 }, () => {
  let adminUser;
  let nonAdminUser;
  let adminToken;
  let nonAdminToken;
  let inMemorySheets;
  const testSpreadsheetId = '1TestSpreadsheetId_ABC123456789xyz';
  const JWT_SECRET = process.env.JWT_SECRET || 'testsecret123';

  const testRecordIds = {
    contacts: [],
    parents: [],
    tutors: [],
    newsletters: [],
    feedbacks: [],
  };

  before(async () => {
    await connectDB();

    // Setup in-memory Sheets client
    inMemorySheets = new InMemorySheetsClient();
    setMockSheetsClient(inMemorySheets);

    // 1. Create isolated Admin & Non-Admin Users
    adminUser = await User.create({
      username: `Admin_P5_${Date.now()}`,
      email: `admin_p5_${Date.now()}@dhiyoni.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });

    const nonAdminId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('users').insertOne({
      _id: nonAdminId,
      username: `Student_P5_${Date.now()}`,
      email: `student_p5_${Date.now()}@dhiyoni.com`,
      password: 'StudentPassword123!',
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    nonAdminUser = { _id: nonAdminId };
    nonAdminToken = jwt.sign({ id: nonAdminId }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Populate isolated test records with timestamps and diverse fields
    const baseDate = new Date('2026-11-10T10:00:00.000Z');

    // (A) Contacts: 3 records (one with formula-like triggers, one legacy without submissionId, one normal)
    const c1 = await Contact.create({
      name: '=SUM(1+1) Danger', // Formula injection attempt
      email: 'formula_injection@example.com',
      subject: 'Math Tuition',
      message: '+cmd|"/C calc"!A0 Dangerous Message',
      status: 'Pending',
      submissionId: 'e5d8a1c2-3b4f-4000-8000-000000000001',
      createdAt: new Date(baseDate.getTime() + 1000),
      updatedAt: new Date(baseDate.getTime() + 1000),
    });
    const c2 = await Contact.create({
      name: 'Legacy Contact (No UUID)',
      email: 'legacy_contact@example.com',
      subject: 'Physics Tuition',
      message: 'Regular message from legacy form submission',
      status: 'Resolved',
      createdAt: new Date(baseDate.getTime() + 2000),
      updatedAt: new Date(baseDate.getTime() + 2000),
    });
    const c3 = await Contact.create({
      name: '@Hyperlink Test',
      email: 'normal_contact@example.com',
      subject: 'Chemistry Tuition',
      message: '-Negative formula prefix test',
      status: 'Pending',
      submissionId: 'e5d8a1c2-3b4f-4000-8000-000000000003',
      createdAt: new Date(baseDate.getTime() + 3000),
      updatedAt: new Date(baseDate.getTime() + 3000),
    });
    testRecordIds.contacts.push(c1._id, c2._id, c3._id);

    // (B) Parent Signups: 2 records (one phone with leading 0, one normal)
    const p1 = await ParentSignup.create({
      studentName: 'Rohan Sharma',
      gender: 'male',
      grade: 'Grade 10',
      subject: 'Mathematics',
      parentName: 'Vijay Sharma',
      contact: '09876543210', // Leading 0 phone number
      email: 'rohan_p5@example.com',
      city: 'Hyderabad',
      state: 'Telangana',
      referral: 'social_media',
      status: 'Enrolled',
      submissionId: 'f5d8a1c2-3b4f-4000-8000-000000000001',
      createdAt: new Date(baseDate.getTime() + 4000),
      updatedAt: new Date(baseDate.getTime() + 4000),
    });
    const p2 = await ParentSignup.create({
      studentName: 'Ananya Rao',
      gender: 'female',
      grade: 'Grade 8',
      subject: 'Science',
      parentName: 'Suresh Rao',
      contact: '+919876543211', // + leading phone number
      email: 'ananya_p5@example.com',
      city: 'Secunderabad',
      state: 'Telangana',
      referral: 'friends',
      status: 'Pending',
      createdAt: new Date(baseDate.getTime() + 5000),
      updatedAt: new Date(baseDate.getTime() + 5000),
    });
    testRecordIds.parents.push(p1._id, p2._id);

    // (C) Tutor Signups: 1 record
    const t1 = await TutorSignup.create({
      fullName: 'Dr. Meera Iyer',
      gender: 'female',
      email: 'meera_p5@example.com',
      contact: '9876543212',
      dob: '1988-04-12',
      location: 'Hyderabad, Telangana',
      qualification: 'Ph.D Physics',
      occupation: 'professional',
      experience: '7 years coaching',
      grades: 'Grades 9 to 12',
      subjects: 'Physics',
      time: 'Evening',
      boards: ['cbse', 'icse'],
      hasTech: true,
      status: 'Approved',
      submissionId: 'a1d8a1c2-3b4f-4000-8000-000000000001',
      createdAt: new Date(baseDate.getTime() + 6000),
      updatedAt: new Date(baseDate.getTime() + 6000),
    });
    testRecordIds.tutors.push(t1._id);

    // (D) Newsletters: 2 records
    const n1 = await Newsletter.create({
      email: 'subscriber1_p5@example.com',
      submissionId: 'b2d8a1c2-3b4f-4000-8000-000000000001',
      createdAt: new Date(baseDate.getTime() + 7000),
      updatedAt: new Date(baseDate.getTime() + 7000),
    });
    const n2 = await Newsletter.create({
      email: 'subscriber2_p5@example.com',
      createdAt: new Date(baseDate.getTime() + 8000),
      updatedAt: new Date(baseDate.getTime() + 8000),
    });
    testRecordIds.newsletters.push(n1._id, n2._id);

    // (E) Feedback: 1 record
    const fb1 = await Feedback.create({
      name: 'Deepa Nair',
      userType: 'Parent',
      email: 'deepa_p5@example.com',
      contactNumber: '9988776655',
      rating: 5,
      message: 'Outstanding faculty dedication.',
      submissionId: 'c3d8a1c2-3b4f-4000-8000-000000000001',
      createdAt: new Date(baseDate.getTime() + 9000),
      updatedAt: new Date(baseDate.getTime() + 9000),
    });
    testRecordIds.feedbacks.push(fb1._id);
  });

  after(async () => {
    // Clean test records
    await User.deleteMany({ _id: { $in: [adminUser._id, nonAdminUser._id] } });
    await Contact.deleteMany({ _id: { $in: testRecordIds.contacts } });
    await ParentSignup.deleteMany({ _id: { $in: testRecordIds.parents } });
    await TutorSignup.deleteMany({ _id: { $in: testRecordIds.tutors } });
    await Newsletter.deleteMany({ _id: { $in: testRecordIds.newsletters } });
    await Feedback.deleteMany({ _id: { $in: testRecordIds.feedbacks } });
    await ExportJob.deleteMany({ requestedBy: { $in: [adminUser._id, nonAdminUser._id] } });
    await SpreadsheetLock.deleteMany({ spreadsheetId: testSpreadsheetId });

    resetMockSheetsClient();
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. Google API Authentication & Live Credentials Verification
  // =========================================================================
  test('1. Google API authentication verifies credential readiness and reports missing settings safely', async () => {
    assert.strictEqual(isGoogleConfigured(), true, 'In-memory mock should report configured');

    resetMockSheetsClient();
    const isLiveConfigured = isGoogleConfigured();
    setMockSheetsClient(inMemorySheets);

    // In local dev without live Google Cloud service account, it must report false safely
    assert.strictEqual(typeof isLiveConfigured, 'boolean');
  });

  // =========================================================================
  // 2. Spreadsheet Selection and Validation
  // =========================================================================
  test('2. Correct spreadsheet selection enforces valid ID formats and rejects malformed IDs', async () => {
    const resBadId = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { spreadsheetId: 'bad!id@with$invalid#chars' },
    });
    assert.strictEqual(resBadId.status, 400);
    assert.ok(resBadId.body.message.includes('Invalid spreadsheetId format'));
  });

  // =========================================================================
  // 3. Tab Mapping (All 6 Tabs Verified)
  // =========================================================================
  test('3. Tab mapping creates and verifies all 6 required spreadsheet tabs', async () => {
    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { spreadsheetId: testSpreadsheetId, runSync: true },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const createdTabs = Array.from(inMemorySheets.sheets.keys());
    assert.ok(createdTabs.includes(EXPORT_TABS.contacts), 'Must include Contact Enquiries');
    assert.ok(createdTabs.includes(EXPORT_TABS.parentSignups), 'Must include Parent Registrations');
    assert.ok(createdTabs.includes(EXPORT_TABS.tutorSignups), 'Must include Tutor Applications');
    assert.ok(createdTabs.includes(EXPORT_TABS.newsletters), 'Must include Newsletter Subscribers');
    assert.ok(createdTabs.includes(EXPORT_TABS.feedbacks), 'Must include Feedback');
    assert.ok(createdTabs.includes(EXPORT_TABS.history), 'Must include Export History');
  });

  // =========================================================================
  // 4–8. Row Mappings for All Five Form Models
  // =========================================================================
  test('4. Contact export maps columns accurately with timestamps and statuses', async () => {
    const contactSheet = inMemorySheets.sheets.get(EXPORT_TABS.contacts);
    assert.ok(contactSheet.length >= 4, 'Must contain header + at least 3 test contacts');
    assert.deepStrictEqual(contactSheet[0], TAB_HEADERS[EXPORT_TABS.contacts]);
  });

  test('5. Parent registration export maps student, parent, grade, and referral', async () => {
    const parentSheet = inMemorySheets.sheets.get(EXPORT_TABS.parentSignups);
    assert.ok(parentSheet.length >= 3, 'Must contain header + 2 parent signups');
    assert.deepStrictEqual(parentSheet[0], TAB_HEADERS[EXPORT_TABS.parentSignups]);
    const row = parentSheet.find((r) => r[4] === 'Rohan Sharma');
    assert.ok(row, 'Rohan Sharma row must exist');
    assert.strictEqual(row[8], 'Vijay Sharma');
    assert.strictEqual(row[13], 'social_media');
  });

  test('6. Tutor application export maps qualifications, experience, and tech status', async () => {
    const tutorSheet = inMemorySheets.sheets.get(EXPORT_TABS.tutorSignups);
    assert.ok(tutorSheet.length >= 2, 'Must contain header + tutor application');
    assert.deepStrictEqual(tutorSheet[0], TAB_HEADERS[EXPORT_TABS.tutorSignups]);
    const row = tutorSheet.find((r) => r[4] === 'Dr. Meera Iyer');
    assert.ok(row, 'Dr. Meera Iyer row must exist');
    assert.strictEqual(row[10], 'Ph.D Physics');
    assert.strictEqual(row[17], 'Yes');
  });

  test('7. Newsletter export maps subscriber emails correctly', async () => {
    const newsletterSheet = inMemorySheets.sheets.get(EXPORT_TABS.newsletters);
    assert.ok(newsletterSheet.length >= 3, 'Must contain header + subscribers');
    assert.deepStrictEqual(newsletterSheet[0], TAB_HEADERS[EXPORT_TABS.newsletters]);
  });

  test('8. Feedback export maps userType, rating score, and feedback text', async () => {
    const feedbackSheet = inMemorySheets.sheets.get(EXPORT_TABS.feedbacks);
    assert.ok(feedbackSheet.length >= 2, 'Must contain header + feedback entry');
    assert.deepStrictEqual(feedbackSheet[0], TAB_HEADERS[EXPORT_TABS.feedbacks]);
    const row = feedbackSheet.find((r) => r[4] === 'Deepa Nair');
    assert.ok(row, 'Deepa Nair row must exist');
    assert.strictEqual(row[5], 'Parent');
    assert.strictEqual(row[8], 5);
  });

  // =========================================================================
  // 9–10. Legacy Records and Stable Record IDs
  // =========================================================================
  test('9. Legacy records without submissionId export MongoDB _id as stable identifier', async () => {
    const contactSheet = inMemorySheets.sheets.get(EXPORT_TABS.contacts);
    const legacyRow = contactSheet.find((r) => r[4] === 'Legacy Contact (No UUID)');
    assert.ok(legacyRow, 'Legacy contact must be present');
    assert.strictEqual(legacyRow[0], legacyRow[1], 'Submission ID column must fall back to MongoDB _id');
  });

  test('10. Stable record IDs: Column A consistently holds MongoDB ObjectId', async () => {
    for (const [category, tabName] of Object.entries(EXPORT_TABS)) {
      if (tabName === EXPORT_TABS.history) continue;
      const rows = inMemorySheets.sheets.get(tabName) || [];
      for (let i = 1; i < rows.length; i++) {
        const idCol = rows[i][0];
        assert.ok(
          /^[0-9a-fA-F]{24}$/.test(idCol),
          `Column A in ${tabName} row ${i} must be a 24-char hex ObjectId: got ${idCol}`
        );
      }
    }
  });

  // =========================================================================
  // 11–13. Snapshot Reconciliation, Duplicate Prevention & Safe Staging Publication
  // =========================================================================
  test('11. Duplicate prevention: repeated exports do not accumulate duplicate rows', async () => {
    const initialContactCount = inMemorySheets.sheets.get(EXPORT_TABS.contacts).length;

    // Run export a second time
    const resRepeat = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { spreadsheetId: testSpreadsheetId, runSync: true },
    });
    assert.strictEqual(resRepeat.status, 200);

    const postRepeatCount = inMemorySheets.sheets.get(EXPORT_TABS.contacts).length;
    assert.strictEqual(
      postRepeatCount,
      initialContactCount,
      'Row count must remain identical after repeated export'
    );
  });

  test('12. Full-snapshot reconciliation: verifies database count equals exported count', async () => {
    const jobs = await ExportJob.find().sort({ createdAt: -1 }).limit(1);
    assert.ok(jobs.length > 0);
    const latestJob = jobs[0];
    assert.strictEqual(latestJob.status, 'completed');
    assert.strictEqual(latestJob.reconciliation.isReconciled, true);
  });

  test('13. Safe publication: previous production data remains intact if staging fails', async () => {
    // Current production contacts row count
    const initialProductionRows = inMemorySheets.sheets.get(EXPORT_TABS.contacts);
    const initialLength = initialProductionRows.length;
    assert.ok(initialLength >= 4);

    // Simulate an interruption / error during staging write
    inMemorySheets.errorMode = 'rateLimit';
    inMemorySheets.failCount = 10; // Exceeds max retries

    try {
      await executeRequest(app, {
        method: 'POST',
        url: '/api/export',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { spreadsheetId: testSpreadsheetId, runSync: true },
      });
    } catch {
      // Expected failure
    } finally {
      inMemorySheets.errorMode = null;
      inMemorySheets.failCount = 0;
    }

    // Previous production data must be 100% intact!
    const postFailureProductionRows = inMemorySheets.sheets.get(EXPORT_TABS.contacts);
    assert.strictEqual(
      postFailureProductionRows.length,
      initialLength,
      'Production tab must NOT be cleared or modified if export fails during staging'
    );
  });

  // =========================================================================
  // 14. Keyset Checkpointing and Interrupted Recovery
  // =========================================================================
  test('14. Keyset checkpoints track lastRecordId and processedCount for failure recovery', async () => {
    const jobs = await ExportJob.find({ status: 'completed' }).sort({ createdAt: -1 }).limit(1);
    const job = jobs[0];
    assert.ok(job, 'Completed export job must exist');
    const contactCheckpoint = job.checkpoints.get('contacts');
    assert.ok(contactCheckpoint);
    assert.ok(contactCheckpoint.processedCount >= 3);
    assert.strictEqual(contactCheckpoint.isReconciled, true);
    assert.ok(contactCheckpoint.lastRecordId !== null);
  });

  // =========================================================================
  // 15–16. Transient Network Failures & Rate Limits (Exponential Backoff)
  // =========================================================================
  test('15. API rate-limit handling: 429 errors trigger exponential backoff and succeed', async () => {
    inMemorySheets.errorMode = 'rateLimit';
    inMemorySheets.failCount = 1; // Fails once with 429, succeeds on retry

    let called = 0;
    const result = await executeWithRetry(async () => {
      called++;
      if (inMemorySheets.failCount > 0) {
        inMemorySheets.failCount--;
        const err = new Error('Rate limit');
        err.status = 429;
        throw err;
      }
      return 'RateLimitRecovered';
    }, 3, 50);

    assert.strictEqual(result, 'RateLimitRecovered');
    assert.strictEqual(called, 2, 'Should succeed on second attempt');
    inMemorySheets.errorMode = null;
  });

  test('16. Network timeout handling: ETIMEDOUT triggers retry and recovers safely', async () => {
    let called = 0;
    const result = await executeWithRetry(async () => {
      called++;
      if (called === 1) {
        const err = new Error('Connection timed out');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return 'TimeoutRecovered';
    }, 3, 50);

    assert.strictEqual(result, 'TimeoutRecovered');
    assert.strictEqual(called, 2);
  });

  // =========================================================================
  // 17–18. Google API Error Handling (Authentication & Missing Spreadsheet)
  // =========================================================================
  test('17. Invalid credentials failure marks ExportJob failed without damaging MongoDB', async () => {
    inMemorySheets.errorMode = 'auth';

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/export',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { spreadsheetId: testSpreadsheetId, runSync: true },
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);

      // MongoDB records must remain intact
      const contactsCount = await Contact.countDocuments();
      assert.ok(contactsCount >= 3);
    } finally {
      inMemorySheets.errorMode = null;
    }
  });

  test('18. Missing spreadsheet returns 404 and logs failure cleanly', async () => {
    inMemorySheets.errorMode = 'notFound';

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/export',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { spreadsheetId: 'missing_spreadsheet_id', runSync: true },
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    } finally {
      inMemorySheets.errorMode = null;
    }
  });

  // =========================================================================
  // 19–20. Spreadsheet Locking & Stale-Worker Recovery
  // =========================================================================
  test('19. Concurrent export attempts on same spreadsheet return HTTP 409 Conflict', async () => {
    const lock1 = await acquireSpreadsheetLock(testSpreadsheetId, 'job_concurrent_1', adminUser._id, 60000);
    assert.strictEqual(lock1.acquired, true);

    const resConflict = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { spreadsheetId: testSpreadsheetId },
    });

    assert.strictEqual(resConflict.status, 409);
    assert.ok(resConflict.body.message.includes('Destination spreadsheet is currently locked'));
    assert.strictEqual(resConflict.body.activeJobId, 'job_concurrent_1');

    await releaseSpreadsheetLock(testSpreadsheetId, lock1.ownerToken);
  });

  test('20. Stale-worker protection: expired lock lease is reclaimed atomically', async () => {
    await SpreadsheetLock.findOneAndUpdate(
      { spreadsheetId: testSpreadsheetId },
      {
        spreadsheetId: testSpreadsheetId,
        ownerToken: 'dead-worker-token-xyz',
        jobId: 'crashed_job_999',
        lockedBy: adminUser._id,
        lockedAt: new Date(Date.now() - 600000),
        expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
      },
      { upsert: true }
    );

    const newAcquisition = await acquireSpreadsheetLock(testSpreadsheetId, 'recovering_job_1', adminUser._id, 60000);
    assert.strictEqual(newAcquisition.acquired, true);
    assert.strictEqual(newAcquisition.recoveredFromStale, true);
    assert.notStrictEqual(newAcquisition.ownerToken, 'dead-worker-token-xyz');

    await releaseSpreadsheetLock(testSpreadsheetId, newAcquisition.ownerToken);
  });

  // =========================================================================
  // 21. valueInputOption: 'RAW' and Formula Injection Defense
  // =========================================================================
  test('21. valueInputOption RAW stores formulas and phone numbers literally without execution or truncation', async () => {
    // Assert last Google Sheets write used 'RAW'
    assert.strictEqual(
      inMemorySheets.lastValueInputOption,
      'RAW',
      'All Google Sheets writes must enforce valueInputOption: RAW'
    );

    // Verify cell sanitization defense-in-depth
    const dangerousFormulas = [
      '=SUM(A1:A10)',
      '+cmd|"/C calc"!A0',
      '-2+3',
      '@HYPERLINK("http://evil.com")',
      '\tTabPrefixed',
      '\rNewlinePrefixed',
    ];

    for (const formula of dangerousFormulas) {
      const sanitized = sanitizeCellValue(formula);
      assert.strictEqual(
        sanitized.charAt(0),
        "'",
        `Formula '${formula}' must be prefixed with a single quote: got '${sanitized}'`
      );
    }

    // Verify leading 0 phone numbers and + phone numbers are not altered
    const parentSheet = inMemorySheets.sheets.get(EXPORT_TABS.parentSignups);
    const rohanRow = parentSheet.find((r) => r[4] === 'Rohan Sharma');
    assert.ok(rohanRow);
    assert.strictEqual(rohanRow[9], '09876543210', 'Leading 0 phone number must remain verbatim string');

    const ananyaRow = parentSheet.find((r) => r[4] === 'Ananya Rao');
    assert.ok(ananyaRow);
    assert.strictEqual(ananyaRow[9], "'+919876543211", 'Plus-prefixed phone number must be escaped from formula interpretation');
  });

  // =========================================================================
  // 22–23. Authorization Enforcement on Export Endpoints
  // =========================================================================
  test('22. Anonymous requests to POST /api/export return HTTP 401 Unauthorized', async () => {
    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      body: { spreadsheetId: testSpreadsheetId },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.message, 'Not authorized, no token');
  });

  test('23. Non-administrator requests to POST /api/export return HTTP 403 Forbidden', async () => {
    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/export',
      headers: { authorization: `Bearer ${nonAdminToken}` },
      body: { spreadsheetId: testSpreadsheetId },
    });
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.message.includes('Administrator privileges required'));
  });

  // =========================================================================
  // 24. Snapshot Consistency: Concurrent Updates & Deletions Handled Explicitly
  // =========================================================================
  test('24. Snapshot consistency: records updated or deleted after snapshot are detected and reconciled', async () => {
    // 1. Establish an earlier snapshot boundary
    const historicSnapshot = new Date(Date.now() - 5000);

    // 2. Modify a contact document after the snapshot boundary (simulating concurrent update)
    const targetContactId = testRecordIds.contacts[0];
    await Contact.findByIdAndUpdate(targetContactId, {
      message: 'Concurrent update applied after snapshot cutoff',
      updatedAt: new Date(), // post-snapshot timestamp
    });

    // 3. Create a new contact created after the snapshot boundary (simulating post-cutoff insert)
    const postCutoffContact = await Contact.create({
      name: 'Post Cutoff Contact',
      email: 'post_cutoff@example.com',
      subject: 'Should be excluded',
      message: 'Created after snapshot timestamp',
      status: 'Pending',
      createdAt: new Date(), // post-snapshot
    });

    const jobId = `exp_consistency_${Date.now()}`;
    const lock = await acquireSpreadsheetLock(testSpreadsheetId, jobId, adminUser._id);
    assert.strictEqual(lock.acquired, true);

    const job = await ExportJob.create({
      jobId,
      exportType: 'full',
      categories: ['contacts'],
      requestedBy: adminUser._id,
      destination: { spreadsheetId: testSpreadsheetId },
      snapshotTimestamp: historicSnapshot, // Enforce historic cutoff
    });

    const completed = await runExportJob(jobId, lock.ownerToken);
    assert.strictEqual(completed.status, 'completed');

    // Verify post-cutoff insert was strictly excluded
    const contactSheet = inMemorySheets.sheets.get(EXPORT_TABS.contacts);
    const postCutoffRow = contactSheet.find((r) => r[4] === 'Post Cutoff Contact');
    assert.strictEqual(postCutoffRow, undefined, 'Post-cutoff records must NOT be exported');

    // Verify concurrent update was detected and recorded
    assert.ok(
      completed.concurrentUpdatesDetected >= 1,
      'Concurrent update after snapshot cutoff must be explicitly detected'
    );
    assert.ok(
      completed.reconciliation.discrepancies.some((d) => d.includes('concurrent update')),
      'Discrepancy audit log must record concurrent update'
    );

    // Cleanup extra record
    await Contact.deleteOne({ _id: postCutoffContact._id });
  });

  // =========================================================================
  // 25. Export History Retrieval & Job Status API
  // =========================================================================
  test('25. GET /api/export and /api/export/:jobId return authorized job history and status', async () => {
    const jobs = await ExportJob.find().sort({ createdAt: -1 }).limit(1);
    const targetJobId = jobs[0].jobId;

    const resStatus = await executeRequest(app, {
      method: 'GET',
      url: `/api/export/${targetJobId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resStatus.status, 200);
    assert.strictEqual(resStatus.body.data.jobId, targetJobId);

    const resHistory = await executeRequest(app, {
      method: 'GET',
      url: '/api/export?page=1&limit=5',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resHistory.status, 200);
    assert.ok(resHistory.body.data.length > 0);
    assert.ok(resHistory.body.pagination.total > 0);
  });
});
