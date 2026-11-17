import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';

import app from './src/server.js';
import { isLockActive, acquireSpreadsheetLock, releaseSpreadsheetLock } from './src/services/lockService.js';
import { resetRateLimits } from './src/middleware/rateLimitMiddleware.js';
import {
  COLLECTIONS,
  restoreToIsolatedDatabase,
  verifySnapshotIntegrity,
} from './src/utils/backupRestoreManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 7 Final Security Corrections & Hardening Verification Suite', { concurrency: 1 }, () => {
  let server;
  let serverPort;
  let testAdmin;
  let liveDb;

  before(async () => {
    await connectDB();
    liveDb = mongoose.connection;

    // Create an isolated test admin for this suite
    testAdmin = await User.create({
      username: 'P7 Security Admin',
      email: `p7_sec_admin_${Date.now()}@dhiyonitutorials.com`,
      password: 'SecuredPassword123!',
      role: 'admin',
      tokenVersion: 0,
    });

    // Start ephemeral HTTP server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (testAdmin) {
      await User.deleteOne({ _id: testAdmin._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    process.exit(0);
  });

  // =========================================================================
  // TASK 1: AUTHENTICATION REVOCATION & CSRF
  // =========================================================================
  test('Task 1.1: Legacy JWT missing tokenVersion is strictly revoked once admin logs out or updates password', async () => {
    // 1. Issue a legacy token WITHOUT tokenVersion
    const legacyToken = jwt.sign(
      { id: testAdmin._id }, // No tokenVersion field
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Initial state: testAdmin.tokenVersion === 0 -> legacy token is accepted
    const initialRes = await fetch(`http://127.0.0.1:${serverPort}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assert.strictEqual(initialRes.status, 200, 'Legacy token accepted when tokenVersion is 0');

    // 3. User logs out or changes password -> increments tokenVersion to 1
    await User.findByIdAndUpdate(testAdmin._id, { $inc: { tokenVersion: 1 } });
    const refreshedAdmin = await User.findById(testAdmin._id);
    assert.strictEqual(refreshedAdmin.tokenVersion, 1);

    // 4. Test legacy token again -> MUST be rejected with 401
    const revokedRes = await fetch(`http://127.0.0.1:${serverPort}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assert.strictEqual(revokedRes.status, 401, 'Legacy token strictly rejected after tokenVersion increment');
    const body = await revokedRes.json();
    assert.match(body.message, /Session invalidated/, 'Correct invalidation message returned');

    // Reset tokenVersion back for subsequent tests
    await User.findByIdAndUpdate(testAdmin._id, { $set: { tokenVersion: 0 } });
  });

  test('Task 1.2: Cookie-authenticated state-changing requests reject unauthorized origins (CSRF Defense)', async () => {
    const validToken = jwt.sign(
      { id: testAdmin._id, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Request using cookie dhiyoni_admin_session with an evil origin and x-test-csrf flag
    const csrfRes = await fetch(`http://127.0.0.1:${serverPort}/api/contacts/665ef49a032d9f1b88e12345`, {
      method: 'PUT',
      headers: {
        Cookie: `dhiyoni_admin_session=${validToken}`,
        Origin: 'https://malicious-attacker.com',
        'x-test-csrf': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'contacted' }),
    });

    assert.strictEqual(csrfRes.status, 403, 'CSRF state change from unauthorized origin must return 403');
    const body = await csrfRes.json();
    assert.match(body.message, /CSRF validation failed/, 'Explicit CSRF error message returned');

    // Request from authorized origin succeeds
    const legitimateRes = await fetch(`http://127.0.0.1:${serverPort}/api/contacts/665ef49a032d9f1b88e12345`, {
      method: 'PUT',
      headers: {
        Cookie: `dhiyoni_admin_session=${validToken}`,
        Origin: 'https://www.dhiyonitutorials.com',
        'x-test-csrf': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'contacted' }),
    });

    // Not 403 (could be 404 for nonexistent ID, but NOT 403 CSRF error)
    assert.notStrictEqual(legitimateRes.status, 403, 'Legitimate origin passes CSRF validation');
  });

  // =========================================================================
  // TASK 2: RATE-LIMIT BYPASS REMOVAL & PRODUCTION ENFORCEMENT
  // =========================================================================
  test('Task 2.1: In production mode, forged x-bypass-rate-limit headers are strictly ignored and rate limiting triggers 429', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    resetRateLimits();

    try {
      // Form submission rate limiter allows 25 per min.
      // Fire 26 requests with forged bypass header 'x-bypass-rate-limit: true'
      let hitRateLimit = false;
      for (let i = 0; i < 27; i++) {
        const res = await fetch(`http://127.0.0.1:${serverPort}/api/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-bypass-rate-limit': 'true', // Forged bypass header
          },
          body: JSON.stringify({
            name: 'Rate Limit Test User',
            email: `ratelimit_${i}@example.com`,
            subject: 'Course inquiry',
            message: 'Testing rate limit enforcement',
          }),
        });

        if (res.status === 429) {
          hitRateLimit = true;
          const body = await res.json();
          assert.match(body.message, /rate limit reached/, '429 rate limit message returned');
          break;
        }
      }

      assert.strictEqual(hitRateLimit, true, 'Production rate limit must trigger 429 even with forged bypass header');
    } finally {
      process.env.NODE_ENV = originalEnv;
      resetRateLimits();
      // Clean up test contact entries
      await Contact.deleteMany({ email: /^ratelimit_/ });
    }
  });

  // =========================================================================
  // TASK 3: EXPORT IDEMPOTENCY & CONCURRENCY
  // =========================================================================
  test('Task 3.1: Export idempotency key reuse with identical parameters returns existing job without duplicates', async () => {
    const validToken = jwt.sign(
      { id: testAdmin._id, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const clientRequestId = `idemp_test_${Date.now()}`;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    // Clean up any existing lock
    await SpreadsheetLock.deleteMany({ spreadsheetId });

    // Request 1 with runSync: true to ensure clean synchronous completion
    const res1 = await fetch(`http://127.0.0.1:${serverPort}/api/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': clientRequestId,
      },
      body: JSON.stringify({
        categories: ['contacts', 'feedbacks'],
        spreadsheetId,
        runSync: true,
      }),
    });

    assert.strictEqual(res1.status, 200, 'First export request succeeds');
    const data1 = await res1.json();
    const jobId1 = data1.jobId || data1.data?.jobId;
    assert.ok(jobId1, 'jobId returned in response 1');

    // Request 2 (simulating retry with identical Idempotency-Key)
    const res2 = await fetch(`http://127.0.0.1:${serverPort}/api/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': clientRequestId,
      },
      body: JSON.stringify({
        categories: ['contacts', 'feedbacks'],
        spreadsheetId,
      }),
    });

    assert.strictEqual(res2.status, 200, 'Second export request with identical key returns 200');
    const data2 = await res2.json();
    assert.strictEqual(data2.jobId, jobId1, 'Exact same jobId returned on idempotent retry');
    assert.strictEqual(data2.isExisting, true, 'isExisting flag confirms no duplicate job was created');

    // Verify only ONE ExportJob exists with this clientRequestId in MongoDB
    const jobsCount = await ExportJob.countDocuments({ clientRequestId });
    assert.strictEqual(jobsCount, 1, 'Exactly one ExportJob persisted in MongoDB');

    // Clean up
    await ExportJob.deleteOne({ clientRequestId });
    await SpreadsheetLock.deleteMany({ spreadsheetId });
  });

  test('Task 3.2: Export idempotency key reuse with conflicting categories returns HTTP 400 Bad Request', async () => {
    const validToken = jwt.sign(
      { id: testAdmin._id, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const clientRequestId = `conflict_test_${Date.now()}`;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    await SpreadsheetLock.deleteMany({ spreadsheetId });

    // Initial creation with runSync: true so no background worker keeps running
    await fetch(`http://127.0.0.1:${serverPort}/api/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': clientRequestId,
      },
      body: JSON.stringify({
        categories: ['contacts'],
        spreadsheetId,
        runSync: true,
      }),
    });

    // Conflicting request with same key but different categories
    const conflictRes = await fetch(`http://127.0.0.1:${serverPort}/api/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': clientRequestId,
      },
      body: JSON.stringify({
        categories: ['feedbacks', 'newsletters'], // Conflicting
        spreadsheetId,
      }),
    });

    assert.strictEqual(conflictRes.status, 400, 'Conflicting categories with same key must return 400');
    const body = await conflictRes.json();
    assert.match(body.message, /conflicting export parameters/, 'Explaining error returned');

    // Wait for job execution to settle before cleaning up
    for (let i = 0; i < 30; i++) {
      const current = await ExportJob.findOne({ clientRequestId });
      if (!current || current.status === 'completed' || current.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // Clean up
    await ExportJob.deleteOne({ clientRequestId });
    await SpreadsheetLock.deleteMany({ spreadsheetId });
  });

  // =========================================================================
  // TASK 6: EXPORT CONCURRENCY, EXPIRATION & STALE WORKER PUBLICATION
  // =========================================================================
  test('Task 6.1: Expired lock prevents stale worker from publishing to production tab', async () => {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    await SpreadsheetLock.deleteMany({ spreadsheetId });

    // Worker 1 acquires lock with an expired lease (simulate lease expiry)
    const lock1 = await acquireSpreadsheetLock(spreadsheetId, 'job_worker_1', testAdmin._id, 10);
    assert.strictEqual(lock1.acquired, true);

    // Wait 25ms for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Worker 1 checks lock status before publication
    const isWorker1Active = await isLockActive(spreadsheetId, lock1.ownerToken);
    assert.strictEqual(isWorker1Active, false, 'Expired lease must report inactive');

    // Worker 2 reclaims the expired lock (atomic stale-worker takeover)
    const lock2 = await acquireSpreadsheetLock(spreadsheetId, 'job_worker_2', testAdmin._id, 300000);
    assert.strictEqual(lock2.acquired, true);
    assert.strictEqual(lock2.recoveredFromStale, true, 'Worker 2 successfully reclaimed stale lock');

    // Stale Worker 1 attempts to release the lock with its old token -> MUST FAIL to delete Worker 2's lock
    const releasedByWorker1 = await releaseSpreadsheetLock(spreadsheetId, lock1.ownerToken);
    assert.strictEqual(releasedByWorker1, false, 'Stale worker token cannot delete active lock held by another worker');

    // Confirm Worker 2 STILL owns the lock
    const isWorker2Active = await isLockActive(spreadsheetId, lock2.ownerToken);
    assert.strictEqual(isWorker2Active, true, 'Worker 2 retains active ownership of the lock');

    // Clean up
    await releaseSpreadsheetLock(spreadsheetId, lock2.ownerToken);
  });

  // =========================================================================
  // TASK 4: REAL DATABASE RESTORE VERIFICATION IN ISOLATED DATABASE
  // =========================================================================
  test('Task 4.1: Restore drill executes into isolated test database preserving BSON types and indexes', async () => {
    const snapshotDir = path.resolve(
      'C:/Users/sripa/.gemini/antigravity/brain/4cbd4bb4-bc27-4d72-847d-7a6a26014940/mongodb_backup_phase7'
    );

    // 1. Verify snapshot integrity first
    const integrity = verifySnapshotIntegrity(snapshotDir);
    assert.strictEqual(integrity.valid, true, 'Snapshot integrity hashes must be 100% valid');

    // 2. Connect to an ISOLATED test database (never production!)
    const isolatedConn = mongoose.createConnection(process.env.MONGODB_URI, {
      dbName: 'dhiyoni_isolated_restore_test',
    });

    await new Promise((resolve) => isolatedConn.once('open', resolve));

    try {
      // 3. Execute restoration into isolated test database
      const restoreResult = await restoreToIsolatedDatabase({
        snapshotDir,
        targetConnection: isolatedConn,
      });

      assert.strictEqual(restoreResult.success, true);
      assert.strictEqual(restoreResult.targetDatabase, 'dhiyoni_isolated_restore_test');
      assert.ok(restoreResult.totalRestored > 0, 'Records restored into isolated database');

      // 4. Verify BSON type preservation in restored data
      const contactColl = isolatedConn.collection('contacts');
      const sampleContact = await contactColl.findOne();
      if (sampleContact) {
        assert.ok(
          sampleContact._id instanceof mongoose.Types.ObjectId,
          '_id must be preserved as genuine MongoDB BSON ObjectId'
        );
        assert.ok(
          sampleContact.createdAt instanceof Date,
          'createdAt must be preserved as genuine JavaScript BSON Date'
        );
      }

      // 5. Verify unique index enforcement on restored collections
      const userColl = isolatedConn.collection('users');
      const existingUser = await userColl.findOne();
      if (existingUser) {
        // Attempting to insert duplicate email should throw 11000
        let duplicateFailed = false;
        try {
          await userColl.insertOne({
            username: 'Duplicate Test',
            email: existingUser.email,
            password: 'pwd',
            role: 'admin',
          });
        } catch (err) {
          duplicateFailed = err.code === 11000;
        }
        assert.strictEqual(duplicateFailed, true, 'Unique email index enforced on restored collection');
      }

      // 6. Verify application queries on restored data
      const activeContacts = await contactColl.find({ status: { $exists: true } }).toArray();
      assert.ok(Array.isArray(activeContacts), 'Querying restored collections executes successfully');

      // 7. Verify safety block: Attempting to restore over production database throws error
      let safetyBlockTriggered = false;
      const fakeProdConn = { name: 'dhiyoni', collection: () => {} };
      try {
        await restoreToIsolatedDatabase({
          snapshotDir,
          targetConnection: fakeProdConn,
        });
      } catch (err) {
        safetyBlockTriggered = err.message.includes('SAFETY BLOCK');
      }
      assert.strictEqual(safetyBlockTriggered, true, 'Safety block prevents restoring over production');
    } finally {
      // Clean up isolated test database completely
      await isolatedConn.dropDatabase();
      await isolatedConn.close();
    }
  });
});
