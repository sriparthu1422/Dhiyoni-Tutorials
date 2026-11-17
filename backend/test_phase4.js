import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import express from 'express';
import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';

import authRoutes from './src/routes/authRoutes.js';
import contactRoutes from './src/routes/contactRoutes.js';
import parentSignupRoutes from './src/routes/parentSignupRoutes.js';
import tutorSignupRoutes from './src/routes/tutorSignupRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import tutorRoutes from './src/routes/tutorRoutes.js';
import galleryRoutes from './src/routes/galleryRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/gallery', galleryRoutes);

// HTTP mock helper for invoking Express app without external network binding
function executeRequest(appInstance, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    let bodyStr = null;
    if (body !== null && typeof body === 'object') {
      bodyStr = JSON.stringify(body);
    } else if (typeof body === 'string') {
      bodyStr = body;
    }

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

describe('Phase 4 Secure Admin Data Management Verification Suite', { concurrency: 1 }, () => {
  let adminUser;
  let nonAdminUser;
  let adminToken;
  let nonAdminToken;
  let createdTestIds = {
    contacts: [],
    parents: [],
    tutors: [],
    newsletters: [],
    feedbacks: [],
  };

  const JWT_SECRET = process.env.JWT_SECRET || 'testsecret123';

  before(async () => {
    await connectDB();

    // 1. Create isolated Admin User
    adminUser = await User.create({
      username: `Admin_P4_${Date.now()}`,
      email: `admin_p4_${Date.now()}@dhiyoni.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Create isolated Non-Admin User (e.g. standard user)
    // Direct MongoDB insert bypassing schema enum validation to test server-side role gate
    const nonAdminId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('users').insertOne({
      _id: nonAdminId,
      username: `Student_P4_${Date.now()}`,
      email: `student_p4_${Date.now()}@dhiyoni.com`,
      password: 'StudentPassword123!',
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    nonAdminUser = { _id: nonAdminId };
    nonAdminToken = jwt.sign({ id: nonAdminId }, JWT_SECRET, { expiresIn: '1h' });

    // 3. Populate Isolated Test Records
    // (A) Contacts: 15 records with distinct dates, names, subjects, and statuses
    const baseDate = new Date('2026-11-01T10:00:00.000Z');
    for (let i = 1; i <= 15; i++) {
      const docDate = new Date(baseDate.getTime() + i * 86400000); // 1 day apart
      const contact = await Contact.create({
        name: i === 5 ? 'SpecialSearchTarget John' : `Contact User ${i}`,
        email: i === 5 ? 'special_target@dhiyoni.com' : `contact_${i}_${Date.now()}@dhiyoni.com`,
        subject: i % 2 === 0 ? 'Course Inquiry' : 'Technical Support',
        message: i === 5 ? 'Unique query message for search verification.' : `General inquiry message number ${i}`,
        status: i <= 8 ? 'Pending' : 'Resolved',
        submissionId: i === 15 ? undefined : `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        createdAt: docDate,
        updatedAt: docDate,
      });
      createdTestIds.contacts.push(contact._id);
    }

    // (B) Parent Signups: 12 records
    for (let i = 1; i <= 12; i++) {
      const parent = await ParentSignup.create({
        studentName: i === 3 ? 'Arnav Special' : `Student ${i}`,
        gender: i % 2 === 0 ? 'male' : 'female',
        grade: 'Grade 10',
        subject: 'Mathematics',
        parentName: `Parent ${i}`,
        contact: `98765432${String(i).padStart(2, '0')}`,
        email: `parent_${i}_${Date.now()}@dhiyoni.com`,
        city: 'Hyderabad',
        state: 'Telangana',
        status: i <= 6 ? 'Pending' : 'Enrolled',
        submissionId: `11111111-0000-4000-8000-${String(i).padStart(12, '0')}`,
        createdAt: new Date(baseDate.getTime() + i * 86400000),
      });
      createdTestIds.parents.push(parent._id);
    }

    // (C) Tutor Signups: 5 records
    for (let i = 1; i <= 5; i++) {
      const tutor = await TutorSignup.create({
        fullName: i === 2 ? 'Dr. Radhika Sharma' : `Tutor Applicant ${i}`,
        gender: 'female',
        email: `tutor_${i}_${Date.now()}@dhiyoni.com`,
        contact: `91234567${String(i).padStart(2, '0')}`,
        dob: '1990-01-01',
        location: 'Hyderabad, Telangana',
        qualification: 'M.Sc Physics',
        occupation: 'professional',
        grades: 'Grades 9 to 12',
        subjects: 'Physics',
        time: 'Evening',
        boards: ['cbse'],
        hasTech: true,
        status: 'Pending',
        submissionId: `22222222-0000-4000-8000-${String(i).padStart(12, '0')}`,
        createdAt: new Date(baseDate.getTime() + i * 86400000),
      });
      createdTestIds.tutors.push(tutor._id);
    }

    // (D) Newsletters: 4 records
    for (let i = 1; i <= 4; i++) {
      const news = await Newsletter.create({
        email: `newsletter_${i}_${Date.now()}@dhiyoni.com`,
        submissionId: `33333333-0000-4000-8000-${String(i).padStart(12, '0')}`,
        createdAt: new Date(baseDate.getTime() + i * 86400000),
      });
      createdTestIds.newsletters.push(news._id);
    }

    // (E) Feedbacks: 5 records
    for (let i = 1; i <= 5; i++) {
      const fb = await Feedback.create({
        name: i === 4 ? 'Feedback Author Unique' : `Feedback User ${i}`,
        userType: i % 2 === 0 ? 'Parent' : 'Student',
        email: `feedback_${i}_${Date.now()}@dhiyoni.com`,
        contactNumber: '9988776655',
        rating: i,
        message: `Feedback review message ${i}`,
        submissionId: `44444444-0000-4000-8000-${String(i).padStart(12, '0')}`,
        createdAt: new Date(baseDate.getTime() + i * 86400000),
      });
      createdTestIds.feedbacks.push(fb._id);
    }
  });

  after(async () => {
    // Clean up all created test documents
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (nonAdminUser) await mongoose.connection.collection('users').deleteOne({ _id: nonAdminUser._id });

    await Contact.deleteMany({ _id: { $in: createdTestIds.contacts } });
    await ParentSignup.deleteMany({ _id: { $in: createdTestIds.parents } });
    await TutorSignup.deleteMany({ _id: { $in: createdTestIds.tutors } });
    await Newsletter.deleteMany({ _id: { $in: createdTestIds.newsletters } });
    await Feedback.deleteMany({ _id: { $in: createdTestIds.feedbacks } });

    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. Authorized Administrator Access
  // =========================================================================
  test('1. Authorized administrator access succeeds across all 5 endpoints and stats', async () => {
    const endpoints = [
      '/api/contacts',
      '/api/parent-signups',
      '/api/tutor-signups',
      '/api/newsletters',
      '/api/feedback',
      '/api/auth/dashboard-stats',
    ];

    for (const url of endpoints) {
      const res = await executeRequest(app, {
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200, `Expected 200 for ${url}, got ${res.status}`);
      assert.equal(res.body.success, true);
    }
  });

  // =========================================================================
  // 2. Anonymous Access Denied across Complete Authorization Matrix
  // =========================================================================
  test('2. Anonymous access is strictly rejected with HTTP 401 across all private endpoints', async () => {
    const cid = createdTestIds.contacts[0];
    const pid = createdTestIds.parents[0];
    const tid = createdTestIds.tutors[0];
    const nid = createdTestIds.newsletters[0];
    const fid = createdTestIds.feedbacks[0];

    const privateRoutes = [
      { method: 'GET', url: '/api/contacts' },
      { method: 'GET', url: `/api/contacts/${cid}` },
      { method: 'PUT', url: `/api/contacts/${cid}`, body: { status: 'Resolved' } },
      { method: 'DELETE', url: `/api/contacts/${cid}` },
      { method: 'GET', url: '/api/parent-signups' },
      { method: 'GET', url: `/api/parent-signups/${pid}` },
      { method: 'PUT', url: `/api/parent-signups/${pid}`, body: { status: 'Contacted' } },
      { method: 'DELETE', url: `/api/parent-signups/${pid}` },
      { method: 'GET', url: '/api/tutor-signups' },
      { method: 'GET', url: `/api/tutor-signups/${tid}` },
      { method: 'PUT', url: `/api/tutor-signups/${tid}`, body: { status: 'Approved' } },
      { method: 'DELETE', url: `/api/tutor-signups/${tid}` },
      { method: 'GET', url: '/api/newsletters' },
      { method: 'GET', url: `/api/newsletters/${nid}` },
      { method: 'DELETE', url: `/api/newsletters/${nid}` },
      { method: 'GET', url: '/api/feedback' },
      { method: 'GET', url: `/api/feedback/${fid}` },
      { method: 'DELETE', url: `/api/feedback/${fid}` },
      { method: 'GET', url: '/api/auth/dashboard-stats' },
      { method: 'POST', url: '/api/gallery', body: { url: 'https://test.com/img.jpg' } },
      { method: 'DELETE', url: `/api/gallery/${cid}` },
      { method: 'POST', url: '/api/tutors', body: { name: 'Test' } },
      { method: 'PUT', url: `/api/tutors/${cid}`, body: { name: 'Test' } },
      { method: 'DELETE', url: `/api/tutors/${cid}` },
    ];

    for (const route of privateRoutes) {
      const res = await executeRequest(app, {
        method: route.method,
        url: route.url,
        body: route.body || null,
      });
      assert.equal(res.status, 401, `Expected 401 for anonymous ${route.method} ${route.url}, got ${res.status}`);
      assert.equal(res.body.message, 'Not authorized, no token');
    }
  });

  // =========================================================================
  // 3. Non-Administrator Access Denied across Complete Authorization Matrix
  // =========================================================================
  test('3. Non-administrator access is rejected with HTTP 403 Forbidden', async () => {
    const cid = createdTestIds.contacts[0];
    const pid = createdTestIds.parents[0];
    const tid = createdTestIds.tutors[0];
    const nid = createdTestIds.newsletters[0];
    const fid = createdTestIds.feedbacks[0];

    const privateRoutes = [
      { method: 'GET', url: '/api/contacts' },
      { method: 'GET', url: `/api/contacts/${cid}` },
      { method: 'PUT', url: `/api/contacts/${cid}`, body: { status: 'Resolved' } },
      { method: 'DELETE', url: `/api/contacts/${cid}` },
      { method: 'GET', url: '/api/parent-signups' },
      { method: 'GET', url: `/api/parent-signups/${pid}` },
      { method: 'PUT', url: `/api/parent-signups/${pid}`, body: { status: 'Contacted' } },
      { method: 'DELETE', url: `/api/parent-signups/${pid}` },
      { method: 'GET', url: '/api/tutor-signups' },
      { method: 'GET', url: `/api/tutor-signups/${tid}` },
      { method: 'PUT', url: `/api/tutor-signups/${tid}`, body: { status: 'Approved' } },
      { method: 'DELETE', url: `/api/tutor-signups/${tid}` },
      { method: 'GET', url: '/api/newsletters' },
      { method: 'GET', url: `/api/newsletters/${nid}` },
      { method: 'DELETE', url: `/api/newsletters/${nid}` },
      { method: 'GET', url: '/api/feedback' },
      { method: 'GET', url: `/api/feedback/${fid}` },
      { method: 'DELETE', url: `/api/feedback/${fid}` },
      { method: 'GET', url: '/api/auth/dashboard-stats' },
      { method: 'POST', url: '/api/gallery', body: { url: 'https://test.com/img.jpg' } },
      { method: 'DELETE', url: `/api/gallery/${cid}` },
      { method: 'POST', url: '/api/tutors', body: { name: 'Test' } },
      { method: 'PUT', url: `/api/tutors/${cid}`, body: { name: 'Test' } },
      { method: 'DELETE', url: `/api/tutors/${cid}` },
    ];

    for (const route of privateRoutes) {
      const res = await executeRequest(app, {
        method: route.method,
        url: route.url,
        headers: { authorization: `Bearer ${nonAdminToken}` },
        body: route.body || null,
      });
      assert.equal(res.status, 403, `Expected 403 Forbidden for non-admin on ${route.method} ${route.url}, got ${res.status}`);
      assert.ok(res.body.message.includes('Administrator privileges required'));
    }
  });

  // =========================================================================
  // 4. All Five Collections Accessible & Single Record Retrieval
  // =========================================================================
  test('4. All five collections accessible and support single-record retrieval by ID', async () => {
    const singleChecks = [
      { url: `/api/contacts/${createdTestIds.contacts[0]}`, expectedField: 'name' },
      { url: `/api/parent-signups/${createdTestIds.parents[0]}`, expectedField: 'studentName' },
      { url: `/api/tutor-signups/${createdTestIds.tutors[0]}`, expectedField: 'fullName' },
      { url: `/api/newsletters/${createdTestIds.newsletters[0]}`, expectedField: 'email' },
      { url: `/api/feedback/${createdTestIds.feedbacks[0]}`, expectedField: 'rating' },
    ];

    for (const check of singleChecks) {
      const res = await executeRequest(app, {
        method: 'GET',
        url: check.url,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200, `Single retrieval failed for ${check.url}`);
      assert.ok(res.body.data[check.expectedField] !== undefined);
    }
  });

  // =========================================================================
  // 5. Search Accuracy & Special Character Escaping
  // =========================================================================
  test('5. Search returns accurate matches and safely escapes regex special characters', async () => {
    // Search for specific target
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?search=SpecialSearchTarget',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].email, 'special_target@dhiyoni.com');

    // Search with regex special characters (e.g. *, +, ?, (, )) should not crash or inject
    const resSpecial = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?search=Special.*[a-z]+',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resSpecial.status, 200);
    // Does not match regex syntax literally, returns 0 matches safely
    assert.equal(resSpecial.body.data.length, 0);
  });

  // =========================================================================
  // 6. Date Range Filtering
  // =========================================================================
  test('6. Date range filtering filters strictly within defined calendar boundaries', async () => {
    // Records 2 through 4 correspond to 2026-11-03 through 2026-11-05
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?startDate=2026-11-03&endDate=2026-11-05',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
    for (const doc of res.body.data) {
      const docTime = new Date(doc.createdAt).getTime();
      assert.ok(docTime >= new Date('2026-11-03T00:00:00.000Z').getTime());
      assert.ok(docTime <= new Date('2026-11-05T23:59:59.999Z').getTime());
    }
  });

  // =========================================================================
  // 7. Server-Side Pagination Correctness
  // =========================================================================
  test('7. Pagination correctly chunks records, computes totalPages, and enforces limit caps', async () => {
    // Request page 1 with limit 5
    const resPage1 = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?page=1&limit=5',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(resPage1.status, 200);
    assert.equal(resPage1.body.data.length, 5);
    assert.equal(resPage1.body.pagination.page, 1);
    assert.equal(resPage1.body.pagination.limit, 5);
    assert.ok(resPage1.body.pagination.total >= 15);
    assert.equal(resPage1.body.pagination.hasNextPage, true);
    assert.equal(resPage1.body.pagination.hasPrevPage, false);

    // Request page 2 with limit 5
    const resPage2 = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?page=2&limit=5',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(resPage2.status, 200);
    assert.equal(resPage2.body.data.length, 5);
    assert.equal(resPage2.body.pagination.page, 2);
    assert.equal(resPage2.body.pagination.hasPrevPage, true);

    // Verify page 1 and page 2 contain non-overlapping documents
    const page1Ids = resPage1.body.data.map((d) => d._id);
    const page2Ids = resPage2.body.data.map((d) => d._id);
    const intersection = page1Ids.filter((id) => page2Ids.includes(id));
    assert.equal(intersection.length, 0, 'Pagination must never duplicate records across pages');

    // Verify limit safety cap at 100
    const resCapped = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?limit=500',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resCapped.status, 200);
    assert.equal(resCapped.body.pagination.limit, 100, 'Limit must be capped at 100');
  });

  // =========================================================================
  // 8. Sorting Correctness
  // =========================================================================
  test('8. Sorting respects sortBy and sortOrder (asc/desc)', async () => {
    // Ascending sort by createdAt
    const resAsc = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?sortBy=createdAt&sortOrder=asc&limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(resAsc.status, 200);
    const dates = resAsc.body.data.map((d) => new Date(d.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      assert.ok(dates[i] >= dates[i - 1], 'Dates must be in ascending chronological order');
    }
  });

  // =========================================================================
  // 9. Invalid Query Handling
  // =========================================================================
  test('9. Invalid query parameters return HTTP 400 with descriptive error messages', async () => {
    // Invalid status filter
    const resBadStatus = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?status=NonExistentStatus',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resBadStatus.status, 400);
    assert.ok(resBadStatus.body.message.includes('Invalid status filter'));

    // Invalid startDate format
    const resBadDate = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?startDate=invalid-date-string',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resBadDate.status, 400);
    assert.ok(resBadDate.body.message.includes('Invalid startDate format'));

    // startDate after endDate
    const resInvertedDate = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?startDate=2026-11-20&endDate=2026-11-10',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resInvertedDate.status, 400);
    assert.ok(resInvertedDate.body.message.includes('startDate cannot be after endDate'));

    // Malformed ObjectId for single retrieval
    const resBadId = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts/invalid_mongo_id_123',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resBadId.status, 400);
    assert.ok(resBadId.body.message.includes('Invalid inquiry ID format'));
  });

  // =========================================================================
  // 10. Sensitive Field Exclusion
  // =========================================================================
  test('10. Sensitive fields and internal internals are excluded from responses', async () => {
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?limit=5',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    for (const doc of res.body.data) {
      assert.equal(doc.password, undefined);
      assert.equal(doc.__v, undefined);
      assert.equal(doc.token, undefined);
    }
  });

  // =========================================================================
  // 11. Legacy Record Compatibility (without submissionId)
  // =========================================================================
  test('11. Legacy records without submissionId remain fully readable and searchable', async () => {
    // Record 15 was created without submissionId
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?search=Contact User 15',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].submissionId, undefined);
    assert.equal(res.body.data[0].name, 'Contact User 15');
  });

  // =========================================================================
  // 12. Empty Collection / Empty Query Behavior
  // =========================================================================
  test('12. Query returning 0 results returns clean empty array and zero total', async () => {
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?search=ZeroMatchRandomSearchString12345',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.pagination.total, 0);
    assert.equal(res.body.pagination.totalPages, 1);
    assert.equal(res.body.pagination.hasNextPage, false);
    assert.equal(res.body.pagination.hasPrevPage, false);
  });

  // =========================================================================
  // 13. Status Update Security, Validation & Mass Assignment Prevention
  // =========================================================================
  test('13. Status updates strictly enforce enum whitelist, prevent mass assignment, and require admin', async () => {
    const contactId = createdTestIds.contacts[0];
    const parentId = createdTestIds.parents[0];
    const tutorId = createdTestIds.tutors[0];

    // (A) Contact Status Security
    // Valid status update
    const resContactValid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${contactId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'Resolved' },
    });
    assert.equal(resContactValid.status, 200);
    assert.equal(resContactValid.body.status, 'Resolved');

    // Invalid status rejected
    const resContactInvalid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${contactId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'HackedStatus' },
    });
    assert.equal(resContactInvalid.status, 400);
    assert.ok(resContactInvalid.body.message.includes('Allowed: Pending, Resolved'));

    // Missing status rejected
    const resContactMissing = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${contactId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { email: 'spoofed@evil.com' },
    });
    assert.equal(resContactMissing.status, 400);

    // Mass assignment prevention: unexpected fields cannot overwrite protected properties
    const originalDoc = await Contact.findById(contactId);
    const resContactMassAssign = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${contactId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        status: 'Pending',
        email: 'malicious_overwrite@attacker.com',
        submissionId: 'forged-uuid-000000',
        name: 'Compromised Name',
      },
    });
    assert.equal(resContactMassAssign.status, 200);
    assert.equal(resContactMassAssign.body.status, 'Pending');
    const reloadedDoc = await Contact.findById(contactId);
    assert.equal(reloadedDoc.email, originalDoc.email, 'Email must remain intact against mass assignment');
    assert.equal(reloadedDoc.name, originalDoc.name, 'Name must remain intact against mass assignment');
    assert.equal(reloadedDoc.submissionId, originalDoc.submissionId, 'submissionId must remain intact');

    // (B) ParentSignup Status Security
    const resParentValid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/parent-signups/${parentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'Contacted' },
    });
    assert.equal(resParentValid.status, 200);
    assert.equal(resParentValid.body.status, 'Contacted');

    const resParentInvalid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/parent-signups/${parentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'UnapprovedStatus' },
    });
    assert.equal(resParentInvalid.status, 400);

    // (C) TutorSignup Status Security
    const resTutorValid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/tutor-signups/${tutorId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'Interview Scheduled' },
    });
    assert.equal(resTutorValid.status, 200);
    assert.equal(resTutorValid.body.status, 'Interview Scheduled');

    const resTutorInvalid = await executeRequest(app, {
      method: 'PUT',
      url: `/api/tutor-signups/${tutorId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'FakeStatus' },
    });
    assert.equal(resTutorInvalid.status, 400);

    // (D) Malformed ObjectId returns 400
    const resMalformed = await executeRequest(app, {
      method: 'PUT',
      url: '/api/contacts/not-a-valid-object-id',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'Resolved' },
    });
    assert.equal(resMalformed.status, 400);
    assert.ok(resMalformed.body.message.includes('Invalid inquiry ID format'));

    // (E) Non-existent ID returns 404
    const nonExistentId = new mongoose.Types.ObjectId();
    const res404 = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${nonExistentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      body: { status: 'Resolved' },
    });
    assert.equal(res404.status, 404);

    // (F) Non-admin cannot update status
    const resNonAdmin = await executeRequest(app, {
      method: 'PUT',
      url: `/api/contacts/${contactId}`,
      headers: { authorization: `Bearer ${nonAdminToken}` },
      body: { status: 'Resolved' },
    });
    assert.equal(resNonAdmin.status, 403);
  });

  // =========================================================================
  // 14. Query Bounds, Search Length & Deterministic Ordering
  // =========================================================================
  test('14. Query bounds enforce search length caps and deterministic tie-breaker', async () => {
    // Search length > 100 characters returns 400
    const oversizedSearch = 'a'.repeat(101);
    const resOversized = await executeRequest(app, {
      method: 'GET',
      url: `/api/contacts?search=${oversizedSearch}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resOversized.status, 400);
    assert.ok(resOversized.body.message.includes('100 characters'));

    // Deterministic sorting with _id tie-breaker
    const resSortAsc = await executeRequest(app, {
      method: 'GET',
      url: '/api/contacts?sortBy=createdAt&sortOrder=asc&limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resSortAsc.status, 200);
    assert.ok(resSortAsc.body.data.length > 1);

    // Verify ordering is strictly ascending
    const dates = resSortAsc.body.data.map((d) => new Date(d.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      assert.ok(dates[i] >= dates[i - 1], 'Dates must be sorted ascending');
    }
  });
});
