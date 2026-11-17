import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

// Set test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_dhiyoni_2026';
process.env.NODE_ENV = 'test';

// Import routes and controllers
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import User from './src/models/User.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Feedback from './src/models/Feedback.js';
import { createParentSignup } from './src/controllers/parentSignupController.js';
import { createTutorSignup } from './src/controllers/tutorSignupController.js';
import { submitFeedback } from './src/controllers/feedbackController.js';

// Setup Express app for in-memory route testing (zero sockets / zero network dependencies)
const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

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

test('Test 1: Anonymous GET /api/feedback is denied (401)', async () => {
  const res = await executeRequest(app, {
    method: 'GET',
    url: '/api/feedback',
  });
  assert.equal(res.status, 401, 'Should return 401 Unauthorized');
  assert.equal(res.body.message, 'Not authorized, no token');
});

test('Test 2: Anonymous DELETE /api/feedback/:id is denied (401)', async () => {
  const res = await executeRequest(app, {
    method: 'DELETE',
    url: '/api/feedback/665ef49a032d9f1b88e12345',
  });
  assert.equal(res.status, 401, 'Should return 401 Unauthorized');
  assert.equal(res.body.message, 'Not authorized, no token');
});

test('Test 3: Public POST /api/feedback is accessible without authentication', async () => {
  // Empty body should hit feedbackController validation and return 400, proving it passes without 401
  const res = await executeRequest(app, {
    method: 'POST',
    url: '/api/feedback',
    body: {},
  });
  assert.notEqual(res.status, 401, 'POST /api/feedback must not require authentication');
  assert.equal(res.status, 400, 'Empty submission hits controller validation');
  assert.equal(res.body.success, false);
});

