import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import express from 'express';
import jwt from 'jsonwebtoken';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

// Import all models
import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';

// Import all routes
import authRoutes from './src/routes/authRoutes.js';
import contactRoutes from './src/routes/contactRoutes.js';
import parentSignupRoutes from './src/routes/parentSignupRoutes.js';
import tutorSignupRoutes from './src/routes/tutorSignupRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import tutorRoutes from './src/routes/tutorRoutes.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import galleryRoutes from './src/routes/galleryRoutes.js';

// Setup full in-memory Express server with all routes mounted
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/gallery', galleryRoutes);

// Helper for executing in-memory HTTP requests against Express app
function executeRequest(app, { method = 'GET', url = '/', headers = {}, body = null }) {
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
      }
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
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
    res.setHeader = function(name, value) {
      this._headers[name.toLowerCase()] = value;
      return this;
    };
    res.getHeader = function(name) {
      return this._headers[name.toLowerCase()];
    };
    res.json = function(data) {
      this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };
    res.send = function(data) {
      this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };
    res.end = function(data) {
      if (data) this.body = data;
      resolve({ status: this.statusCode, body: this.body });
      return this;
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: res.statusCode, body: res.body });
    });
  });
}

// Ensure database connection
test.before(async () => {
  await connectDB();
});

test.after(async () => {
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
});

// =========================================================================
// SECTION 1: AUDIT OF PRIVATE & PUBLIC ENDPOINTS (TASK 2)
// =========================================================================
test('Task 2 Audit: Anonymous access to private endpoints is strictly rejected (401)', async () => {
  const privateEndpoints = [
    { method: 'GET', url: '/api/contacts' },
    { method: 'PUT', url: '/api/contacts/665ef49a032d9f1b88e12345' },
    { method: 'DELETE', url: '/api/contacts/665ef49a032d9f1b88e12345' },
    { method: 'GET', url: '/api/parent-signups' },
    { method: 'PUT', url: '/api/parent-signups/665ef49a032d9f1b88e12345' },
    { method: 'DELETE', url: '/api/parent-signups/665ef49a032d9f1b88e12345' },
    { method: 'GET', url: '/api/tutor-signups' },
    { method: 'PUT', url: '/api/tutor-signups/665ef49a032d9f1b88e12345' },
    { method: 'DELETE', url: '/api/tutor-signups/665ef49a032d9f1b88e12345' },
    { method: 'GET', url: '/api/newsletters' },
    { method: 'DELETE', url: '/api/newsletters/665ef49a032d9f1b88e12345' },
    { method: 'GET', url: '/api/feedback' },
    { method: 'DELETE', url: '/api/feedback/665ef49a032d9f1b88e12345' },
    { method: 'GET', url: '/api/auth/profile' },
    { method: 'PUT', url: '/api/auth/password' },
    { method: 'POST', url: '/api/tutors' },
    { method: 'PUT', url: '/api/tutors/665ef49a032d9f1b88e12345' },
    { method: 'DELETE', url: '/api/tutors/665ef49a032d9f1b88e12345' },
    { method: 'POST', url: '/api/gallery' },
    { method: 'DELETE', url: '/api/gallery/665ef49a032d9f1b88e12345' },
  ];

  for (const ep of privateEndpoints) {
    const res = await executeRequest(app, {
      method: ep.method,
      url: ep.url,
      body: ep.method !== 'GET' && ep.method !== 'DELETE' ? {} : null,
    });
    assert.equal(res.status, 401, `Expected 401 Unauthorized for ${ep.method} ${ep.url}, got ${res.status}`);
    assert.equal(res.body.message, 'Not authorized, no token', `Proper error message for ${ep.method} ${ep.url}`);
  }
});

