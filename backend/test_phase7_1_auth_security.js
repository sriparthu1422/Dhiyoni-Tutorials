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
import authRoutes from './src/routes/authRoutes.js';
import { resetRateLimits } from './src/middleware/rateLimitMiddleware.js';

describe('Phase 7.1 — Admin Authentication & Session Hardening Verification', () => {
  let app;
  let server;
  let baseUrl;
  let adminUser;

  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  before(async () => {
    await connectDB();

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;

    await User.deleteMany({ email: /auth_sec_test_.*@dhiyonitutorials.com/ });
    adminUser = await User.create({
      username: 'Auth Hardened Admin',
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
      role: 'admin',
      tokenVersion: 0,
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await User.deleteMany({ email: /auth_sec_test_.*@dhiyonitutorials.com/ });
    await mongoose.connection.close();
  });

  beforeEach(() => {
    resetRateLimits();
  });

  async function req(method, pathUrl, headers = {}, body = null) {
    const opts = { method, headers: { 'content-type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${pathUrl}`, opts);
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {}
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      rawHeaders: res.headers,
      json,
      text,
    };
  }

  // =========================================================================
  // 1. Dual-Transport Login (Token in Body + HttpOnly Cookie)
  // =========================================================================
  test('1. Login returns token, sets HttpOnly cookie, and specifies Cache-Control: no-store', async () => {
    const res = await req('POST', '/login', {}, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token, 'Must return token in body');
    assert.strictEqual(res.json.email, 'auth_sec_test_admin@dhiyonitutorials.com');

    // Verify Set-Cookie header contains HttpOnly and SameSite=Lax
    const setCookie = res.headers['set-cookie'] || '';
    assert.ok(setCookie.includes('dhiyoni_admin_session'), 'Set-Cookie must contain dhiyoni_admin_session');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'), 'Cookie must be SameSite=Lax');

    // Verify Cache-Control
    const cacheControl = res.headers['cache-control'] || '';
    assert.ok(cacheControl.includes('no-store'), 'Must enforce Cache-Control: no-store');
  });

  // =========================================================================
  // 2. Cookie-Only Authentication
  // =========================================================================
  test('2. Protect middleware authenticates via HttpOnly session cookie without Bearer header', async () => {
    // 1. Login to get cookie
    const loginRes = await req('POST', '/login', {}, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });
    const setCookie = loginRes.headers['set-cookie'];
    const sessionCookie = setCookie.split(';')[0]; // "dhiyoni_admin_session=..."

    // 2. Request profile sending ONLY Cookie header
    const profileRes = await req('GET', '/profile', {
      cookie: sessionCookie,
    });

    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.json.username, 'Auth Hardened Admin');
  });

  // =========================================================================
  // 3. Bearer Header Backward Compatibility
  // =========================================================================
  test('3. Protect middleware remains backward-compatible with Bearer header without cookies', async () => {
    const loginRes = await req('POST', '/login', {}, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });
    const token = loginRes.json.token;

    const profileRes = await req('GET', '/profile', {
      authorization: `Bearer ${token}`,
    });

    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.json.username, 'Auth Hardened Admin');
  });

  // =========================================================================
  // 4. Password Change Token Revocation (Session Invalidation)
  // =========================================================================
  test('4. Password update immediately revokes existing active sessions across all devices', async () => {
    // 1. Log in to get active session
    const loginRes = await req('POST', '/login', {}, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });
    const oldToken = loginRes.json.token;

    // 2. Update password
    const updateRes = await req(
      'PUT',
      '/password',
      { authorization: `Bearer ${oldToken}` },
      {
        currentPassword: 'StrongAdminPassword123!',
        newPassword: 'BrandNewAdminPassword456!',
      }
    );
    assert.strictEqual(updateRes.status, 200);
    assert.ok(updateRes.json.token, 'Must return new refreshed token');
    const newToken = updateRes.json.token;

    // 3. Old token must now be REJECTED (401 session invalidated)
    const oldTokenRes = await req('GET', '/profile', {
      authorization: `Bearer ${oldToken}`,
    });
    assert.strictEqual(oldTokenRes.status, 401);
    assert.ok(oldTokenRes.json.message.includes('invalidated'));

    // 4. New token must be ACCEPTED
    const newTokenRes = await req('GET', '/profile', {
      authorization: `Bearer ${newToken}`,
    });
    assert.strictEqual(newTokenRes.status, 200);

    // Reset password back for subsequent tests
    await req(
      'PUT',
      '/password',
      { authorization: `Bearer ${newToken}` },
      {
        currentPassword: 'BrandNewAdminPassword456!',
        newPassword: 'StrongAdminPassword123!',
      }
    );
  });

  // =========================================================================
  // 5. Logout Session Invalidation
  // =========================================================================
  test('5. Logout invalidates server-side session and clears cookie', async () => {
    const loginRes = await req('POST', '/login', {}, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });
    const token = loginRes.json.token;

    // Logout
    const logoutRes = await req('POST', '/logout', {
      authorization: `Bearer ${token}`,
    });
    assert.strictEqual(logoutRes.status, 200);

    // Old token should now be invalidated
    const postLogoutProfileRes = await req('GET', '/profile', {
      authorization: `Bearer ${token}`,
    });
    assert.strictEqual(postLogoutProfileRes.status, 401);
  });

  // =========================================================================
  // 6. Login Brute-Force Rate Limiting (HTTP 429)
  // =========================================================================
  test('6. Brute-force rate limiting blocks client after 5 consecutive failed login attempts', async () => {
    // 5 failed attempts
    for (let i = 1; i <= 5; i++) {
      const failRes = await req('POST', '/login', { 'x-test-rate-limit': 'true' }, {
        email: 'auth_sec_test_admin@dhiyonitutorials.com',
        password: `WrongPassword_${i}`,
      });
      assert.strictEqual(failRes.status, 401);
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await req('POST', '/login', { 'x-test-rate-limit': 'true' }, {
      email: 'auth_sec_test_admin@dhiyonitutorials.com',
      password: 'StrongAdminPassword123!',
    });
    assert.strictEqual(blockedRes.status, 429);
    assert.ok(blockedRes.json.message.includes('Too many login attempts'));
    assert.ok(blockedRes.headers['retry-after']);
  });
});
