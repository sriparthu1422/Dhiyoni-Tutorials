import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import User from './src/models/User.js';
import app from './src/server.js';
import { resetRateLimits } from './src/middleware/rateLimitMiddleware.js';

describe('Phase 7.2 — Backend API & Application Security Verification', () => {
  let server;
  let baseUrl;
  let adminUser;
  let adminToken;
  let userToken;

  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    await User.deleteMany({ email: /api_sec_test_.*@dhiyonitutorials.com/ });
    adminUser = await User.create({
      username: 'API Sec Admin',
      email: 'api_sec_test_admin@dhiyonitutorials.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });

    const nonAdminId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: nonAdminId,
      username: 'API Normal User',
      email: 'api_sec_test_user@dhiyonitutorials.com',
      password: 'UserPassword123!',
      role: 'user',
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userToken = jwt.sign({ id: nonAdminId, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({ email: /api_sec_test_.*@dhiyonitutorials.com/ });
    await mongoose.connection.close();
    process.exit(0);
  });

  beforeEach(() => {
    resetRateLimits();
  });

  async function apiCall(method, pathUrl, headers = {}, body = null) {
    const opts = {
      method,
      headers: { 'content-type': 'application/json', ...headers },
    };
    if (body) {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${pathUrl}`, opts);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {}
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      json,
      text,
    };
  }

  // =========================================================================
  // 1. HTTP Security Headers & Server Masking
  // =========================================================================
  test('1. Security headers are set and X-Powered-By is suppressed', async () => {
    const res = await apiCall('GET', '/api/health');
    assert.strictEqual(res.status, 200);

    // Verify Helmet headers
    assert.strictEqual(res.headers['x-powered-by'], undefined, 'Must not disclose X-Powered-By header');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['content-security-policy'], 'CSP header must be present');
  });

  // =========================================================================
  // 2. Request Body Size Limits
  // =========================================================================
  test('2. Rejects request payloads exceeding 50kb with HTTP 413 Payload Too Large', async () => {
    // Generate 60KB string payload
    const oversized = 'A'.repeat(60 * 1024);
    const res = await apiCall('POST', '/api/contacts', {}, {
      name: 'Oversized Tester',
      email: 'test@example.com',
      message: oversized,
    });

    assert.strictEqual(res.status, 413);
  });

  // =========================================================================
  // 3. Public Form Submission Rate Limiting
  // =========================================================================
  test('3. Form submission rate limiter allows normal volume and throttles excessive requests (HTTP 429)', async () => {
    // Send 25 rapid submissions (within threshold)
    for (let i = 0; i < 25; i++) {
      const res = await apiCall('POST', '/api/newsletters', { 'x-test-rate-limit': 'true' }, {
        email: `ratelimit_test_${i}_${Date.now()}@example.com`,
      });
      // Either 201 created or 400 already exists, but not 429
      assert.ok([200, 201, 400].includes(res.status));
    }

    // 26th submission from same IP triggers 429
    const blockedRes = await apiCall('POST', '/api/newsletters', { 'x-test-rate-limit': 'true' }, {
      email: `ratelimit_blocked_${Date.now()}@example.com`,
    });
    assert.strictEqual(blockedRes.status, 429);
    assert.ok(blockedRes.json.message.includes('rate limit'));
    assert.ok(blockedRes.headers['retry-after']);
  });

  // =========================================================================
  // 4. Prototype Pollution Protection
  // =========================================================================
  test('4. Payload cannot pollute Object prototype via __proto__ or constructor keys', async () => {
    const maliciousBody = JSON.parse(
      '{"__proto__":{"polluted":true},"name":"Sec Tester","email":"sec@example.com","message":"Hello"}'
    );

    const res = await apiCall('POST', '/api/contacts', {}, maliciousBody);
    assert.ok([200, 201].includes(res.status));

    // Assert global Object is NOT polluted
    assert.strictEqual(Object.prototype.polluted, undefined);
    assert.strictEqual({}.polluted, undefined);
  });

  // =========================================================================
  // 5. Query Validation & ReDoS Defenses
  // =========================================================================
  test('5. Rejects search queries exceeding 100 characters with HTTP 400', async () => {
    const longQuery = 'x'.repeat(101);
    const res = await apiCall(
      'GET',
      `/api/contacts?search=${encodeURIComponent(longQuery)}`,
      { authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 400);
    assert.ok(res.json.message.includes('maximum allowed length'));
  });

  test('6. Escapes regex special characters in search queries safely without causing 500 error', async () => {
    const regexQuery = '.*+?^${}()|[]\\';
    const res = await apiCall(
      'GET',
      `/api/contacts?search=${encodeURIComponent(regexQuery)}`,
      { authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json.data));
  });

  // =========================================================================
  // 6. Safe ObjectId Parameter Handling
  // =========================================================================
  test('7. Malformed MongoDB ObjectId returns HTTP 400 without crashing', async () => {
    const res = await apiCall(
      'GET',
      '/api/contacts/invalid-malformed-id-12345',
      { authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 400);
    assert.ok(res.json.message.includes('Invalid inquiry ID format') || res.json.message.includes('Invalid'));
  });
});
