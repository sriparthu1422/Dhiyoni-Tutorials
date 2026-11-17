import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import User from './src/models/User.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';
import exportRoutes from './src/routes/exportRoutes.js';
import { acquireSpreadsheetLock, releaseSpreadsheetLock } from './src/services/lockService.js';

describe('Task 4 — Job Lifecycle & Failure Recovery Verification', () => {
  let app;
  let server;
  let baseUrl;
  let adminUser;
  let adminToken;

  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY';
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  before(async () => {
    await connectDB();

    app = express();
    app.use(express.json());
    app.use('/api/export', exportRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/export`;

    await User.deleteMany({ email: /lifecycle_test_.*@dhiyonitutorials.com/ });
    adminUser = await User.create({
      username: 'Lifecycle Admin',
      email: 'lifecycle_test_admin@dhiyonitutorials.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({ email: /lifecycle_test_.*@dhiyonitutorials.com/ });
    await ExportJob.deleteMany({ jobId: /exp_lifecycle_.*/ });
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });
    await mongoose.connection.close();
  });

  async function apiCall(method, pathUrl, token, body = null) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const url = `${baseUrl}${pathUrl.startsWith('/') ? pathUrl : '/' + pathUrl}`;
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, body: text };
  }

  // =========================================================================
  // 1. Status Lifecycle: Pending -> Processing -> Completed
  // =========================================================================
  test('1. Validates full lifecycle transitions for successful export (pending -> processing -> completed)', async () => {
    const testJobId = `exp_lifecycle_success_${Date.now()}`;
    const job = await ExportJob.create({
      jobId: testJobId,
      status: 'pending',
      categories: ['contacts'],
      destination: { spreadsheetId: SPREADSHEET_ID },
      requestedBy: adminUser._id,
    });

    assert.strictEqual(job.status, 'pending');

    // Transition to processing
    job.status = 'processing';
    await job.save();
    const processingJob = await ExportJob.findOne({ jobId: testJobId });
    assert.strictEqual(processingJob.status, 'processing');

    // Simulate completion
    job.status = 'completed';
    job.completedAt = new Date();
    job.recordCounts = { contacts: 5, total: 5 };
    await job.save();
    const completedJob = await ExportJob.findOne({ jobId: testJobId });
    assert.strictEqual(completedJob.status, 'completed');
    assert.strictEqual(completedJob.recordCounts.contacts, 5);
    assert.ok(completedJob.completedAt);
  });

  // =========================================================================
  // 2. Status Lifecycle: Pending -> Processing -> Failed
  // =========================================================================
  test('2. Validates full lifecycle transitions for failed export (pending -> processing -> failed)', async () => {
    const testJobId = `exp_lifecycle_fail_${Date.now()}`;
    const job = await ExportJob.create({
      jobId: testJobId,
      status: 'pending',
      categories: ['contacts'],
      destination: { spreadsheetId: SPREADSHEET_ID },
      requestedBy: adminUser._id,
    });

    assert.strictEqual(job.status, 'pending');

    // Transition to processing
    job.status = 'processing';
    await job.save();

    // Transition to failed with errorDetails
    job.status = 'failed';
    job.errorDetails = {
      message: 'Simulated quota exceeded error',
      code: 'QUOTA_EXCEEDED',
      timestamp: new Date(),
    };
    job.completedAt = new Date();
    await job.save();

    const failedJob = await ExportJob.findOne({ jobId: testJobId });
    assert.strictEqual(failedJob.status, 'failed');
    assert.strictEqual(failedJob.errorDetails.message, 'Simulated quota exceeded error');
    assert.strictEqual(failedJob.errorDetails.code, 'QUOTA_EXCEEDED');
    assert.ok(failedJob.completedAt);
  });

  // =========================================================================
  // 3. Concurrent Lock Prevention (HTTP 409 Conflict)
  // =========================================================================
  test('3. Prevents duplicate concurrent exports and returns HTTP 409 Conflict when a lock is active', async () => {
    const activeJobId = `exp_lifecycle_lock_${Date.now()}`;
    // Explicitly acquire lock
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });
    const lock = await acquireSpreadsheetLock(SPREADSHEET_ID, activeJobId, adminUser._id, 300000);
    assert.strictEqual(lock.acquired, true);

    // Attempt to start another export via API
    const res = await apiCall('POST', '/', adminToken, {
      categories: ['contacts'],
    });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.json.activeJobId, activeJobId);
    assert.ok(res.json.message.includes('Concurrent export in progress'));

    // Clean up lock
    await releaseSpreadsheetLock(SPREADSHEET_ID, lock.ownerToken);
  });

  // =========================================================================
  // 4. Stale Lock Expiration (Self-Healing after 5-minute TTL)
  // =========================================================================
  test('4. Allows new export if existing lock is older than lease expiry (TTL expiry self-healing)', async () => {
    const staleJobId = `exp_lifecycle_stale_${Date.now()}`;
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });

    // Seed expired lock (expiresAt in past)
    const pastDate = new Date(Date.now() - 60000);
    await SpreadsheetLock.collection.insertOne({
      spreadsheetId: SPREADSHEET_ID,
      ownerToken: 'stale-token-uuid',
      jobId: staleJobId,
      lockedBy: adminUser._id,
      lockedAt: new Date(Date.now() - 360000),
      expiresAt: pastDate,
      createdAt: new Date(Date.now() - 360000),
      updatedAt: new Date(Date.now() - 360000),
    });

    // New lock acquisition should successfully reclaim the expired lock
    const newJobId = `exp_lifecycle_new_${Date.now()}`;
    const reclaimResult = await acquireSpreadsheetLock(SPREADSHEET_ID, newJobId, adminUser._id, 300000);

    assert.strictEqual(reclaimResult.acquired, true);
    assert.strictEqual(reclaimResult.recoveredFromStale, true);

    await releaseSpreadsheetLock(SPREADSHEET_ID, reclaimResult.ownerToken);
  });

  // =========================================================================
  // 5. Ambiguous Initiation Recovery Investigation & Polling Re-attach
  // =========================================================================
  test('5. Validates recovery pattern for ambiguous initiation (client disconnect before HTTP 202)', async () => {
    // Failure Scenario:
    // 1. Client initiates POST /api/export
    // 2. Server acquires lock and saves ExportJob to MongoDB
    // 3. Network drops before client receives HTTP 202 response
    // 4. Client retries export: Server returns 409 Conflict with activeJobId
    // 5. Client attaches to activeJobId and polls status without creating duplicate job
    const inFlightJobId = `exp_lifecycle_inflight_${Date.now()}`;
    const lock = await acquireSpreadsheetLock(SPREADSHEET_ID, inFlightJobId, adminUser._id, 300000);
    assert.strictEqual(lock.acquired, true);

    await ExportJob.create({
      jobId: inFlightJobId,
      status: 'processing',
      categories: ['contacts'],
      destination: { spreadsheetId: SPREADSHEET_ID },
      requestedBy: adminUser._id,
    });

    // Client retries POST /api/export
    const retryRes = await apiCall('POST', '/', adminToken, {
      categories: ['contacts'],
    });

    assert.strictEqual(retryRes.status, 409);
    assert.strictEqual(retryRes.json.activeJobId, inFlightJobId);

    // Client uses returned activeJobId to attach tracker
    const statusRes = await apiCall('GET', `/${retryRes.json.activeJobId}`, adminToken);
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.json.data.jobId, inFlightJobId);
    assert.strictEqual(statusRes.json.data.status, 'processing');

    await releaseSpreadsheetLock(SPREADSHEET_ID, lock.ownerToken);
  });
});
