import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import User from './src/models/User.js';
import exportRoutes from './src/routes/exportRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../frontend/dist');

describe('Task 3 — Google Sheets Export Security Verification', () => {
  let app;
  let server;
  let baseUrl;
  let adminUser;
  let normalUser;
  let adminToken;
  let normalUserToken;

  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  before(async () => {
    await connectDB();

    app = express();
    app.use(express.json());
    app.use('/api/export', exportRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/export`;

    // Clean up test users
    await User.deleteMany({ email: /security_test_.*@dhiyonitutorials.com/ });

    adminUser = await User.create({
      username: 'Sec Admin',
      email: 'security_test_admin@dhiyonitutorials.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });

    const nonAdminId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: nonAdminId,
      username: 'Sec Member',
      email: 'security_test_user@dhiyonitutorials.com',
      password: 'UserPassword123!',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    normalUserToken = jwt.sign({ id: nonAdminId }, JWT_SECRET, { expiresIn: '1h' });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({ email: /security_test_.*@dhiyonitutorials.com/ });
    await mongoose.connection.close();
  });

  async function makeReq(method, pathUrl, token, body = null) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      opts.body = JSON.stringify(body);
    }
    const url = `${baseUrl}${pathUrl.startsWith('/') ? pathUrl : '/' + pathUrl}`;
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      // Ignored
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: text,
      json: () => json,
    };
  }

  // =========================================================================
  // 1. Authentication & Authorization Guards
  // =========================================================================
  test('1. Anonymous requests return HTTP 401 Unauthorized on all endpoints', async () => {
    const postRes = await makeReq('POST', '/', null, {});
    assert.strictEqual(postRes.status, 401);

    const getJobRes = await makeReq('GET', '/exp_test_123', null);
    assert.strictEqual(getJobRes.status, 401);

    const getHistRes = await makeReq('GET', '/', null);
    assert.strictEqual(getHistRes.status, 401);
  });

  test('2. Authenticated non-admin requests return HTTP 403 Forbidden', async () => {
    const postRes = await makeReq('POST', '/', normalUserToken, {});
    assert.strictEqual(postRes.status, 403);
    const json = postRes.json();
    assert.ok(json.message.toLowerCase().includes('admin') || json.message.toLowerCase().includes('administrator'));

    const getJobRes = await makeReq('GET', '/exp_test_123', normalUserToken);
    assert.strictEqual(getJobRes.status, 403);

    const getHistRes = await makeReq('GET', '/', normalUserToken);
    assert.strictEqual(getHistRes.status, 403);
  });

  // =========================================================================
  // 2. Input Validation: Category & Spreadsheet Destinations
  // =========================================================================
  test('3. Rejects invalid or malicious category names with HTTP 400', async () => {
    const res = await makeReq('POST', '/', adminToken, {
      categories: ['users', 'passwords', '__proto__'],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.json().message.includes('Invalid category'));
  });

  test('4. Rejects empty category array with HTTP 400', async () => {
    const res = await makeReq('POST', '/', adminToken, {
      categories: [],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.json().message.includes('non-empty array'));
  });

  test('5. Rejects malformed spreadsheet destinations with HTTP 400', async () => {
    const badIds = [
      'short',
      'invalid/chars!@#$%^&*()',
      'javascript:alert(1)',
      '<script>evil()</script>',
    ];

    for (const badId of badIds) {
      const res = await makeReq('POST', '/', adminToken, {
        spreadsheetId: badId,
      });
      assert.strictEqual(res.status, 400, `Expected 400 for bad id: ${badId}`);
      assert.ok(res.json().message.includes('Invalid spreadsheetId format'));
    }
  });

  // =========================================================================
  // 3. Frontend Bundle Audit (Zero Secret Leakage)
  // =========================================================================
  test('6. Frontend production bundles contain zero Google private keys or secrets', () => {
    assert.ok(fs.existsSync(distDir), 'Frontend dist directory must exist');
    const assetFiles = fs.readdirSync(path.join(distDir, 'assets'));

    const sensitivePatterns = [
      /BEGIN PRIVATE KEY/,
      /client_email.*gserviceaccount\.com/,
      /private_key_id/,
      /MONGO_URI/,
      /JWT_SECRET/,
    ];

    for (const file of assetFiles) {
      if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html')) {
        const content = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8');
        for (const pattern of sensitivePatterns) {
          assert.strictEqual(
            pattern.test(content),
            false,
            `Secret pattern ${pattern} detected in compiled frontend asset: ${file}!`
          );
        }
      }
    }
  });

  // =========================================================================
  // 4. Error Responses Do Not Expose Private Secrets
  // =========================================================================
  test('7. Error responses do not expose internal stack traces or environment secrets', async () => {
    const res = await makeReq('GET', '/non_existent_job_99999', adminToken);
    assert.strictEqual(res.status, 404);
    const bodyStr = res.body;
    assert.strictEqual(bodyStr.includes('private_key'), false);
    assert.strictEqual(bodyStr.includes('MONGO_URI'), false);
  });
});
