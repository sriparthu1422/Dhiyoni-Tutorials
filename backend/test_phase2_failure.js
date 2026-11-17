import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import connectDB from './src/config/db.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';

import contactRoutes from './src/routes/contactRoutes.js';
import parentSignupRoutes from './src/routes/parentSignupRoutes.js';
import tutorSignupRoutes from './src/routes/tutorSignupRoutes.js';

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);

function executeRequest(appInstance, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
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
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = Buffer.byteLength(bodyStr).toString();
    }

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
    res.setHeader = function (name, value) {
      this._headers[name.toLowerCase()] = value;
      return this;
    };
    res.getHeader = function (name) {
      return this._headers[name.toLowerCase()];
    };
    res.json = function (data) {
      this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };
    res.send = function (data) {
      this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };
    res.end = function (data) {
      if (data) this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };

    appInstance.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: res.statusCode, body: res.body });
    });
  });
}

test.describe('Task 1 — Database Failure Simulation & Safe Recovery Suite', { concurrency: 1 }, () => {
  let originalCreateTransport;
  let sentEmails = [];
  const testSubIds = [];

  test.before(async () => {
    await connectDB();

    originalCreateTransport = nodemailer.createTransport;
    nodemailer.createTransport = () => ({
      sendMail: async (mailOptions) => {
        sentEmails.push(mailOptions);
        return { messageId: `mock_${Date.now()}` };
      },
    });
  });

  test.after(async () => {
    nodemailer.createTransport = originalCreateTransport;

    await Promise.all([
      Contact.deleteMany({ submissionId: { $in: testSubIds } }),
      ParentSignup.deleteMany({ submissionId: { $in: testSubIds } }),
      TutorSignup.deleteMany({ submissionId: { $in: testSubIds } }),
      Contact.deleteMany({ email: /failtest_.*@dhiyonitutorials\.com/ }),
      ParentSignup.deleteMany({ email: /failtest_.*@dhiyonitutorials\.com/ }),
      TutorSignup.deleteMany({ email: /failtest_.*@dhiyonitutorials\.com/ }),
    ]);

    await mongoose.disconnect();
  });

  // =========================================================================
  // Scenario 1: MongoDB Connection Unavailable Before Submission
  // =========================================================================
  test('Scenario 1: DB connection unavailable returns error, never false 201, sends no email', async () => {
    sentEmails = [];
    const subId = randomUUID();
    testSubIds.push(subId);

    // Simulate database offline by intercepting model create to throw connection error
    const originalCreate = Contact.create;
    Contact.create = async () => {
      throw new Error('MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster.');
    };

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/contacts',
        body: {
          submissionId: subId,
          name: 'DB Unavailable Tester',
          email: `failtest_offline_${Date.now()}@dhiyonitutorials.com`,
          subject: 'Offline Test',
          message: 'Testing server selection timeout',
        },
      });

      assert.notEqual(res.status, 201, 'Must NEVER return HTTP 201 when database is offline');
      assert.ok(res.status === 400 || res.status === 500, `Expected 400/500, got ${res.status}`);
      assert.equal(sentEmails.length, 0, 'Must NEVER send notification email when database is down');
    } finally {
      Contact.create = originalCreate;
    }
  });

  // =========================================================================
  // Scenario 2: Database Write Rejection
  // =========================================================================
  test('Scenario 2: Database write rejection returns error and does not dispatch email', async () => {
    sentEmails = [];
    const subId = randomUUID();
    testSubIds.push(subId);

    const originalCreate = ParentSignup.create;
    ParentSignup.create = async () => {
      const err = new Error('MongoServerError: write error: document failed validation');
      err.code = 121;
      throw err;
    };

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/parent-signups',
        body: {
          submissionId: subId,
          studentName: 'Write Rejection Student',
          gender: 'Male',
          grade: 'Grade 10',
          subject: 'Physics',
          parentName: 'Rejection Parent',
          contact: '9876543210',
          email: `failtest_rej_${Date.now()}@dhiyonitutorials.com`,
          city: 'Hyderabad',
          state: 'Telangana',
        },
      });

      assert.notEqual(res.status, 201, 'Write rejection must not return HTTP 201');
      assert.ok(res.status === 400 || res.status === 500);
      assert.equal(sentEmails.length, 0, 'No email must be dispatched on rejected write');
    } finally {
      ParentSignup.create = originalCreate;
    }
  });

  // =========================================================================
  // Scenario 3: Connection Interruption & Socket Reset During Submission
  // =========================================================================
  test('Scenario 3: Connection interruption during write returns error safely', async () => {
    sentEmails = [];
    const subId = randomUUID();
    testSubIds.push(subId);

    const originalCreate = TutorSignup.create;
    TutorSignup.create = async () => {
      const err = new Error('MongoNetworkError: connection 127.0.0.1:27017 closed');
      throw err;
    };

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/tutor-signups',
        body: {
          submissionId: subId,
          fullName: 'Socket Reset Tutor',
          gender: 'Female',
          email: `failtest_socket_${Date.now()}@dhiyonitutorials.com`,
          contact: '9876543211',
          dob: '1993-01-01',
          location: 'Hyderabad',
          qualification: 'M.Sc',
          occupation: 'Teacher',
          grades: 'Grade 10',
          subjects: 'Chemistry',
          time: 'Evening',
        },
      });

      assert.notEqual(res.status, 201);
      assert.equal(sentEmails.length, 0);
    } finally {
      TutorSignup.create = originalCreate;
    }
  });

  // =========================================================================
  // Scenario 4: Write Acknowledgment Timeout / Uncertain Write Result
  // =========================================================================
  test('Scenario 4: Write timeout returns error safely without unconfirmed success', async () => {
    sentEmails = [];
    const subId = randomUUID();
    testSubIds.push(subId);

    const originalCreate = Contact.create;
    Contact.create = async () => {
      const err = new Error('MongoWaitQueueTimeoutError: Timed out waiting for write concern majority acknowledgment');
      throw err;
    };

    try {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/contacts',
        body: {
          submissionId: subId,
          name: 'Timeout User',
          email: `failtest_timeout_${Date.now()}@dhiyonitutorials.com`,
          subject: 'Timeout Test',
          message: 'Simulating replica set timeout',
        },
      });

      assert.notEqual(res.status, 201, 'Uncertain write must never return 201');
      assert.equal(sentEmails.length, 0, 'Unconfirmed write must never dispatch email');
    } finally {
      Contact.create = originalCreate;
    }
  });

  // =========================================================================
  // Scenario 5: Retry Using the Same submissionId After Recovery
  // =========================================================================
  test('Scenario 5: Post-recovery retry with same submissionId persists cleanly and idempotently', async () => {
    sentEmails = [];
    const subId = randomUUID();
    testSubIds.push(subId);
    const retryPayload = {
      submissionId: subId,
      name: 'Recovered User',
      email: `failtest_retry_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Recovery Test',
      message: 'Initial attempt failed, now retrying after recovery',
    };

    // Step A: First attempt fails due to simulated transient glitch
    const originalCreate = Contact.create;
    Contact.create = async () => {
      throw new Error('MongoServerSelectionError: transient replica set election');
    };

    const failRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: retryPayload,
    });
    assert.notEqual(failRes.status, 201);
    assert.equal(sentEmails.length, 0);

    // Step B: Database recovers (restore real Contact.create)
    Contact.create = originalCreate;

    // Step C: Client retries with EXACT SAME submissionId and payload
    const successRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: retryPayload,
    });

    assert.equal(successRes.status, 201, 'Post-recovery retry must succeed with HTTP 201');
    assert.equal(successRes.body.submissionId, subId);

    // Step D: Confirm exactly ONE record in database
    const count = await Contact.countDocuments({ submissionId: subId });
    assert.equal(count, 1, 'Database must contain exactly 1 document after recovery retry');

    // Step E: Immediate follow-up replay returns 200 OK without duplicate record
    const replayRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: retryPayload,
    });
    assert.equal(replayRes.status, 200, 'Replay after recovery must return 200 OK');
    const finalCount = await Contact.countDocuments({ submissionId: subId });
    assert.equal(finalCount, 1, 'Final document count remains strictly 1');
  });
});