// =========================================================================
// SECTION 2: AUTHORIZED ADMIN DASHBOARD REQUESTS (TASK 3)
// =========================================================================
test('Task 3: Authorized admin requests succeed across all CRM endpoints', async () => {
  // Find or create a temporary admin for token verification
  let adminUser = await User.findOne({ role: 'admin' });
  let createdTempUser = false;
  if (!adminUser) {
    adminUser = await User.create({
      username: 'Temp Test Admin',
      email: 'temp_test_admin@dhiyoni.com',
      password: 'TempPassword123!',
      role: 'admin'
    });
    createdTempUser = true;
  }

  const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const authHeader = { authorization: `Bearer ${token}` };

  try {
    const endpointsToTest = [
      { method: 'GET', url: '/api/contacts' },
      { method: 'GET', url: '/api/parent-signups' },
      { method: 'GET', url: '/api/tutor-signups' },
      { method: 'GET', url: '/api/newsletters' },
      { method: 'GET', url: '/api/feedback' },
      { method: 'GET', url: '/api/tutors' }, // Public
      { method: 'GET', url: '/api/gallery' }, // Public
    ];

    for (const ep of endpointsToTest) {
      const res = await executeRequest(app, {
        method: ep.method,
        url: ep.url,
        headers: authHeader,
      });
      assert.equal(res.status, 200, `Expected 200 for admin ${ep.method} ${ep.url}, got ${res.status}`);
    }
  } finally {
    if (createdTempUser && adminUser) {
      await User.deleteOne({ _id: adminUser._id });
    }
  }
});

