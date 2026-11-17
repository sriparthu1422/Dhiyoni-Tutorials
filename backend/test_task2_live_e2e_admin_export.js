import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import User from './src/models/User.js';
import Contact from './src/models/Contact.js';
import ParentSignup from './src/models/ParentSignup.js';
import TutorSignup from './src/models/TutorSignup.js';
import Newsletter from './src/models/Newsletter.js';
import Feedback from './src/models/Feedback.js';
import ExportJob from './src/models/ExportJob.js';
import SpreadsheetLock from './src/models/SpreadsheetLock.js';

import authRoutes from './src/routes/authRoutes.js';
import contactRoutes from './src/routes/contactRoutes.js';
import parentSignupRoutes from './src/routes/parentSignupRoutes.js';
import tutorSignupRoutes from './src/routes/tutorSignupRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import tutorRoutes from './src/routes/tutorRoutes.js';
import galleryRoutes from './src/routes/galleryRoutes.js';
import exportRoutes from './src/routes/exportRoutes.js';

import { getSheetsClient } from './src/services/googleSheetsService.js';
import { EXPORT_TABS } from './src/services/exportEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../frontend/dist');

describe('Task 2 — Real End-to-End Google Sheets Admin Export Verification', { concurrency: 1 }, () => {
  let backendServer;
  let backendPort;
  let frontendServer;
  let frontendUrl;
  let browser;
  let sheetsClient;

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const adminCredentials = {
    username: 'Task2 Real Admin',
    email: 'task2_real_admin@dhiyonitutorials.com',
    password: 'RealAdminPassword123!',
    role: 'admin',
  };

  const syntheticIds = {
    contactSubId: '00000000-0000-4000-8000-e2et2cont001',
    parentSubId: '00000000-0000-4000-8000-e2et2pare001',
    tutorSubId: '00000000-0000-4000-8000-e2et2tuto001',
    newsletterSubId: '00000000-0000-4000-8000-e2et2news001',
    feedbackSubId: '00000000-0000-4000-8000-e2et2feed001',
  };

  const createdDocIds = {
    contacts: [],
    parentSignups: [],
    tutorSignups: [],
    newsletters: [],
    feedbacks: [],
  };

  let firstJobId = null;
  let secondJobId = null;
  let initialContactsRowCount = 0;

  before(async () => {
    await connectDB();
    sheetsClient = await getSheetsClient();

    // 1. Clean up any stale lock on spreadsheet
    await SpreadsheetLock.deleteMany({ spreadsheetId });

    // 2. Clean up any previous synthetic test records by submissionId
    await Contact.deleteMany({ submissionId: syntheticIds.contactSubId });
    await ParentSignup.deleteMany({ submissionId: syntheticIds.parentSubId });
    await TutorSignup.deleteMany({ submissionId: syntheticIds.tutorSubId });
    await Newsletter.deleteMany({ submissionId: syntheticIds.newsletterSubId });
    await Feedback.deleteMany({ submissionId: syntheticIds.feedbackSubId });

    // 3. Create or update test Admin user in MongoDB
    await User.deleteOne({ email: adminCredentials.email });
    await User.create(adminCredentials);

    // 3. Seed synthetic records across all 5 submission collections
    const contactDoc = await Contact.create({
      name: 'Task2 Synthetic Contact',
      email: 'synth_task2_contact@dhiyonitutorials.com',
      phone: '09876543210',
      subject: 'Math & Physics Inquiry',
      message: 'Synthetic test inquiry message for Task 2 verification.',
      submissionId: syntheticIds.contactSubId,
      status: 'Pending',
    });
    createdDocIds.contacts.push(contactDoc._id);

    const parentDoc = await ParentSignup.create({
      studentName: 'Task2 Synthetic Student',
      gender: 'female',
      grade: 'Grade 10',
      subject: 'Science',
      parentName: 'Task2 Synthetic Parent',
      contact: '+919876543210',
      email: 'synth_task2_parent@dhiyonitutorials.com',
      city: 'Hyderabad',
      state: 'Telangana',
      submissionId: syntheticIds.parentSubId,
      status: 'Pending',
    });
    createdDocIds.parentSignups.push(parentDoc._id);

    const tutorDoc = await TutorSignup.create({
      fullName: 'Task2 Synthetic Tutor',
      gender: 'male',
      contact: '09123456789',
      dob: new Date('1992-05-15'),
      email: 'synth_task2_tutor@dhiyonitutorials.com',
      location: 'Secunderabad, Telangana',
      qualification: 'M.Sc. Mathematics',
      occupation: 'Professional Tutor',
      experience: '5+ years',
      grades: 'Grades 9-12',
      subjects: 'Mathematics',
      time: 'Evening 6 PM - 9 PM',
      boards: ['CBSE', 'ICSE'],
      hasTech: true,
      submissionId: syntheticIds.tutorSubId,
      status: 'Pending',
    });
    createdDocIds.tutorSignups.push(tutorDoc._id);

    const newsDoc = await Newsletter.create({
      email: 'synth_task2_news@dhiyonitutorials.com',
      submissionId: syntheticIds.newsletterSubId,
    });
    createdDocIds.newsletters.push(newsDoc._id);

    const feedDoc = await Feedback.create({
      name: 'Task2 Synthetic Reviewer',
      userType: 'Parent',
      email: 'synth_task2_feedback@dhiyonitutorials.com',
      contactNumber: '+919123456789',
      rating: 5,
      message: 'Excellent structured online tutoring support.',
      submissionId: syntheticIds.feedbackSubId,
    });
    createdDocIds.feedbacks.push(feedDoc._id);

    // 4. Start real backend Express server
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/parent-signups', parentSignupRoutes);
    app.use('/api/tutor-signups', tutorSignupRoutes);
    app.use('/api/newsletters', newsletterRoutes);
    app.use('/api/feedback', feedbackRoutes);
    app.use('/api/tutors', tutorRoutes);
    app.use('/api/gallery', galleryRoutes);
    app.use('/api/export', exportRoutes);

    backendServer = http.createServer(app);
    await new Promise((resolve) => {
      backendServer.listen(0, '127.0.0.1', () => {
        backendPort = backendServer.address().port;
        resolve();
      });
    });

    // 5. Start Frontend server with API proxying to backend
    const MIME_TYPES = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.woff2': 'font/woff2',
    };

    frontendServer = http.createServer((req, res) => {
      // Proxy /api requests to backendServer
      if (req.url.startsWith('/api/')) {
        const proxyReq = http.request(
          `http://127.0.0.1:${backendPort}${req.url}`,
          {
            method: req.method,
            headers: req.headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        req.pipe(proxyReq);
        proxyReq.on('error', (err) => {
          res.writeHead(502);
          res.end(err.message);
        });
        return;
      }

      // Serve static frontend/dist
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || !path.extname(reqPath)) {
        reqPath = '/index.html';
      }
      const filePath = path.join(distDir, reqPath);

      fs.readFile(filePath, (err, content) => {
        if (err) {
          fs.readFile(path.join(distDir, 'index.html'), (fbErr, fbContent) => {
            if (fbErr) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(fbContent);
            }
          });
        } else {
          const ext = path.extname(filePath);
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(content);
        }
      });
    });

    await new Promise((resolve) => {
      frontendServer.listen(0, '127.0.0.1', () => {
        const port = frontendServer.address().port;
        frontendUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 6. Launch Google Chrome browser
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    });
  });

  after(async () => {
    // Cleanup synthetic records from MongoDB
    await Contact.deleteMany({ _id: { $in: createdDocIds.contacts } });
    await ParentSignup.deleteMany({ _id: { $in: createdDocIds.parentSignups } });
    await TutorSignup.deleteMany({ _id: { $in: createdDocIds.tutorSignups } });
    await Newsletter.deleteMany({ _id: { $in: createdDocIds.newsletters } });
    await Feedback.deleteMany({ _id: { $in: createdDocIds.feedbacks } });
    await User.deleteOne({ email: adminCredentials.email });
    await SpreadsheetLock.deleteMany({ spreadsheetId });

    if (browser) await browser.close();
    if (frontendServer) frontendServer.close();
    if (backendServer) backendServer.close();
    await mongoose.connection.close();
  });

  // =========================================================================
  // Sub-task 1 & 2: Log into Admin Dashboard & Open Export Modal
  // =========================================================================
  test('Step 1 & 2 — Log into existing Admin Dashboard and open Export Modal', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto(`${frontendUrl}/admin/login`);
    await page.fill('#email', adminCredentials.email);
    await page.fill('#password', adminCredentials.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin');
    await page.waitForSelector('text=DHIYONI Panel');

    // Click "Export to Sheets" button in top header
    const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
    await exportBtn.waitFor({ state: 'visible' });
    await exportBtn.click();

    // Verify modal is visible
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible' });

    assert.ok(await modal.locator('text=Export to Google Sheets').isVisible());
    assert.ok(await modal.locator('text=Dhiyoni Tutorials Website Submissions').isVisible());

    await page.close();
  });

  // =========================================================================
  // Sub-task 3, 4, 5, 6, 7: Export All Collections, Capture HTTP 202, Verify MongoDB & Poll
  // =========================================================================
  test('Step 3–7 — Confirm export, verify HTTP 202, verify ExportJob in MongoDB, and monitor completion', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // Login
    await page.goto(`${frontendUrl}/admin/login`);
    await page.fill('#email', adminCredentials.email);
    await page.fill('#password', adminCredentials.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');

    // Open Export Modal
    await page.locator('header button[title="Export Submissions to Google Sheets"]').click();
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible' });

    // Click "Start Export" and capture response atomically
    const startExportBtn = modal.locator('button:has-text("Start Export")');
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/export') && resp.request().method() === 'POST',
        { timeout: 15000 }
      ),
      startExportBtn.click(),
    ]);

    const exportResponseStatus = response.status();
    const exportResponseBody = await response.json();

    assert.strictEqual(exportResponseStatus, 202, 'API must return HTTP 202 Accepted on export initiation');
    assert.ok(exportResponseBody?.jobId, 'Response must contain unique jobId');
    assert.ok(exportResponseBody.jobId.startsWith('exp_'), 'Job ID must follow exp_<timestamp>_<uuid> convention');
    assert.strictEqual(exportResponseBody.status, 'pending', 'Initial status must be pending');

    firstJobId = exportResponseBody.jobId;
    console.log(`[REAL EXPORT VERIFIED] Initiated real export job: ${firstJobId} (HTTP 202)`);

    // Verify ExportJob creation in MongoDB
    const mongoJob = await ExportJob.findOne({ jobId: firstJobId });
    assert.ok(mongoJob, 'ExportJob document must be created in MongoDB');
    assert.ok(
      ['pending', 'processing', 'completed'].includes(mongoJob.status),
      `Job status in MongoDB must be pending, processing, or completed (got: ${mongoJob.status})`
    );
    assert.deepEqual(mongoJob.categories, ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks']);

    // Monitor real job status in browser UI
    const tracker = page.locator(`text=Job: ${firstJobId}`);
    await tracker.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for tracker to reach "Export Completed" (processing -> completed)
    const completedBanner = page.locator('text=Export Completed');
    await completedBanner.waitFor({ state: 'visible', timeout: 60000 });

    // Verify record counts rendered in tracker
    const totalRecordsText = await page.locator('text=Total Records Exported:').locator('..').textContent();
    assert.ok(totalRecordsText.length > 0);
    console.log(`[REAL EXPORT VERIFIED] Tracker completed: ${totalRecordsText.trim()}`);

    // Verify Google Spreadsheet button is visible and links to destination
    const openSheetsBtn = page.locator('a:has-text("Open Google Spreadsheet")');
    assert.ok(await openSheetsBtn.isVisible());
    assert.ok((await openSheetsBtn.getAttribute('href')).includes(spreadsheetId));

    await page.close();
  });

  // =========================================================================
  // Sub-task 8, 9, 10: Confirm Live Google Sheets Writes, Tab Updates, and Stable IDs
  // =========================================================================
  test('Step 8–10 — Verify live Google Sheets tabs, stable MongoDB IDs, and phone number formatting', async () => {
    // 1. Contact Enquiries tab
    const contactsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.contacts}'!A1:M`,
    });
    assert.strictEqual(contactsRes.status, 200);
    const contactRows = contactsRes.data.values || [];
    assert.ok(contactRows.length >= 2, 'Contacts tab must contain headers and data rows');

    // Find synthetic contact row
    const synthContactRow = contactRows.find((r) => r[1] === syntheticIds.contactSubId);
    assert.ok(synthContactRow, 'Synthetic contact row must be present in Google Sheets');
    assert.strictEqual(synthContactRow[0], String(createdDocIds.contacts[0]), 'Column A must hold MongoDB ObjectId');
    assert.strictEqual(synthContactRow[4], 'Task2 Synthetic Contact', 'Name must be at column index 4');

    initialContactsRowCount = contactRows.length;

    // 2. Parent Registrations tab
    const parentsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.parentSignups}'!A1:O`,
    });
    assert.strictEqual(parentsRes.status, 200);
    const parentRows = parentsRes.data.values || [];
    const synthParentRow = parentRows.find((r) => r[1] === syntheticIds.parentSubId);
    assert.ok(synthParentRow, 'Synthetic parent row must be present');
    assert.strictEqual(synthParentRow[0], String(createdDocIds.parentSignups[0]), 'Column A must hold MongoDB ObjectId');
    assert.strictEqual(synthParentRow[4], 'Task2 Synthetic Student', 'Student Name must match');
    // Plus-prefixed phone number at index 9 must NOT execute as formula
    assert.ok(
      synthParentRow[9] === "'+919876543210" || synthParentRow[9] === "+919876543210",
      `Phone number must be preserved without formula error (got: ${synthParentRow[9]})`
    );

    // 3. Tutor Applications tab
    const tutorsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.tutorSignups}'!A1:T`,
    });
    assert.strictEqual(tutorsRes.status, 200);
    const tutorRows = tutorsRes.data.values || [];
    const synthTutorRow = tutorRows.find((r) => r[1] === syntheticIds.tutorSubId);
    assert.ok(synthTutorRow, 'Synthetic tutor row must be present');
    assert.strictEqual(synthTutorRow[0], String(createdDocIds.tutorSignups[0]));
    assert.strictEqual(synthTutorRow[4], 'Task2 Synthetic Tutor');
    // Leading zero phone number at index 7 must NOT be truncated
    assert.strictEqual(synthTutorRow[7], '09123456789', 'Phone number with leading zero must be preserved literally');

    // 4. Newsletter Subscribers tab
    const newsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.newsletters}'!A1:E`,
    });
    assert.strictEqual(newsRes.status, 200);
    const newsRows = newsRes.data.values || [];
    const synthNewsRow = newsRows.find((r) => r[4] === 'synth_task2_news@dhiyonitutorials.com');
    assert.ok(synthNewsRow, 'Synthetic newsletter subscriber must be present');
    assert.strictEqual(synthNewsRow[0], String(createdDocIds.newsletters[0]));

    // 5. Feedback tab
    const feedRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.feedbacks}'!A1:J`,
    });
    assert.strictEqual(feedRes.status, 200);
    const feedRows = feedRes.data.values || [];
    const synthFeedRow = feedRows.find((r) => r[1] === syntheticIds.feedbackSubId);
    assert.ok(synthFeedRow, 'Synthetic feedback must be present');
    assert.strictEqual(synthFeedRow[0], String(createdDocIds.feedbacks[0]));
    assert.strictEqual(synthFeedRow[8], '5', 'Rating score must be 5 at index 8');

    console.log(`[REAL EXPORT VERIFIED] All 5 submission tabs verified in live Google Spreadsheet!`);
  });

  // =========================================================================
  // Sub-task 11: Verify Export History Tab in Google Sheets and Admin UI
  // =========================================================================
  test('Step 11 — Verify Export History entry in Google Sheets and Admin Dashboard UI', async () => {
    // 1. Verify in Google Sheets Export History tab
    const historyRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.history}'!A1:M`,
    });
    assert.strictEqual(historyRes.status, 200);
    const historyRows = historyRes.data.values || [];
    const latestAudit = historyRows[historyRows.length - 1];
    assert.strictEqual(latestAudit[0], firstJobId, 'Latest audit row in spreadsheet must match firstJobId');
    assert.strictEqual(latestAudit[3], 'completed', 'Audit status must be completed');

    // 2. Verify in Admin Dashboard UI
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${frontendUrl}/admin/login`);
    await page.fill('#email', adminCredentials.email);
    await page.fill('#password', adminCredentials.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');

    // Navigate to Export History in sidebar
    await page.locator('nav button[title="Export History"]').click();
    await page.waitForSelector('text=Google Sheets Export History');

    // Verify firstJobId appears in the table
    const jobCell = page.locator(`td:has-text("${firstJobId}")`);
    await jobCell.waitFor({ state: 'visible', timeout: 5000 });

    const statusBadge = page.locator('span:has-text("completed")').first();
    assert.ok(await statusBadge.isVisible());

    console.log(`[REAL EXPORT VERIFIED] Job ${firstJobId} verified in Admin UI Export History tab!`);

    await page.close();
  });

  // =========================================================================
  // Sub-task 12: Repeat Export and Check for Duplicate Logical Rows
  // =========================================================================
  test('Step 12 — Repeat export and confirm duplicate prevention (row counts do not double)', async () => {
    // 3-second cooldown to respect Google Sheets write quotas
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${frontendUrl}/admin/login`);
    await page.fill('#email', adminCredentials.email);
    await page.fill('#password', adminCredentials.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');

    // Trigger second export via header button
    await page.locator('header button[title="Export Submissions to Google Sheets"]').click();
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible' });

    const [secondResponse] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/export') && resp.request().method() === 'POST',
        { timeout: 15000 }
      ),
      modal.locator('button:has-text("Start Export")').click(),
    ]);

    const secondExportBody = await secondResponse.json();
    assert.ok(secondExportBody?.jobId);
    secondJobId = secondExportBody.jobId;
    assert.notStrictEqual(secondJobId, firstJobId, 'Each export run must generate a new unique jobId');

    // Wait for completion banner in UI
    const completedBanner = page.locator('text=Export Completed');
    await completedBanner.waitFor({ state: 'visible', timeout: 60000 });

    // Verify Google Sheets Contact Enquiries row count did NOT increase
    const repeatContactsRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${EXPORT_TABS.contacts}'!A1:M`,
    });
    assert.strictEqual(repeatContactsRes.status, 200);
    const repeatContactRows = repeatContactsRes.data.values || [];

    assert.strictEqual(
      repeatContactRows.length,
      initialContactsRowCount,
      `Repeat export must atomically replace snapshot without duplicate rows (expected: ${initialContactsRowCount}, got: ${repeatContactRows.length})`
    );

    console.log(
      `[REAL EXPORT VERIFIED] Duplicate prevention confirmed: Row count remained exactly ${repeatContactRows.length} after repeat export!`
    );

    await page.close();
  });
});
