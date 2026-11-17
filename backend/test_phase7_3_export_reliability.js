import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import http from 'node:http';

dns.setDefaultResultOrder('ipv4first');
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
import { sanitizeCellValue } from './src/services/googleSheetsService.js';

describe('Phase 7.3 — Google Sheets Export Reliability & Idempotency Verification', () => {
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

    await User.deleteMany({ email: /export_rel_test_.*@dhiyonitutorials.com/ });
    adminUser = await User.create({
      username: 'Export Reliability Admin',
      email: 'export_rel_test_admin@dhiyonitutorials.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({ email: /export_rel_test_.*@dhiyonitutorials.com/ });
    await ExportJob.deleteMany({ jobId: /exp_rel_.*/ });
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await mongoose.connection.close();
  });

  async function apiCall(method, pathUrl, headers = {}, body = null) {
    const opts = {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
        ...headers,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${pathUrl}`, opts);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  }

  // =========================================================================
  // 1. Request-Level Idempotency (Same Key Returns Existing Job)
  // =========================================================================
  test('1. Submitting identical request with same Idempotency-Key returns existing job without duplicate', async () => {
    const idempotencyKey = `idemp_${Date.now()}_alpha`;
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });

    // First Request
    const res1 = await apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, {
      categories: ['contacts', 'newsletters'],
    });

    assert.ok([200, 202].includes(res1.status));
    assert.ok(res1.json.jobId);
    const firstJobId = res1.json.jobId;

    // Retry Request with identical Idempotency-Key
    const res2 = await apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, {
      categories: ['contacts', 'newsletters'],
    });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.json.jobId, firstJobId);
    assert.strictEqual(res2.json.isExisting, true);

    // Verify only 1 document created in MongoDB for this clientRequestId
    const jobCount = await ExportJob.countDocuments({ clientRequestId: idempotencyKey });
    assert.strictEqual(jobCount, 1, 'Exactly one ExportJob must exist for this idempotency key');
  });

  // =========================================================================
  // 2. Idempotency Key Reuse Mismatch Rejection
  // =========================================================================
  test('2. Reusing Idempotency-Key with different categories is rejected with HTTP 400', async () => {
    const idempotencyKey = `idemp_${Date.now()}_beta`;
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });

    // Initial Request with contacts
    const res1 = await apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, {
      categories: ['contacts'],
    });
    assert.ok([200, 202].includes(res1.status));

    // Tampered retry with different categories
    const res2 = await apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, {
      categories: ['contacts', 'newsletters', 'feedbacks'],
    });

    assert.strictEqual(res2.status, 400);
    assert.ok(res2.json.message.includes('mismatched export categories'));
  });

  // =========================================================================
  // 3. Concurrent Request Race Condition Handling
  // =========================================================================
  test('3. Concurrent requests with same Idempotency-Key safely resolve to a single job', async () => {
    const idempotencyKey = `idemp_${Date.now()}_race`;
    await SpreadsheetLock.deleteMany({ spreadsheetId: SPREADSHEET_ID });

    // Fire 3 simultaneous requests with identical idempotencyKey
    const results = await Promise.all([
      apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, { categories: ['contacts'] }),
      apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, { categories: ['contacts'] }),
      apiCall('POST', '/', { 'Idempotency-Key': idempotencyKey }, { categories: ['contacts'] }),
    ]);

    // All should succeed (either 200 or 202)
    for (const r of results) {
      assert.ok([200, 202].includes(r.status));
    }

    // All must reference the identical jobId
    const jobIds = new Set(results.map((r) => r.json.jobId));
    assert.strictEqual(jobIds.size, 1, 'All concurrent responses must resolve to the identical jobId');

    const totalInDb = await ExportJob.countDocuments({ clientRequestId: idempotencyKey });
    assert.strictEqual(totalInDb, 1, 'Database must contain exactly 1 ExportJob document');
  });

  // =========================================================================
  // 4. Formula Injection & Special Character Sanitization
  // =========================================================================
  test('4. Formula injection sanitization neutralizes formula prefixes safely', () => {
    const maliciousInputs = [
      '=SUM(A1:A10)',
      '+cmd|/c calc!A0',
      '-1337+2',
      '@SUM(B1:B5)',
      '=cmd|\' /C calc\'!A0',
    ];

    for (const input of maliciousInputs) {
      const sanitized = sanitizeCellValue(input);
      assert.ok(sanitized.startsWith("'"), `Expected leading single quote for input: ${input}`);
      assert.strictEqual(sanitized, `'${input}`);
    }

    // Harmless text should remain untouched
    assert.strictEqual(sanitizeCellValue('Normal Name'), 'Normal Name');
    assert.strictEqual(sanitizeCellValue('test@example.com'), 'test@example.com');
  });

  // =========================================================================
  // 5. Phone Number Text Preservation
  // =========================================================================
  test('5. Phone numbers with leading zeros and international plus prefixes are sanitized as text', () => {
    // Leading zero
    const phoneZero = '09876543210';
    const sanitizedZero = sanitizeCellValue(phoneZero);
    assert.strictEqual(sanitizedZero, phoneZero, 'Leading zero phone string must be preserved');

    // Plus prefix
    const phonePlus = '+919876543210';
    const sanitizedPlus = sanitizeCellValue(phonePlus);
    assert.strictEqual(sanitizedPlus, `'+919876543210`, 'Plus-prefixed phone must be escaped to prevent formula interpretation');
  });
});
