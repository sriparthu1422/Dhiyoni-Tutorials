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

import { generateUUIDv4 } from '../frontend/src/utils/submissionTracker.js';

// Setup full in-memory Express server matching production backend
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

/**
 * Headless simulation of useSubmissionTracker hook state machine
 */
class HeadlessSubmissionTracker {
  constructor() {
    this.submissionId = null;
    this.lastPayload = null;
  }

  getSubmissionId(payload) {
    const serialized = JSON.stringify(payload);
    if (this.submissionId && this.lastPayload === serialized) {
      return this.submissionId;
    }
    const newId = generateUUIDv4();
    this.submissionId = newId;
    this.lastPayload = serialized;
    return newId;
  }

  reset() {
    this.submissionId = null;
    this.lastPayload = null;
  }

  invalidate() {
    this.submissionId = null;
    this.lastPayload = null;
  }
}

test.describe('Phase 3 Frontend Form Integration Verification Suite', { concurrency: 1 }, () => {
  const trackedRecords = {
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
      Contact.deleteMany({ _id: { $in: trackedRecords.contacts } }),
      ParentSignup.deleteMany({ _id: { $in: trackedRecords.parentSignups } }),
      TutorSignup.deleteMany({ _id: { $in: trackedRecords.tutorSignups } }),
      Newsletter.deleteMany({ _id: { $in: trackedRecords.newsletters } }),
      Feedback.deleteMany({ _id: { $in: trackedRecords.feedbacks } }),
      Contact.deleteMany({ email: /p3test_.*@dhiyonitutorials\.com/ }),
      ParentSignup.deleteMany({ email: /p3test_.*@dhiyonitutorials\.com/ }),
      TutorSignup.deleteMany({ email: /p3test_.*@dhiyonitutorials\.com/ }),
      Newsletter.deleteMany({ email: /p3test_.*@dhiyonitutorials\.com/ }),
      Feedback.deleteMany({ email: /p3test_.*@dhiyonitutorials\.com/ }),
    ]);

    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. UUIDv4 Generation Verification
  // =========================================================================
  test('1. generateUUIDv4: produces valid RFC 4122 UUIDv4 strings', () => {
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (let i = 0; i < 50; i++) {
      const id = generateUUIDv4();
      assert.ok(UUID_V4_REGEX.test(id), `Generated ID "${id}" must conform to RFC 4122 UUIDv4 format`);
    }
  });

  // =========================================================================
  // 2. Submission Tracker: Same ID on Retry, New ID on Payload Change
  // =========================================================================
  test('2. useSubmissionTracker: preserves ID on retry and regenerates on payload change', () => {
    const tracker = new HeadlessSubmissionTracker();
    const payloadA = { name: 'Student A', email: 'a@dhiyonitutorials.com' };
    const payloadB = { name: 'Student A', email: 'b@dhiyonitutorials.com' };

    // Initial attempt
    const id1 = tracker.getSubmissionId(payloadA);
    assert.ok(id1);

    // Retry with identical payload -> must reuse id1
    const id2 = tracker.getSubmissionId(payloadA);
    assert.equal(id2, id1, 'Retry with identical payload must retain the same submissionId');

    // Change payload -> must generate new id
    const id3 = tracker.getSubmissionId(payloadB);
    assert.notEqual(id3, id1, 'Altered payload must generate a new submissionId');

    // Reset tracker on confirmed success
    tracker.reset();
    const id4 = tracker.getSubmissionId(payloadB);
    assert.notEqual(id4, id3, 'Subsequent submission after reset must generate a fresh submissionId');
  });

  // =========================================================================
  // 3. Contact Form: Full Lifecycle with Client UUIDv4 & Safe Retry
  // =========================================================================
  test('3. Contact Form: End-to-end submission, HTTP 200 replay, and duplicate prevention', async () => {
    const tracker = new HeadlessSubmissionTracker();
    const payload = {
      name: 'P3 Contact Lead',
      email: `p3test_c_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Course Inquiry',
      message: 'Testing Phase 3 frontend integration',
    };

    const submissionId = tracker.getSubmissionId(payload);

    // Initial POST -> 201 Created
    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: { ...payload, submissionId },
    });
    assert.equal(res1.status, 201);
    assert.equal(res1.body.submissionId, submissionId);
    trackedRecords.contacts.push(res1.body._id);

    // Simulated retry with identical payload & retained submissionId -> 200 OK
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: { ...payload, submissionId: tracker.getSubmissionId(payload) },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body._id.toString(), res1.body._id.toString());

    // Final MongoDB document count must be 1
    const count = await Contact.countDocuments({ submissionId });
    assert.equal(count, 1);
  });

  // =========================================================================
  // 4. ParentSignup Form: Client UUIDv4, Zero Duplicate Emails
  // =========================================================================
  test('4. ParentSignup Form: Client UUIDv4 lifecycle and zero duplicate emails', async () => {
    sentEmails = [];
    const tracker = new HeadlessSubmissionTracker();
    const payload = {
      studentName: 'P3 Student',
      gender: 'Male',
      grade: 'Grade 10',
      subject: 'Maths, Physics',
      parentName: 'P3 Parent',
      contact: '9876543210',
      email: `p3test_p_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
    };

    const submissionId = tracker.getSubmissionId(payload);

    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/parent-signups',
      body: { ...payload, submissionId },
    });
    assert.equal(res1.status, 201);
    trackedRecords.parentSignups.push(res1.body._id);
    assert.equal(sentEmails.length, 1, 'Initial submission dispatches 1 email');

    // Retry
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/parent-signups',
      body: { ...payload, submissionId: tracker.getSubmissionId(payload) },
    });
    assert.equal(res2.status, 200);
    assert.equal(sentEmails.length, 1, 'Retry must NOT dispatch a second email');

    const count = await ParentSignup.countDocuments({ submissionId });
    assert.equal(count, 1);
  });

  // =========================================================================
  // 5. TutorSignup Form: Client UUIDv4, Normalized Payload & Safe Replay
  // =========================================================================
  test('5. TutorSignup Form: Client UUIDv4 lifecycle and safe replay', async () => {
    sentEmails = [];
    const tracker = new HeadlessSubmissionTracker();
    const payload = {
      fullName: 'P3 Tutor Applicant',
      gender: 'Female',
      email: `p3test_t_${Date.now()}@dhiyonitutorials.com`,
      contact: '9876543211',
      dob: '1992-06-15',
      location: 'Hyderabad',
      qualification: 'M.Sc Chemistry',
      occupation: 'Teacher',
      experience: '4 years',
      grades: 'Grade 9-12',
      subjects: 'Chemistry',
      time: 'Evening',
      boards: ['cbse', 'icse'],
      hasTech: true,
    };

    const submissionId = tracker.getSubmissionId(payload);

    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: { ...payload, submissionId },
    });
    assert.equal(res1.status, 201);
    trackedRecords.tutorSignups.push(res1.body._id);
    assert.equal(sentEmails.length, 1);

    // Retry
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: { ...payload, submissionId: tracker.getSubmissionId(payload) },
    });
    assert.equal(res2.status, 200);
    assert.equal(sentEmails.length, 1);

    const count = await TutorSignup.countDocuments({ submissionId });
    assert.equal(count, 1);
  });

  // =========================================================================
  // 6. Newsletter Form: Client UUIDv4 & Unique Email Rule
  // =========================================================================
  test('6. Newsletter Form: Client UUIDv4 lifecycle and email uniqueness', async () => {
    const tracker = new HeadlessSubmissionTracker();
    const email = `p3test_n_${Date.now()}@dhiyonitutorials.com`;
    const payload = { email };

    const submissionId = tracker.getSubmissionId(payload);

    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: { ...payload, submissionId },
    });
    assert.equal(res1.status, 201);
    trackedRecords.newsletters.push(res1.body._id);

    // Retry with same ID
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: { ...payload, submissionId: tracker.getSubmissionId(payload) },
    });
    assert.equal(res2.status, 200);

    // Duplicate email under new tracker / new ID returns 400
    const newTracker = new HeadlessSubmissionTracker();
    const res3 = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: { email, submissionId: newTracker.getSubmissionId({ email }) },
    });
    assert.equal(res3.status, 400);
    assert.match(res3.body.message, /already subscribed/i);
  });

  // =========================================================================
  // 7. Feedback Form: Client UUIDv4, Replay & Zero Duplicate Emails
  // =========================================================================
  test('7. Feedback Form: Client UUIDv4 lifecycle and zero duplicate emails', async () => {
    sentEmails = [];
    const tracker = new HeadlessSubmissionTracker();
    const payload = {
      name: 'P3 Reviewer',
      userType: 'Student',
      email: `p3test_f_${Date.now()}@dhiyonitutorials.com`,
      contactNumber: '9876543212',
      message: 'Phase 3 feedback integration verified',
      rating: 5,
    };

    const submissionId = tracker.getSubmissionId(payload);

    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: { ...payload, submissionId },
    });
    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    trackedRecords.feedbacks.push(res1.body.data._id);
    assert.equal(sentEmails.length, 1);

    // Retry
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: { ...payload, submissionId: tracker.getSubmissionId(payload) },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.success, true);
    assert.equal(sentEmails.length, 1);

    const count = await Feedback.countDocuments({ submissionId });
    assert.equal(count, 1);
  });

  // =========================================================================
  // 8. Conflict Handling: HTTP 409 and Invalidation
  // =========================================================================
  test('8. Conflict Handling: Altering payload on retained ID yields 409; invalidation generates new ID', async () => {
    const tracker = new HeadlessSubmissionTracker();
    const originalPayload = {
      name: 'Original Contact',
      email: `p3test_conflict_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Initial Subject',
      message: 'Initial message',
    };

    const subId = tracker.getSubmissionId(originalPayload);
    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: { ...originalPayload, submissionId: subId },
    });
    assert.equal(res1.status, 201);
    trackedRecords.contacts.push(res1.body._id);

    // Intentionally send conflicting payload using the SAME subId
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: {
        ...originalPayload,
        message: 'Direct conflicting message',
        submissionId: subId,
      },
    });
    assert.equal(res2.status, 409);
    assert.match(res2.body.message, /already exists with different details/i);

    // Client detects 409 and invalidates tracker
    tracker.invalidate();
    const freshId = tracker.getSubmissionId({
      ...originalPayload,
      message: 'New valid message with fresh ID',
    });
    assert.notEqual(freshId, subId, 'Invalidated tracker must generate a fresh submissionId');

    const res3 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: {
        ...originalPayload,
        message: 'New valid message with fresh ID',
        submissionId: freshId,
      },
    });
    assert.equal(res3.status, 201);
    trackedRecords.contacts.push(res3.body._id);
  });
});
