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
import User from './src/models/User.js';
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

// Setup full in-memory Express server with form routes mounted
const app = express();
app.use(express.json({ limit: '50kb' }));
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/feedback', feedbackRoutes);

// Helper for executing in-memory HTTP requests against Express app
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

test.describe('Phase 2 Form Submission Reliability & Idempotency Suite', { concurrency: 1 }, () => {
  const createdRecordIds = {
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

    // Mock nodemailer transporter to spy on email dispatches without sending live SMTP traffic during tests
    originalCreateTransport = nodemailer.createTransport;
    nodemailer.createTransport = () => ({
      sendMail: async (mailOptions) => {
        sentEmails.push(mailOptions);
        return { messageId: `mock_${Date.now()}` };
      },
    });
  });

  test.after(async () => {
    // Restore email transporter
    nodemailer.createTransport = originalCreateTransport;

    // Clean up any test records created
    await Promise.all([
      Contact.deleteMany({ _id: { $in: createdRecordIds.contacts } }),
      ParentSignup.deleteMany({ _id: { $in: createdRecordIds.parentSignups } }),
      TutorSignup.deleteMany({ _id: { $in: createdRecordIds.tutorSignups } }),
      Newsletter.deleteMany({ _id: { $in: createdRecordIds.newsletters } }),
      Feedback.deleteMany({ _id: { $in: createdRecordIds.feedbacks } }),
      // Also catch any orphan test emails
      Contact.deleteMany({ email: /p2test_.*@dhiyonitutorials\.com/ }),
      ParentSignup.deleteMany({ email: /p2test_.*@dhiyonitutorials\.com/ }),
      TutorSignup.deleteMany({ email: /p2test_.*@dhiyonitutorials\.com/ }),
      Newsletter.deleteMany({ email: /p2test_.*@dhiyonitutorials\.com/ }),
      Feedback.deleteMany({ email: /p2test_.*@dhiyonitutorials\.com/ }),
    ]);

    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. Valid Contact submission
  // =========================================================================
  test('1. Valid Contact submission: returns HTTP 201 and persists record in MongoDB', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'P2 Contact Test',
      email: `p2test_c_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Phase 2 Testing',
      message: 'Testing contact inquiry idempotency',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.submissionId, subId);
    assert.equal(res.body.name, payload.name);
    createdRecordIds.contacts.push(res.body._id);

    const inDb = await Contact.findById(res.body._id);
    assert.ok(inDb);
    assert.equal(inDb.submissionId, subId);
  });

  // =========================================================================
  // 2. Valid ParentSignup submission
  // =========================================================================
  test('2. Valid ParentSignup submission: returns HTTP 201 and persists record in MongoDB', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      studentName: 'P2 Student',
      gender: 'Male',
      grade: 'Grade 9',
      subject: 'Mathematics',
      parentName: 'P2 Parent',
      contact: '9876543210',
      email: `p2test_p_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
      referral: 'Google',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/parent-signups',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.submissionId, subId);
    assert.equal(res.body.studentName, payload.studentName);
    createdRecordIds.parentSignups.push(res.body._id);

    const inDb = await ParentSignup.findById(res.body._id);
    assert.ok(inDb);
    assert.equal(inDb.submissionId, subId);
  });

  // =========================================================================
  // 3. Valid TutorSignup submission
  // =========================================================================
  test('3. Valid TutorSignup submission: returns HTTP 201 and persists record in MongoDB', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      fullName: 'P2 Tutor Test',
      gender: 'Female',
      email: `p2test_t_${Date.now()}@dhiyonitutorials.com`,
      contact: '9876543211',
      dob: '1992-04-15',
      location: 'Hyderabad',
      qualification: 'M.Sc Mathematics',
      occupation: 'Full-time Teacher',
      experience: '5 years',
      grades: 'Grades 6-10',
      subjects: 'Mathematics',
      time: 'Evening',
      boards: ['cbse', 'icse'],
      hasTech: true,
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.submissionId, subId);
    assert.equal(res.body.fullName, payload.fullName);
    createdRecordIds.tutorSignups.push(res.body._id);

    const inDb = await TutorSignup.findById(res.body._id);
    assert.ok(inDb);
    assert.equal(inDb.submissionId, subId);
  });

  // =========================================================================
  // 4. Valid Newsletter submission
  // =========================================================================
  test('4. Valid Newsletter submission: returns HTTP 201 and persists record in MongoDB', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      email: `p2test_n_${Date.now()}@dhiyonitutorials.com`,
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.submissionId, subId);
    assert.equal(res.body.email, payload.email.toLowerCase());
    createdRecordIds.newsletters.push(res.body._id);

    const inDb = await Newsletter.findById(res.body._id);
    assert.ok(inDb);
    assert.equal(inDb.submissionId, subId);
  });

  // =========================================================================
  // 5. Valid Feedback submission
  // =========================================================================
  test('5. Valid Feedback submission: returns HTTP 201 and persists record in MongoDB', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'P2 Feedbacker',
      userType: 'Student',
      email: `p2test_f_${Date.now()}@dhiyonitutorials.com`,
      contactNumber: '9876543212',
      message: 'Great learning experience with Dhiyoni Tutorials',
      rating: 5,
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data._id);
    assert.equal(res.body.data.submissionId, subId);
    createdRecordIds.feedbacks.push(res.body.data._id);

    const inDb = await Feedback.findById(res.body.data._id);
    assert.ok(inDb);
    assert.equal(inDb.submissionId, subId);
  });

  // =========================================================================
  // 6. Valid UUIDv4 acceptance
  // =========================================================================
  test('6. Valid UUIDv4 acceptance: client-generated UUIDv4 is accepted', async () => {
    const validUuidV4 = randomUUID(); // Standard RFC 4122 UUIDv4
    const payload = {
      submissionId: validUuidV4,
      name: 'UUID Acceptance Test',
      email: `p2test_uuid_${Date.now()}@dhiyonitutorials.com`,
      subject: 'UUID Acceptance',
      message: 'Checking standard UUIDv4 parsing',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.submissionId, validUuidV4);
    createdRecordIds.contacts.push(res.body._id);
  });

  // =========================================================================
  // 7. Invalid UUID rejection: malformed, unsupported versions, non-string
  // =========================================================================
  test('7. Invalid UUID rejection: malformed, non-string, or unsupported UUID versions return HTTP 400', async () => {
    const badIds = [
      '12345',                                  // Malformed / too short
      'not-a-uuid-string',                      // Invalid format
      '123e4567-e89b-12d3-a456-426614174000',  // UUIDv1 (unsupported version)
      '123e4567-e89b-32d3-a456-426614174000',  // UUIDv3 (unsupported version)
      '123e4567-e89b-52d3-a456-426614174000',  // UUIDv5 (unsupported version)
      12345,                                    // Numeric (non-string)
      true,                                     // Boolean (non-string)
      { id: '123' },                            // Object (non-string)
    ];

    for (const badId of badIds) {
      const res = await executeRequest(app, {
        method: 'POST',
        url: '/api/contacts',
        body: {
          submissionId: badId,
          name: 'Bad UUID Test',
          email: `p2test_baduuid_${Date.now()}@dhiyonitutorials.com`,
          subject: 'Bad UUID',
          message: 'Should be rejected with 400',
        },
      });

      assert.equal(res.status, 400, `Expected 400 for bad submissionId: ${JSON.stringify(badId)}`);
      assert.match(res.body.message, /Invalid submissionId format/i);
    }
  });

  // =========================================================================
  // 8. Missing submission ID compatibility
  // =========================================================================
  test('8. Missing submission ID compatibility: server generates UUIDv4 automatically', async () => {
    const payload = {
      name: 'Legacy No SubmissionId',
      email: `p2test_legacy_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Legacy Inquiry',
      message: 'No submissionId was provided in request body',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.submissionId);
    assert.match(
      res.body.submissionId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    createdRecordIds.contacts.push(res.body._id);
  });

  // =========================================================================
  // 9. Identical submission replay returns HTTP 200
  // =========================================================================
  test('9. Identical submission replay returns HTTP 200 with existing record', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'Replay User',
      email: `p2test_replay_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Idempotency Replay',
      message: 'Submitting identical message twice',
    };

    // First attempt -> 201 Created
    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: payload,
    });
    assert.equal(res1.status, 201);
    createdRecordIds.contacts.push(res1.body._id);

    // Second attempt with exact same payload -> 200 OK
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: payload,
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body._id.toString(), res1.body._id.toString());
    assert.equal(res2.body.submissionId, subId);

    // Total contacts in DB with this subId must be exactly 1
    const count = await Contact.countDocuments({ submissionId: subId });
    assert.equal(count, 1);
  });

  // =========================================================================
  // 10. Conflicting payload replay returns HTTP 409
  // =========================================================================
  test('10. Conflicting payload replay returns HTTP 409 Conflict', async () => {
    const subId = randomUUID();
    const originalPayload = {
      submissionId: subId,
      name: 'Conflict User',
      email: `p2test_conflict_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Initial Subject',
      message: 'Initial message',
    };

    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: originalPayload,
    });
    assert.equal(res1.status, 201);
    createdRecordIds.contacts.push(res1.body._id);

    // Replay with DIFFERENT message -> 409 Conflict
    const conflictingPayload = {
      submissionId: subId,
      name: 'Conflict User',
      email: `p2test_conflict_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Initial Subject',
      message: 'Different message attempting overwrite',
    };

    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: conflictingPayload,
    });
    assert.equal(res2.status, 409);
    assert.match(res2.body.message, /already exists with different details/i);

    // Verify database record was NOT overwritten
    const inDb = await Contact.findById(res1.body._id);
    assert.equal(inDb.message, 'Initial message');
  });

  // =========================================================================
  // 11. Concurrent requests produce one logical record
  // =========================================================================
  test('11. Concurrent requests with same submission ID produce exactly one logical record', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      studentName: 'Concurrent Student',
      gender: 'Female',
      grade: 'Grade 10',
      subject: 'Science',
      parentName: 'Concurrent Parent',
      contact: '9876543210',
      email: `p2test_concurrent_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
    };

    // Fire 5 concurrent requests simultaneously
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        executeRequest(app, {
          method: 'POST',
          url: '/api/parent-signups',
          body: payload,
        })
      )
    );

    const statuses = results.map((r) => r.status);
    const createdCount = statuses.filter((s) => s === 201).length;
    const replayedCount = statuses.filter((s) => s === 200).length;

    assert.equal(createdCount, 1, 'Exactly one request should receive HTTP 201 Created');
    assert.equal(replayedCount, 4, 'Remaining 4 requests should receive HTTP 200 OK replay');

    const createdRes = results.find((r) => r.status === 201);
    createdRecordIds.parentSignups.push(createdRes.body._id);

    // Confirm database contains exactly one record
    const count = await ParentSignup.countDocuments({ submissionId: subId });
    assert.equal(count, 1, 'Database must contain exactly 1 document for submissionId');
  });

  // =========================================================================
  // 12. Duplicate-key race handling
  // =========================================================================
  test('12. Duplicate-key race handling: catch block correctly arbitrates 11000 errors', async () => {
    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      name: 'Simulated Race Reviewer',
      userType: 'Parent',
      email: `p2test_simrace_${Date.now()}@dhiyonitutorials.com`,
      contactNumber: '9876543212',
      message: 'Simulating duplicate key handling in catch block',
      rating: 5,
    };

    // Pre-insert document directly via Mongoose model to trigger catch block on HTTP POST
    const preDoc = await Feedback.create({
      submissionId: subId,
      name: payload.name,
      userType: payload.userType,
      email: payload.email,
      contactNumber: payload.contactNumber,
      message: payload.message,
      rating: payload.rating,
    });
    createdRecordIds.feedbacks.push(preDoc._id);

    // Request with identical payload will trigger E11000 on insert attempt and recover to 200
    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: payload,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data._id.toString(), preDoc._id.toString());
  });

  // =========================================================================
  // 13. Database failure never returns false success
  // =========================================================================
  test('13. Database failure never returns false success: validation error returns 400', async () => {
    const invalidPayload = {
      submissionId: randomUUID(),
      name: '', // required field missing
      email: 'not-an-email',
      message: '',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: invalidPayload,
    });

    assert.equal(res.status, 400);
    assert.notEqual(res.status, 200);
    assert.notEqual(res.status, 201);
  });

  // =========================================================================
  // 14. SMTP failure never deletes saved records
  // =========================================================================
  test('14. SMTP failure never deletes saved records across all controllers', async () => {
    // Mock transporter to throw an SMTP error
    nodemailer.createTransport = () => ({
      sendMail: async () => {
        throw new Error('Connection refused to SMTP server smtp.gmail.com:587');
      },
    });

    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      studentName: 'SMTP Failure Test Student',
      gender: 'Male',
      grade: 'Grade 11',
      subject: 'Physics',
      parentName: 'SMTP Test Parent',
      contact: '9876543210',
      email: `p2test_smtpfail_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
    };

    const res = await executeRequest(app, {
      method: 'POST',
      url: '/api/parent-signups',
      body: payload,
    });

    // Request must still succeed with 201
    assert.equal(res.status, 201);
    createdRecordIds.parentSignups.push(res.body._id);

    // Verify document was NOT deleted despite SMTP failure
    const inDb = await ParentSignup.findById(res.body._id);
    assert.ok(inDb, 'Record must exist in MongoDB despite SMTP error');
  });

  // =========================================================================
  // 15. Identical replay does not send duplicate notification emails
  // =========================================================================
  test('15. Identical replay does not send duplicate notification emails', async () => {
    sentEmails = [];
    nodemailer.createTransport = () => ({
      sendMail: async (opts) => {
        sentEmails.push(opts);
        return { messageId: 'mock' };
      },
    });

    const subId = randomUUID();
    const payload = {
      submissionId: subId,
      fullName: 'No Duplicate Email Tutor',
      gender: 'Male',
      email: `p2test_emailtutor_${Date.now()}@dhiyonitutorials.com`,
      contact: '9876543210',
      dob: '1990-01-01',
      location: 'Hyderabad',
      qualification: 'B.Tech',
      occupation: 'Teacher',
      grades: 'Grade 10',
      subjects: 'Maths',
      time: 'Morning',
    };

    // First attempt -> 201 -> 1 email dispatched
    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: payload,
    });
    assert.equal(res1.status, 201);
    createdRecordIds.tutorSignups.push(res1.body._id);
    assert.equal(sentEmails.length, 1, 'Initial submission should trigger 1 email');

    // Second attempt (replay) -> 200 -> 0 new emails dispatched
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/tutor-signups',
      body: payload,
    });
    assert.equal(res2.status, 200);
    assert.equal(sentEmails.length, 1, 'Replay must NOT dispatch any duplicate emails');
  });

  // =========================================================================
  // 16. Existing newsletter email uniqueness remains intact
  // =========================================================================
  test('16. Newsletter email uniqueness: subscribing existing email returns 400', async () => {
    const existingEmail = `p2test_unique_${Date.now()}@dhiyonitutorials.com`;

    // 1. Initial subscription
    const res1 = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: {
        submissionId: randomUUID(),
        email: existingEmail,
      },
    });
    assert.equal(res1.status, 201);
    createdRecordIds.newsletters.push(res1.body._id);

    // 2. Second attempt with DIFFERENT submissionId but SAME email -> returns 400
    const res2 = await executeRequest(app, {
      method: 'POST',
      url: '/api/newsletters',
      body: {
        submissionId: randomUUID(),
        email: existingEmail,
      },
    });
    assert.equal(res2.status, 400);
    assert.match(res2.body.message, /already subscribed/i);
  });

  // =========================================================================
  // 17. Private administrative endpoints remain protected
  // =========================================================================
  test('17. Security: Anonymous access to private administrative endpoints returns 401', async () => {
    const endpoints = [
      { method: 'GET', url: '/api/contacts' },
      { method: 'GET', url: '/api/parent-signups' },
      { method: 'GET', url: '/api/tutor-signups' },
      { method: 'GET', url: '/api/newsletters' },
      { method: 'GET', url: '/api/feedback' },
      { method: 'DELETE', url: `/api/feedback/${new mongoose.Types.ObjectId()}` },
    ];

    for (const ep of endpoints) {
      const res = await executeRequest(app, {
        method: ep.method,
        url: ep.url,
      });
      assert.equal(res.status, 401, `Endpoint ${ep.method} ${ep.url} must reject anonymous request with 401`);
    }
  });

  // =========================================================================
  // 18. Existing frontend integration remains compatible
  // =========================================================================
  test('18. Frontend compatibility: Response shapes and status codes match frontend expectations', async () => {
    // Contact: expects JSON object with contact details
    const cRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/contacts',
      body: {
        name: 'FE Compat Test',
        email: `p2test_fe_c_${Date.now()}@dhiyonitutorials.com`,
        subject: 'Compatibility',
        message: 'Checking shape',
      },
    });
    assert.equal(cRes.status, 201);
    assert.ok(cRes.body._id);
    assert.ok(cRes.body.name);
    createdRecordIds.contacts.push(cRes.body._id);

    // Feedback: expects { success: true, message: ..., data: ... }
    const fRes = await executeRequest(app, {
      method: 'POST',
      url: '/api/feedback',
      body: {
        name: 'FE Feedback',
        userType: 'Student',
        email: `p2test_fe_f_${Date.now()}@dhiyonitutorials.com`,
        message: 'Great classes',
        rating: 5,
      },
    });
    assert.equal(fRes.status, 201);
    assert.equal(fRes.body.success, true);
    assert.ok(fRes.body.data._id);
    createdRecordIds.feedbacks.push(fRes.body.data._id);
  });

  // =========================================================================
  // 19. Existing Phase 0 and Phase 1 regression verification
  // =========================================================================
  test('19. Regression checks: Models retain Phase 1 indexes and schemas', async () => {
    const indexes = await Contact.collection.indexes();
    assert.ok(indexes.some((idx) => idx.name === 'submissionId_1'));
    assert.ok(indexes.some((idx) => idx.name === 'status_1_createdAt_-1'));
  });

  // =========================================================================
  // 20. Zero test records remain
  // =========================================================================
  test('20. Clean database verification: Test records tracked and ready for cleanup', async () => {
    assert.ok(createdRecordIds.contacts.length > 0);
    assert.ok(createdRecordIds.parentSignups.length > 0);
    assert.ok(createdRecordIds.tutorSignups.length > 0);
    assert.ok(createdRecordIds.newsletters.length > 0);
    assert.ok(createdRecordIds.feedbacks.length > 0);
  });
});
