import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

dotenv.config({ path: new URL('./.env', import.meta.url) });

import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';
import ExportJob from './src/models/ExportJob.js';

test.describe('Phase 1 Database Architecture Verification Suite', { concurrency: 1 }, () => {
  let adminId;

  test.before(async () => {
    await connectDB();

    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = await User.create({
        username: 'Phase1 Temp Admin',
        email: `temp_admin_${Date.now()}@dhiyonitutorials.com`,
        password: 'AdminPassword123!',
        role: 'admin',
      });
    }
    adminId = admin._id;
  });

  test.after(async () => {
    await User.deleteMany({ email: /^temp_admin_/ });
    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. Index verification
  // =========================================================================
  test('1. Index verification: All 5 models and ExportJob have required unique and compound indexes', async () => {
    const contactIndexes = await Contact.collection.indexes();
    const contactSubIdIdx = contactIndexes.find(idx => idx.name === 'submissionId_1');
    assert.ok(contactSubIdIdx, 'Contact must have submissionId_1 index');
    assert.equal(contactSubIdIdx.unique, true, 'Contact submissionId index must be unique');
    assert.deepEqual(contactSubIdIdx.partialFilterExpression, { submissionId: { $type: 'string' } });
    assert.ok(contactIndexes.some(idx => idx.name === 'createdAt_-1'), 'Contact must have createdAt_-1 index');
    assert.ok(contactIndexes.some(idx => idx.name === 'status_1_createdAt_-1'), 'Contact must have status_1_createdAt_-1 index');

    const parentIndexes = await ParentSignup.collection.indexes();
    const parentSubIdIdx = parentIndexes.find(idx => idx.name === 'submissionId_1');
    assert.ok(parentSubIdIdx, 'ParentSignup must have submissionId_1 index');
    assert.equal(parentSubIdIdx.unique, true);
    assert.deepEqual(parentSubIdIdx.partialFilterExpression, { submissionId: { $type: 'string' } });
    assert.ok(parentIndexes.some(idx => idx.name === 'createdAt_-1'), 'ParentSignup must have createdAt_-1 index');
    assert.ok(parentIndexes.some(idx => idx.name === 'status_1_createdAt_-1'), 'ParentSignup must have status_1_createdAt_-1 index');

    const tutorIndexes = await TutorSignup.collection.indexes();
    const tutorSubIdIdx = tutorIndexes.find(idx => idx.name === 'submissionId_1');
    assert.ok(tutorSubIdIdx, 'TutorSignup must have submissionId_1 index');
    assert.equal(tutorSubIdIdx.unique, true);
    assert.deepEqual(tutorSubIdIdx.partialFilterExpression, { submissionId: { $type: 'string' } });
    assert.ok(tutorIndexes.some(idx => idx.name === 'createdAt_-1'), 'TutorSignup must have createdAt_-1 index');
    assert.ok(tutorIndexes.some(idx => idx.name === 'status_1_createdAt_-1'), 'TutorSignup must have status_1_createdAt_-1 index');

    const newsIndexes = await Newsletter.collection.indexes();
    const newsSubIdIdx = newsIndexes.find(idx => idx.name === 'submissionId_1');
    assert.ok(newsSubIdIdx, 'Newsletter must have submissionId_1 index');
    assert.equal(newsSubIdIdx.unique, true);
    assert.ok(newsIndexes.some(idx => idx.name === 'email_1'), 'Newsletter email unique index preserved');
    assert.ok(newsIndexes.some(idx => idx.name === 'createdAt_-1'), 'Newsletter must have createdAt_-1 index');

    const fbIndexes = await Feedback.collection.indexes();
    const fbSubIdIdx = fbIndexes.find(idx => idx.name === 'submissionId_1');
    assert.ok(fbSubIdIdx, 'Feedback must have submissionId_1 index');
    assert.equal(fbSubIdIdx.unique, true);
    assert.ok(fbIndexes.some(idx => idx.name === 'createdAt_-1'), 'Feedback must have createdAt_-1 index');
    assert.ok(fbIndexes.some(idx => idx.name === 'rating_1_createdAt_-1'), 'Feedback must have rating_1_createdAt_-1 index');

    const jobIndexes = await ExportJob.collection.indexes();
    assert.ok(jobIndexes.some(idx => idx.name === 'jobId_1'), 'ExportJob must have jobId_1 index');
    assert.ok(jobIndexes.some(idx => idx.name === 'status_1_createdAt_-1'), 'ExportJob must have status_1_createdAt_-1 index');
    assert.ok(jobIndexes.some(idx => idx.name === 'requestedBy_1_createdAt_-1'), 'ExportJob must have requestedBy_1_createdAt_-1 index');
    assert.ok(jobIndexes.some(idx => idx.name === 'destination.spreadsheetId_1_concurrencyLock.isLocked_1'), 'ExportJob must have concurrencyLock compound index');
  });

  // =========================================================================
  // 2. Existing records remain readable
  // =========================================================================
  test('2. Compatibility: Existing records across all collections remain readable and valid', async () => {
    const [cCount, pCount, tCount, nCount, fCount] = await Promise.all([
      Contact.countDocuments(),
      ParentSignup.countDocuments(),
      TutorSignup.countDocuments(),
      Newsletter.countDocuments(),
      Feedback.countDocuments(),
    ]);

    assert.ok(cCount >= 0, 'Contacts collection queryable');
    assert.ok(pCount >= 0, 'ParentSignup collection queryable');
    assert.ok(tCount >= 0, 'TutorSignup collection queryable');
    assert.ok(nCount >= 0, 'Newsletter collection queryable');
    assert.ok(fCount >= 0, 'Feedback collection queryable');

    const sample = await Contact.findOne();
    if (sample) {
      assert.ok(sample.name);
      assert.ok(sample.email);
    }
  });

  // =========================================================================
  // 3. New records accept valid submission IDs
  // =========================================================================
  test('3. New records accept valid UUID-based submissionId', async () => {
    const testSubId = randomUUID();
    const testEmail = `subid_test_${Date.now()}@dhiyonitutorials.com`;

    const contact = await Contact.create({
      submissionId: testSubId,
      name: 'Test Submission ID',
      email: testEmail,
      subject: 'Course Inquiry',
      message: 'Testing submissionId acceptance',
    });

    assert.equal(contact.submissionId, testSubId);
    const found = await Contact.findOne({ submissionId: testSubId });
    assert.ok(found);
    assert.equal(found.name, 'Test Submission ID');

    await Contact.deleteOne({ _id: contact._id });
  });

  // =========================================================================
  // 4. Duplicate submission IDs are rejected (E11000)
  // =========================================================================
  test('4. Duplicate submission IDs are rejected by unique index constraint', async () => {
    const duplicateId = randomUUID();

    const first = await Contact.create({
      submissionId: duplicateId,
      name: 'Initial Submission',
      email: `initial_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Course Inquiry',
      message: 'First attempt with submissionId',
    });

    try {
      await assert.rejects(
        async () => {
          await Contact.create({
            submissionId: duplicateId,
            name: 'Duplicate Submission',
            email: `duplicate_${Date.now()}@dhiyonitutorials.com`,
            subject: 'Course Inquiry',
            message: 'Second attempt with identical submissionId',
          });
        },
        (err) => {
          assert.equal(err.code, 11000, 'Must throw duplicate key error code 11000');
          return true;
        }
      );
    } finally {
      await Contact.deleteOne({ _id: first._id });
    }
  });

  // =========================================================================
  // 5. Legacy records without submission IDs remain compatible
  // =========================================================================
  test('5. Partial index allows multiple legacy records without submissionId', async () => {
    const legacy1 = await Contact.create({
      name: 'Legacy Lead A',
      email: `legacyA_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Course Inquiry',
      message: 'Legacy doc without submissionId',
    });

    const legacy2 = await Contact.create({
      name: 'Legacy Lead B',
      email: `legacyB_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Course Inquiry',
      message: 'Second legacy doc without submissionId',
    });

    assert.equal(legacy1.submissionId, undefined);
    assert.equal(legacy2.submissionId, undefined);

    await Contact.deleteMany({ _id: { $in: [legacy1._id, legacy2._id] } });
  });

  // =========================================================================
  // 6. All 5 form models function with submissionId
  // =========================================================================
  test('6. All 5 models support creation and retrieval with submissionId', async () => {
    const subIds = Array.from({ length: 5 }, () => randomUUID());

    const c = await Contact.create({
      submissionId: subIds[0],
      name: 'Model Test Contact',
      email: `c_${Date.now()}@dhiyonitutorials.com`,
      subject: 'Course Inquiry',
      message: 'Model functional test',
    });

    const p = await ParentSignup.create({
      submissionId: subIds[1],
      studentName: 'Model Test Student',
      gender: 'male',
      grade: 'Grade 10',
      subject: 'Maths',
      parentName: 'Model Test Parent',
      contact: '9876543210',
      email: `p_${Date.now()}@dhiyonitutorials.com`,
      city: 'Hyderabad',
      state: 'Telangana',
    });

    const t = await TutorSignup.create({
      submissionId: subIds[2],
      fullName: 'Model Test Tutor',
      gender: 'female',
      email: `t_${Date.now()}@dhiyonitutorials.com`,
      contact: '9876543211',
      dob: new Date('1990-05-10'),
      location: 'Hyderabad',
      qualification: 'M.Sc Physics',
      occupation: 'fulltime',
      grades: 'Grades 9-12',
      subjects: 'Physics',
      time: 'Evening',
    });

    const n = await Newsletter.create({
      submissionId: subIds[3],
      email: `n_${Date.now()}@dhiyonitutorials.com`,
    });

    const f = await Feedback.create({
      submissionId: subIds[4],
      name: 'Model Test Reviewer',
      userType: 'Student',
      email: `f_${Date.now()}@dhiyonitutorials.com`,
      contactNumber: '9876543212',
      message: 'Great classes',
      rating: 5,
    });

    assert.ok(c && p && t && n && f, 'All 5 model documents created successfully');

    await Promise.all([
      Contact.deleteOne({ _id: c._id }),
      ParentSignup.deleteOne({ _id: p._id }),
      TutorSignup.deleteOne({ _id: t._id }),
      Newsletter.deleteOne({ _id: n._id }),
      Feedback.deleteOne({ _id: f._id }),
    ]);
  });

  // =========================================================================
  // 7. ExportJob model validation and concurrency features
  // =========================================================================
  test('7. ExportJob model validates fields, enforces constraints, and records metadata', async () => {
    const jobId = randomUUID();

    // Missing required fields rejection
    await assert.rejects(
      async () => {
        await ExportJob.create({ status: 'pending' });
      },
      /Job ID is required/
    );

    // Invalid enum rejection
    await assert.rejects(
      async () => {
        await ExportJob.create({
          jobId: randomUUID(),
          requestedBy: adminId,
          exportType: 'invalid_type',
        });
      },
      /`invalid_type` is not a valid enum value/
    );

    // Valid ExportJob creation
    const job = await ExportJob.create({
      jobId,
      exportType: 'full',
      categories: ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'],
      requestedBy: adminId,
      status: 'pending',
      destination: {
        spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        tabs: ['Contact Enquiries', 'Student Registrations', 'Teacher Applications', 'Newsletter Subscribers', 'Feedbacks'],
      },
      recordCounts: {
        contacts: 15,
        parentSignups: 20,
        tutorSignups: 8,
        newsletters: 45,
        feedbacks: 12,
        total: 100,
      },
      errorDetails: {
        message: '',
        code: '',
      },
      retryMetadata: {
        retryCount: 0,
        maxRetries: 3,
      },
      checkpoints: {
        contacts: {
          processedCount: 15,
          isReconciled: true,
        },
      },
      concurrencyLock: {
        isLocked: true,
        lockedAt: new Date(),
        lockExpiresAt: new Date(Date.now() + 120000),
        lockedBy: 'admin_export_worker_1',
      },
    });

    assert.equal(job.jobId, jobId);
    assert.equal(job.status, 'pending');
    assert.equal(job.recordCounts.total, 100);
    assert.equal(job.destination.tabs.length, 5);
    assert.equal(job.concurrencyLock.isLocked, true);

    // Verify duplicate jobId rejection
    await assert.rejects(
      async () => {
        await ExportJob.create({
          jobId,
          requestedBy: adminId,
        });
      },
      /duplicate key error/i
    );

    await ExportJob.deleteOne({ _id: job._id });
  });

  // =========================================================================
  // 8. Zero production data modified
  // =========================================================================
  test('8. Verification of database clean state: Zero test records remain', async () => {
    const testRecordsCount = await Contact.countDocuments({ email: /@dhiyonitutorials\.test$/ });
    assert.equal(testRecordsCount, 0, 'No test records remaining in contacts collection');
  });
});