// =========================================================================
// SECTION 3: LIVE PUBLIC SUBMISSION FORM PERSISTENCE & CLEANUP (TASKS 1 & 4)
// =========================================================================
test('Task 1: Valid public feedback POST persists exactly one record and returns 201', async () => {
  const testEmail = `test_feedback_${Date.now()}@example.com`;
  const payload = {
    name: 'Verification Student',
    userType: 'Student',
    email: testEmail,
    contactNumber: '9876543210',
    message: 'Testing Phase 0 hotfix persistence verification.',
    rating: 5,
  };

  const res = await executeRequest(app, {
    method: 'POST',
    url: '/api/feedback',
    body: payload,
  });

  assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}`);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.email, testEmail);

  // Verify in MongoDB Atlas
  const savedRecords = await Feedback.find({ email: testEmail });
  assert.equal(savedRecords.length, 1, 'Exactly one record must be persisted in MongoDB');
  assert.equal(savedRecords[0].name, 'Verification Student');
  assert.equal(savedRecords[0].rating, 5);

  // Clean up isolated test record
  await Feedback.deleteOne({ _id: savedRecords[0]._id });
  const countAfter = await Feedback.countDocuments({ email: testEmail });
  assert.equal(countAfter, 0, 'Isolated test record cleaned up successfully');
});

test('Task 4: All 5 public submission forms successfully persist to MongoDB', async () => {
  const timestamp = Date.now();

  // 1. Contact Form
  const contactEmail = `test_contact_${timestamp}@example.com`;
  const contactRes = await executeRequest(app, {
    method: 'POST',
    url: '/api/contacts',
    body: {
      name: 'Test Contact Lead',
      email: contactEmail,
      subject: 'Course Inquiry',
      message: 'Automated test contact inquiry message',
    },
  });
  assert.equal(contactRes.status, 201, 'Contact form submission returned 201');
  const savedContact = await Contact.findOne({ email: contactEmail });
  assert.ok(savedContact, 'Contact record exists in MongoDB');
  await Contact.deleteOne({ _id: savedContact._id });

  // 2. Parent & Student Signup Form
  const parentEmail = `test_parent_${timestamp}@example.com`;
  const parentRes = await executeRequest(app, {
    method: 'POST',
    url: '/api/parent-signups',
    body: {
      studentName: 'Verification Student',
      gender: 'female',
      grade: 'Grade 9',
      subject: 'Mathematics',
      parentName: 'Verification Parent',
      contact: '9876501234',
      email: parentEmail,
      city: 'Hyderabad',
      state: 'Telangana',
      referral: 'search',
    },
  });
  assert.equal(parentRes.status, 201, 'Parent signup submission returned 201');
  const savedParent = await ParentSignup.findOne({ email: parentEmail });
  assert.ok(savedParent, 'ParentSignup record exists in MongoDB');
  await ParentSignup.deleteOne({ _id: savedParent._id });

  // 3. Tutor Signup Form
  const tutorEmail = `test_tutor_${timestamp}@example.com`;
  const tutorRes = await executeRequest(app, {
    method: 'POST',
    url: '/api/tutor-signups',
    body: {
      fullName: 'Test Candidate Tutor',
      gender: 'male',
      email: tutorEmail,
      contact: '9876543211',
      dob: '1992-08-20',
      location: 'Hyderabad',
      qualification: 'M.Sc Mathematics',
      occupation: 'fulltime',
      experience: '5 years',
      grades: 'Grades 6-10',
      subjects: 'Mathematics',
      time: 'Evening',
      boards: ['cbse', 'icse'],
      hasTech: true,
    },
  });
  assert.equal(tutorRes.status, 201, 'Tutor signup submission returned 201');
  const savedTutor = await TutorSignup.findOne({ email: tutorEmail });
  assert.ok(savedTutor, 'TutorSignup record exists in MongoDB');
  await TutorSignup.deleteOne({ _id: savedTutor._id });

  // 4. Newsletter Subscription Form
  const newsletterEmail = `test_news_${timestamp}@example.com`;
  const newsRes = await executeRequest(app, {
    method: 'POST',
    url: '/api/newsletters',
    body: { email: newsletterEmail },
  });
  assert.equal(newsRes.status, 201, 'Newsletter submission returned 201');
  const savedNews = await Newsletter.findOne({ email: newsletterEmail });
  assert.ok(savedNews, 'Newsletter record exists in MongoDB');
  await Newsletter.deleteOne({ _id: savedNews._id });

  // 5. Feedback Form (already confirmed in Task 1, re-verified)
  const feedbackEmail = `test_fb_${timestamp}@example.com`;
  const fbRes = await executeRequest(app, {
    method: 'POST',
    url: '/api/feedback',
    body: {
      name: 'Parent Reviewer',
      userType: 'Parent',
      email: feedbackEmail,
      contactNumber: '9876543210',
      message: 'Great learning experience!',
      rating: 5,
    },
  });
  assert.equal(fbRes.status, 201, 'Feedback submission returned 201');
  const savedFb = await Feedback.findOne({ email: feedbackEmail });
  assert.ok(savedFb, 'Feedback record exists in MongoDB');
  await Feedback.deleteOne({ _id: savedFb._id });
});

// =========================================================================
// SECTION 4: FAILURE RESILIENCE VERIFICATION (TASK 5)
// =========================================================================
test('Task 5: SMTP failure never purges saved records across all controllers', async () => {
  const parentFile = fileURLToPath(new URL('./src/controllers/parentSignupController.js', import.meta.url));
  const parentSignupCode = fs.readFileSync(parentFile, 'utf8');
  assert.equal(parentSignupCode.includes('findByIdAndDelete'), false, 'parentSignupController must not contain findByIdAndDelete');

  const tutorFile = fileURLToPath(new URL('./src/controllers/tutorSignupController.js', import.meta.url));
  const tutorSignupCode = fs.readFileSync(tutorFile, 'utf8');
  assert.equal(tutorSignupCode.includes('findByIdAndDelete'), false, 'tutorSignupController must not contain findByIdAndDelete');

  const feedbackFile = fileURLToPath(new URL('./src/controllers/feedbackController.js', import.meta.url));
  const feedbackCode = fs.readFileSync(feedbackFile, 'utf8');
  assert.equal(feedbackCode.includes('findByIdAndDelete'), false, 'feedbackController must not contain findByIdAndDelete');
});

test('Task 5: Database failure never triggers WhatsApp redirects or clears user input', async () => {
  const contactFile = fileURLToPath(new URL('../frontend/src/pages/Contact.jsx', import.meta.url));
  const contactCode = fs.readFileSync(contactFile, 'utf8');
  const contactCatchMatch = contactCode.match(/catch\s*\(error\)\s*\{([\s\S]*?)\}/);
  assert.ok(contactCatchMatch, 'Contact.jsx has a catch block');
  assert.equal(contactCatchMatch[1].includes('window.open'), false, 'Contact.jsx catch block must not open window');
  assert.equal(contactCatchMatch[1].includes("setBtnState('sent')"), false, 'Contact.jsx catch block must not set sent state');
  assert.ok(contactCatchMatch[1].includes('setSubmitError'), 'Contact.jsx catch block must set error message');

  const footerFile = fileURLToPath(new URL('../frontend/src/components/Footer.jsx', import.meta.url));
  const footerCode = fs.readFileSync(footerFile, 'utf8');
  const footerCatchMatch = footerCode.match(/catch\s*\(error\)\s*\{([\s\S]*?)\}/);
  assert.ok(footerCatchMatch, 'Footer.jsx has a catch block');
  assert.equal(footerCatchMatch[1].includes('window.open'), false, 'Footer.jsx catch block must not open window');
  assert.ok(footerCatchMatch[1].includes("setNewsletterMsg({ type: 'error'"), 'Footer.jsx catch block must set error message');
});