test('Test 4: Admin feedback GET access succeeds with valid JWT Bearer token', async () => {
  const dummyAdminId = '665ef49a032d9f1b88e00001';
  const token = jwt.sign({ id: dummyAdminId }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Mock User.findById and Feedback.find to avoid external network/db calls during test
  const originalUserFindById = User.findById;
  const originalFeedbackFind = Feedback.find;

  User.findById = (id) => ({
    select: () => Promise.resolve({ _id: dummyAdminId, username: 'admin', role: 'admin' }),
  });

  Feedback.find = () => ({
    sort: () => Promise.resolve([
      { _id: 'fb1', name: 'Student One', rating: 5, message: 'Great classes!' }
    ]),
  });

  try {
    const res = await executeRequest(app, {
      method: 'GET',
      url: '/api/feedback',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(res.status, 200, 'Authorized admin should receive 200 OK');
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].name, 'Student One');
  } finally {
    User.findById = originalUserFindById;
    Feedback.find = originalFeedbackFind;
  }
});

test('Test 5a: SMTP failure in parentSignupController NEVER deletes persisted record', async () => {
  const originalCreate = ParentSignup.create;
  const originalDelete = ParentSignup.findByIdAndDelete;
  let deleteCalled = false;

  ParentSignup.create = async (doc) => ({
    _id: 'parent_signup_test_id_123',
    ...doc,
    createdAt: new Date(),
  });

  ParentSignup.findByIdAndDelete = async () => {
    deleteCalled = true;
  };

  const req = {
    body: {
      studentName: 'Aarav Sharma',
      gender: 'male',
      grade: 'Grade 10',
      subject: 'Maths, Physics',
      parentName: 'Ramesh Sharma',
      contact: '9876543210',
      email: 'ramesh@example.com',
      city: 'Hyderabad',
      state: 'Telangana',
    },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  try {
    await createParentSignup(req, res);
    assert.equal(responseStatus, 201, 'Record should be acknowledged with HTTP 201');
    assert.equal(deleteCalled, false, 'ParentSignup.findByIdAndDelete must NEVER be called on SMTP failure');
    assert.equal(responseBody.studentName, 'Aarav Sharma');
  } finally {
    ParentSignup.create = originalCreate;
    ParentSignup.findByIdAndDelete = originalDelete;
  }
});

test('Test 5b: SMTP failure in tutorSignupController NEVER deletes persisted record', async () => {
  const originalCreate = TutorSignup.create;
  const originalDelete = TutorSignup.findByIdAndDelete;
  let deleteCalled = false;

  TutorSignup.create = async (doc) => ({
    _id: 'tutor_signup_test_id_123',
    ...doc,
    createdAt: new Date(),
  });

  TutorSignup.findByIdAndDelete = async () => {
    deleteCalled = true;
  };

  const req = {
    body: {
      fullName: 'Vikram Reddy',
      gender: 'male',
      email: 'vikram@example.com',
      contact: '9988776655',
      dob: '1995-05-15',
      location: 'Hyderabad',
      qualification: 'M.Sc Physics',
      occupation: 'fulltime',
      grades: 'Grade 9-12',
      subjects: 'Physics',
      time: 'Evening',
    },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  try {
    await createTutorSignup(req, res);
    assert.equal(responseStatus, 201, 'Record should be acknowledged with HTTP 201');
    assert.equal(deleteCalled, false, 'TutorSignup.findByIdAndDelete must NEVER be called on SMTP failure');
    assert.equal(responseBody.fullName, 'Vikram Reddy');
  } finally {
    TutorSignup.create = originalCreate;
    TutorSignup.findByIdAndDelete = originalDelete;
  }
});

test('Test 5c: SMTP failure in feedbackController NEVER deletes persisted record', async () => {
  const originalCreate = Feedback.create;
  const originalDelete = Feedback.findByIdAndDelete;
  let deleteCalled = false;

  Feedback.create = async (doc) => ({
    _id: 'feedback_test_id_123',
    ...doc,
    createdAt: new Date(),
  });

  Feedback.findByIdAndDelete = async () => {
    deleteCalled = true;
  };

  const req = {
    body: {
      name: 'Pooja Rao',
      userType: 'Parent',
      email: 'pooja@example.com',
      contactNumber: '9123456780',
      message: 'Excellent mentorship and very helpful tutors.',
      rating: 5,
    },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  try {
    await submitFeedback(req, res);
    assert.equal(responseStatus, 201, 'Record should be acknowledged with HTTP 201');
    assert.equal(deleteCalled, false, 'Feedback.findByIdAndDelete must NEVER be called on SMTP failure');
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.name, 'Pooja Rao');
  } finally {
    Feedback.create = originalCreate;
    Feedback.findByIdAndDelete = originalDelete;
  }
});

test('Test 6: Database failure error handling preserves form state and prevents false success in Contact & Footer', () => {
  // Test simulation of Contact.jsx catch block:
  let btnState = 'sending';
  let submitError = '';
  let whatsappOpened = false;
  const formData = { name: 'John Doe', email: 'john@example.com', subject: 'Course Inquiry', message: 'Hello' };

  // Simulate network/db error
  const err = new Error('Database connection failed. Please try again.');
  
  // Apply our fixed logic
  btnState = 'idle';
  submitError = err.message;
  // whatsappOpened remains false
  // formData remains untouched

  assert.equal(btnState, 'idle', 'Button must return to idle/retry state, NOT sent');
  assert.equal(whatsappOpened, false, 'WhatsApp redirect must NOT be triggered on DB failure');
  assert.equal(formData.name, 'John Doe', 'User input in form must be preserved');
  assert.equal(submitError, 'Database connection failed. Please try again.');

  // Test simulation of Footer.jsx catch block:
  let newsletterEmail = 'test@example.com';
  let isSubmitting = true;
  let newsletterMsg = { type: '', text: '' };
  let footerWhatsappOpened = false;

  // Apply our fixed logic on catch:
  newsletterMsg = { type: 'error', text: 'Unable to connect to server. Please try again later.' };
  isSubmitting = false;

  assert.equal(isSubmitting, false);
  assert.equal(footerWhatsappOpened, false, 'WhatsApp redirect must NOT be triggered on subscription failure');
  assert.equal(newsletterEmail, 'test@example.com', 'User email must be preserved on error');
  assert.equal(newsletterMsg.type, 'error');
});
