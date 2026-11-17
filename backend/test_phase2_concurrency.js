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
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';

import contactRoutes from './src/routes/contactRoutes.js';
import parentSignupRoutes from './src/routes/parentSignupRoutes.js';
import tutorSignupRoutes from './src/routes/tutorSignupRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';

// Setup full in-memory Express server
const app = express();
app.use(express.json({ limit: '50kb' }));
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/feedback', feedbackRoutes);

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

test.describe('Task 2 — Full 5-Form Concurrency & Idempotency Verification Suite', { concurrency: 1 }, () => {
  const trackedIds = {
    contacts: [],
    parentSignups: [],
    tutorSignups: [],
    newsletters: [],
    feedbacks: [],
  };

  let originalCreateTransport;
  let sentEmails = [];

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
      Contact.deleteMany({ _id: { $in: trackedIds.contacts } }),
      ParentSignup.deleteMany({ _id: { $in: trackedIds.parentSignups } }),
      TutorSignup.deleteMany({ _id: { $in: trackedIds.tutorSignups } }),
      Newsletter.deleteMany({ _id: { $in: trackedIds.newsletters } }),
      Feedback.deleteMany({ _id: { $in: trackedIds.feedbacks } }),
      Contact.deleteMany({ email: /conc_.*@dhiyonitutorials\.com/ }),
      ParentSignup.deleteMany({ email: /conc_.*@dhiyonitutorials\.com/ }),
      TutorSignup.deleteMany({ email: /conc_.*@dhiyonitutorials\.com/ }),
      Newsletter.deleteMany({ email: /conc_.*@dhiyonitutorials\.com/ }),
      Feedback.deleteMany({ email: /conc_.*@dhiyonitutorials\.com/ }),
    ]);

    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. Contact Form: Concurrent Replay and Conflict
  // =========================================================================
  test('1. Contact Form: 5 concurrent identical requests yield 1 record; conflicting returns 409', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'Conc Contact',
      email: `conc_c_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Concurrency Test',
      message: '5 simultaneous contact requests',
    };

    // 5 simultaneous requests
    const resList = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, { method: 'POST', url: '/api/contacts', body: payload })
      )
    );

    const statuses = resList.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1, 'Exactly one 201 Created');
    assert.equal(statuses.filter((s) => s === 200).length, 4, 'Remaining four 200 OK replays');

    const created = resList.find((r) => r.status === 201);
    trackedIds.contacts.push(created.body._id);

    // Verify DB count is exactly 1
    const count = await Contact.countDocuments({ submissionId: subId });
    assert.equal(count, 1, 'Final MongoDB record count must be exactly 1');

    // Conflicting request with same subId
    const conflictRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: { ...payload, message: 'Altered message to test conflict' },
    });
    assert.equal(conflictRes.status, 409, 'Conflicting payload must return 409');
  });

  // =========================================================================
  // 2. ParentSignup Form: Concurrent Replay, Conflict, and Zero Duplicate Emails
  // =========================================================================
  test('2. ParentSignup Form: 5 concurrent requests yield 1 record, 0 duplicate emails; conflict returns 409', async () => {
    sentEmails = [];
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      studentName: 'Conc Student',
      gender: 'Female',
      grade: 'Grade 8',
      subject: 'Science',
      parentName: 'Conc Parent',
      contact: '9876543210',
      email: `conc_p_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
    };

    const resList = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, { method: 'POST', url: '/api/parent-signups', body: payload })
      )
    );

    const statuses = resList.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 200).length, 4);

    const created = resList.find((r) => r.status === 201);
    trackedIds.parentSignups.push(created.body._id);

    // Verify exactly 1 email was sent for 5 concurrent requests
    assert.equal(sentEmails.length, 1, 'Exactly one notification email must be sent');

    const count = await ParentSignup.countDocuments({ submissionId: subId });
    assert.equal(count, 1);

    // Conflicting request
    const conflictRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/parent-signups',
      body: { ...payload, studentName: 'Altered Student Name' },
    });
    assert.equal(conflictRes.status, 409);
    assert.equal(sentEmails.length, 1, 'No new email sent on conflict');
  });

  // =========================================================================
  // 3. TutorSignup Form: Concurrent Replay, Conflict, and Zero Duplicate Emails
  // =========================================================================
  test('3. TutorSignup Form: 5 concurrent requests yield 1 record, 0 duplicate emails; conflict returns 409', async () => {
    sentEmails = [];
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      fullName: 'Conc Tutor',
      gender: 'Male',
      email: `conc_t_${Date.now()}@dhiyonitutorials.com`,
      contact: '9876543211',
      dob: '1991-03-20',
      location: 'Hyderabad',
      qualification: 'B.Ed',
      occupation: 'Teacher',
      grades: 'Grades 6-10',
      subjects: 'Social Studies',
      time: 'Evening',
      boards: ['cbse'],
      hasTech: true,
    };

    const resList = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, { method: 'POST', url: '/api/tutor-signups', body: payload })
      )
    );

    const statuses = resList.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 200).length, 4);

    const created = resList.find((r) => r.status === 201);
    trackedIds.tutorSignups.push(created.body._id);

    assert.equal(sentEmails.length, 1, 'Exactly one notification email sent for 5 tutor requests');

    const count = await TutorSignup.countDocuments({ submissionId: subId });
    assert.equal(count, 1);

    // Conflicting request
    const conflictRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: { ...payload, location: 'Bangalore' },
    });
    assert.equal(conflictRes.status, 409);
  });

  // =========================================================================
  // 4. Newsletter Form: Concurrent Replay, Email Uniqueness, and Conflict
  // =========================================================================
  test('4. Newsletter Form: 5 concurrent requests yield 1 record; duplicate email rejected with 400', async () => {
    const subId = randomUUID();
    const email = `conc_n_${Date.now()}@dhiyonitutorials.com`;
    const payload = { submissionId: subId, email };

    const resList = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, { method: 'POST', url: '/api/newsletters', body: payload })
      )
    );

    const statuses = resList.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 200).length, 4);

    const created = resList.find((r) => r.status === 201);
    trackedIds.newsletters.push(created.body._id);

    const count = await Newsletter.countDocuments({ submissionId: subId });
    assert.equal(count, 1);

    // Concurrent request with same subId but different email -> 409
    const conflictRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: { submissionId: subId, email: `conc_diff_${Date.now()}@dhiyonitutorials.com` },
    });
    assert.equal(conflictRes.status, 409);

    // Concurrent request with different subId but same email -> 400 (Newsletter unique email rule)
    const duplicateEmailRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: { submissionId: randomUUID(), email },
    });
    assert.equal(duplicateEmailRes.status, 400);
    assert.match(duplicateEmailRes.body.message, /already subscribed/i);
  });

  // =========================================================================
  // 5. Feedback Form: Concurrent Replay, Conflict, and Zero Duplicate Emails
  // =========================================================================
  test('5. Feedback Form: 5 concurrent requests yield 1 record, 0 duplicate emails; conflict returns 409', async () => {
    sentEmails = [];
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'Conc Feedbacker',
      userType: 'Student',
      email: `conc_f_${Date.now()}@dhiyonitutorials.com`,
      contactNumber: '9876543212',
      message: 'Great classes',
      rating: 5,
    };

    const resList = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, { method: 'POST', url: '/api/feedback', body: payload })
      )
    );

    const statuses = resList.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 200).length, 4);

    const created = resList.find((r) => r.status === 201);
    trackedIds.feedbacks.push(created.body.data._id);

    assert.equal(sentEmails.length, 1, 'Exactly one notification email sent for 5 feedback requests');

    const count = await Feedback.countDocuments({ submissionId: subId });
    assert.equal(count, 1);

    // Conflicting request
    const conflictRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: { ...payload, rating: 3 },
    });
    assert.equal(conflictRes.status, 409);
    assert.equal(conflictRes.body.success, false);
    assert.equal(sentEmails.length, 1);
  });
});

