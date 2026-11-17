import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';

import { getSheetsClient } from './src/services/googleSheetsService.js';
import { acquireSpreadsheetLock, releaseSpreadsheetLock } from './src/services/lockService.js';
import { runExportJob, EXPORT_TABS, TAB_HEADERS } from './src/services/exportEngine.js';

describe('Phase 5 Live Export Verification Suite', () => {
  let sheetsClient;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const adminId = new mongoose.Types.ObjectId();
  const createdRecordIds = {
    contacts: [],
    parentSignups: [],
    tutorSignups: [],
    newsletters: [],
    feedbacks: [],
  };

  const syntheticSubmissionIds = {
    contact: '00000000-0000-4000-8000-111111111111',
    parent: '00000000-0000-4000-8000-222222222222',
    tutor: '00000000-0000-4000-8000-333333333333',
    newsletter: '00000000-0000-4000-8000-444444444444',
    feedback: '00000000-0000-4000-8000-555555555555',
  };

  before(async () => {
    await connectDB();
    sheetsClient = await getSheetsClient();

    // Clean up any stale lock on the spreadsheet
    await SpreadsheetLock.deleteMany({ spreadsheetId });

    // Seed synthetic test records across all 5 collections
    const contactDoc = await Contact.create({
      name: 'Live Test Contact User',
      email: 'livecontact@dhiyonitutorials.com',
      subject: 'Live Testing Math Tuition',
      message: 'This is a synthetic live test message.',
      submissionId: syntheticSubmissionIds.contact,
      status: 'Pending',
    });
    createdRecordIds.contacts.push(contactDoc._id);

    const parentDoc = await ParentSignup.create({
      studentName: 'Aarav LiveStudent',
      gender: 'male',
      grade: 'Grade 10',
      subject: 'Physics',
      parentName: 'Suresh LiveParent',
      contact: '09876543210', // Leading zero test
      email: 'liveparent@dhiyonitutorials.com',
      city: 'Hyderabad',
      state: 'Telangana',
      referral: 'Google Search',
      submissionId: syntheticSubmissionIds.parent,
      status: 'Pending',
    });
    createdRecordIds.parentSignups.push(parentDoc._id);

    const tutorDoc = await TutorSignup.create({
      fullName: 'Dr. Priya LiveTutor',
      gender: 'female',
      email: 'livetutor@dhiyonitutorials.com',
      contact: '+919876543211', // Plus sign test
      dob: '1990-05-15',
      location: 'Madhapur, Hyderabad',
      qualification: 'M.Sc. Mathematics, B.Ed.',
      occupation: 'Professional Tutor',
      experience: '8 Years',
      grades: 'Grades 9-12',
      subjects: 'Mathematics, Statistics',
      time: 'Evening 5 PM - 8 PM',
      boards: ['CBSE', 'ICSE', 'IB'],
      hasTech: true,
      submissionId: syntheticSubmissionIds.tutor,
      status: 'Pending',
    });
    createdRecordIds.tutorSignups.push(tutorDoc._id);

    const newsletterDoc = await Newsletter.create({
      email: 'livenewsletter@dhiyonitutorials.com',
      submissionId: syntheticSubmissionIds.newsletter,
    });
    createdRecordIds.newsletters.push(newsletterDoc._id);

    const feedbackDoc = await Feedback.create({
      name: 'Ramesh LiveReviewer',
      userType: 'Parent',
      email: 'liverating@dhiyonitutorials.com',
      contactNumber: '9876543212',
      rating: 5,
      message: 'Outstanding quality and seamless interface!',
      submissionId: syntheticSubmissionIds.feedback,
    });
    createdRecordIds.feedbacks.push(feedbackDoc._id);
  });

  after(async () => {
    // Clean up synthetic MongoDB records
    await Contact.deleteMany({ _id: { $in: createdRecordIds.contacts } });
    await ParentSignup.deleteMany({ _id: { $in: createdRecordIds.parentSignups } });
    await TutorSignup.deleteMany({ _id: { $in: createdRecordIds.tutorSignups } });
    await Newsletter.deleteMany({ _id: { $in: createdRecordIds.newsletters } });
    await Feedback.deleteMany({ _id: { $in: createdRecordIds.feedbacks } });

    // Clean up locks and test export jobs
    await SpreadsheetLock.deleteMany({ spreadsheetId });
    await ExportJob.deleteMany({ 'destination.spreadsheetId': spreadsheetId, requestedBy: adminId });
    await mongoose.connection.close();
  });

  test('Step 3.1 — Execute Full Real Export to Live Google Spreadsheet', async () => {
    const lock = await acquireSpreadsheetLock(spreadsheetId, 'live_export_job_1', adminId);
    assert.strictEqual(lock.acquired, true, 'Spreadsheet lock must be acquired');

    const job = await ExportJob.create({
      jobId: 'live_exp_' + Date.now(),
      exportType: 'full',
      categories: ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'],
      requestedBy: adminId,
      destination: {
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        tabs: [],
      },
      status: 'pending',
    });

    const completedJob = await runExportJob(job.jobId, lock.ownerToken);
    assert.strictEqual(completedJob.status, 'completed', 'ExportJob must complete successfully');
    assert.ok(completedJob.recordCounts.total >= 5, 'Total exported records must be >= 5');
    assert.strictEqual(completedJob.reconciliation.isReconciled, true, 'Export must reconcile cleanly');
    console.log(`[LIVE EXPORT] Job ${completedJob.jobId} completed successfully! Total records: ${completedJob.recordCounts.total}`);
  });

  test('Step 3.2 — Verify Contact Enquiries tab on live spreadsheet', async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.contacts}'!A1:I`,
    });
    assert.strictEqual(res.status, 200);
    const rows = res.data.values || [];
    assert.ok(rows.length >= 2, 'Contacts tab must contain header and data rows');

    // Verify headers
    assert.deepStrictEqual(rows[0], TAB_HEADERS[EXPORT_TABS.contacts]);

    // Locate synthetic record by submissionId
    const foundRow = rows.find((r) => r[1] === syntheticSubmissionIds.contact);
    assert.ok(foundRow, 'Synthetic contact record must exist in live Google Sheet');
    assert.strictEqual(foundRow[0], createdRecordIds.contacts[0].toString(), 'Column A must match MongoDB ObjectId');
    assert.strictEqual(foundRow[4], 'Live Test Contact User');
    assert.strictEqual(foundRow[5], 'livecontact@dhiyonitutorials.com');
    assert.strictEqual(foundRow[8], 'Pending');
    console.log(`[LIVE VERIFIED] Contact Enquiries tab verified in live spreadsheet`);
  });

  test('Step 3.3 — Verify Parent Registrations tab with leading zero phone number', async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.parentSignups}'!A1:O`,
    });
    assert.strictEqual(res.status, 200);
    const rows = res.data.values || [];
    assert.ok(rows.length >= 2);

    assert.deepStrictEqual(rows[0], TAB_HEADERS[EXPORT_TABS.parentSignups]);

    const foundRow = rows.find((r) => r[1] === syntheticSubmissionIds.parent);
    assert.ok(foundRow, 'Synthetic parent registration must exist in live Google Sheet');
    assert.strictEqual(foundRow[0], createdRecordIds.parentSignups[0].toString());
    assert.strictEqual(foundRow[4], 'Aarav LiveStudent');
    assert.strictEqual(foundRow[8], 'Suresh LiveParent');
    // Verify phone number is preserved verbatim as string with leading zero
    assert.strictEqual(foundRow[9], '09876543210', 'Phone number with leading zero must not be stripped or converted to number');
    assert.strictEqual(foundRow[11], 'Hyderabad');
    assert.strictEqual(foundRow[13], 'Google Search');
    console.log(`[LIVE VERIFIED] Parent Registrations tab verified with phone number: ${foundRow[9]}`);
  });

  test('Step 3.4 — Verify Tutor Applications tab with plus-prefixed phone number', async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.tutorSignups}'!A1:S`,
    });
    assert.strictEqual(res.status, 200);
    const rows = res.data.values || [];
    assert.ok(rows.length >= 2);

    assert.deepStrictEqual(rows[0], TAB_HEADERS[EXPORT_TABS.tutorSignups]);

    const foundRow = rows.find((r) => r[1] === syntheticSubmissionIds.tutor);
    assert.ok(foundRow, 'Synthetic tutor application must exist in live Google Sheet');
    assert.strictEqual(foundRow[0], createdRecordIds.tutorSignups[0].toString());
    assert.strictEqual(foundRow[4], 'Dr. Priya LiveTutor');
    // Sanitized plus-prefixed phone number prevents formula injection
    assert.ok(foundRow[7].includes('+919876543211'), 'Phone number with + must be preserved');
    assert.strictEqual(foundRow[10], 'M.Sc. Mathematics, B.Ed.');
    assert.strictEqual(foundRow[16], 'CBSE, ICSE, IB');
    assert.strictEqual(foundRow[17], 'Yes');
    console.log(`[LIVE VERIFIED] Tutor Applications tab verified with phone number: ${foundRow[7]}`);
  });

  test('Step 3.5 — Verify Newsletter Subscribers & Feedback tabs', async () => {
    const newsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.newsletters}'!A1:E`,
    });
    assert.strictEqual(newsRes.status, 200);
    const newsRows = newsRes.data.values || [];
    const foundNews = newsRows.find((r) => r[1] === syntheticSubmissionIds.newsletter);
    assert.ok(foundNews, 'Newsletter subscriber must exist in live Google Sheet');
    assert.strictEqual(foundNews[4], 'livenewsletter@dhiyonitutorials.com');

    const fbRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.feedbacks}'!A1:J`,
    });
    assert.strictEqual(fbRes.status, 200);
    const fbRows = fbRes.data.values || [];
    const foundFb = fbRows.find((r) => r[1] === syntheticSubmissionIds.feedback);
    assert.ok(foundFb, 'Feedback entry must exist in live Google Sheet');
    assert.strictEqual(foundFb[4], 'Ramesh LiveReviewer');
    assert.strictEqual(foundFb[5], 'Parent');
    assert.strictEqual(foundFb[8], '5');
    console.log(`[LIVE VERIFIED] Newsletter and Feedback tabs verified in live spreadsheet`);
  });

  test('Step 3.6 — Verify Export History tab records audit trail', async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.history}'!A1:M`,
    });
    assert.strictEqual(res.status, 200);
    const rows = res.data.values || [];
    assert.ok(rows.length >= 2, 'Export History tab must have audit rows');
    const latestAuditRow = rows[rows.length - 1];
    assert.ok(latestAuditRow[0].startsWith('live_exp_'), 'Audit row must contain jobId');
    assert.strictEqual(latestAuditRow[3], 'completed', 'Audit status must be completed');
    console.log(`[LIVE VERIFIED] Export History audit trail verified: Job ${latestAuditRow[0]} (${latestAuditRow[3]})`);
  });

  test('Step 3.7 — Duplicate Prevention: Repeated export preserves row count and does not double records', async () => {
    // 3-second cooldown between exports to respect per-minute Google API write quota
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Record current row count in contacts tab
    const initialRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.contacts}'!A2:A`,
    });
    const initialCount = (initialRes.data.values || []).length;

    // Run export second time
    const lock = await acquireSpreadsheetLock(spreadsheetId, 'live_export_job_2', adminId);
    const job2 = await ExportJob.create({
      jobId: 'live_exp_repeat_' + Date.now(),
      exportType: 'full',
      categories: ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'],
      requestedBy: adminId,
      destination: { spreadsheetId },
      status: 'pending',
    });

    await runExportJob(job2.jobId, lock.ownerToken);

    // Verify row count did not double
    const postRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.contacts}'!A2:A`,
    });
    const postCount = (postRes.data.values || []).length;

    assert.strictEqual(
      postCount,
      initialCount,
      `Repeated export must replace snapshot without accumulating duplicate rows (expected: ${initialCount}, got: ${postCount})`
    );
    console.log(`[LIVE VERIFIED] Duplicate prevention verified: Row count remained exactly ${postCount} after repeated export`);
  });
});
