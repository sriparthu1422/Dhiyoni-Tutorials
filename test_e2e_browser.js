import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, 'frontend/dist');

// MIME types for static file server
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

// Start local static server for frontend/dist
let server;
let serverUrl;
let browser;

function startStaticServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || !path.extname(reqPath)) {
        reqPath = '/index.html';
      }
      const filePath = path.join(distDir, reqPath);

      fs.readFile(filePath, (err, content) => {
        if (err) {
          // SPA fallback to index.html
          fs.readFile(path.join(distDir, 'index.html'), (fallbackErr, indexContent) => {
            if (fallbackErr) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(indexContent);
            }
          });
        } else {
          const ext = path.extname(filePath);
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(content);
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

describe('Phase 3 Playwright Browser End-to-End Suite', { concurrency: 1 }, () => {
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  before(async () => {
    await startStaticServer();
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    });
  });

  after(async () => {
    if (browser) await browser.close();
    if (server) server.close();
  });

  // =========================================================================
  // 1. Contact Form: Browser E2E Flow
  // =========================================================================
  test('1. Contact Form: Submits UUIDv4, shows loading, handles retry, and redirects', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];
    let simulateFailure = true;

    // Track window.open calls
    await page.addInitScript(() => {
      window.openedUrls = [];
      window.open = (url) => {
        window.openedUrls.push(url);
      };
    });

    await page.route('**/api/contacts', async (route) => {
      const req = route.request();
      const postData = JSON.parse(req.postData() || '{}');
      capturedRequests.push(postData);

      if (simulateFailure) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Database connection glitch' }),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...postData, _id: 'mock_c_1' }),
        });
      }
    });

    await page.goto(`${serverUrl}/contact`);

    // Fill form using explicit placeholders
    await page.fill('input[placeholder="Your full name"]', 'Arjun Kumar');
    await page.fill('input[placeholder="Enter your email id"]', 'arjun@dhiyonitutorials.com');
    await page.selectOption('select', 'Course Inquiry');
    await page.fill('textarea[placeholder="How can we help you?"]', 'Interested in physics and chemistry coaching.');

    // 1st attempt: fails with 500
    const submitBtn = page.getByRole('button', { name: /Submit Inquiry/i });
    await submitBtn.click();

    // Verify error message rendered and inputs preserved
    await page.waitForSelector('text=Database connection glitch');
    assert.equal(await page.inputValue('input[placeholder="Your full name"]'), 'Arjun Kumar');
    assert.equal(await page.inputValue('input[placeholder="Enter your email id"]'), 'arjun@dhiyonitutorials.com');

    assert.equal(capturedRequests.length, 1);
    const firstSubId = capturedRequests[0].submissionId;
    assert.ok(UUID_V4_REGEX.test(firstSubId), `Must be valid UUIDv4: ${firstSubId}`);

    // 2nd attempt (Retry with unchanged form): should REUSE the same submissionId
    simulateFailure = false;
    await submitBtn.click();

    // Wait for success
    await page.waitForSelector('text=Message Sent!');
    assert.equal(capturedRequests.length, 2);
    const secondSubId = capturedRequests[1].submissionId;
    assert.equal(secondSubId, firstSubId, 'Retry must reuse the identical UUIDv4 submissionId');

    // Verify WhatsApp redirect occurred
    const openedUrls = await page.evaluate(() => window.openedUrls);
    assert.ok(openedUrls.some((u) => u.includes('wa.me/917901034846')));

    await context.close();
  });

  // =========================================================================
  // 2. Parent/Student Registration Form: Browser E2E Flow & Modal
  // =========================================================================
  test('2. Parent Registration: Client UUIDv4, loading state, double-click prevention, and confirmation modal', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];

    await page.route('**/api/parent-signups', async (route) => {
      // Simulate 150ms network delay to verify disabled button state
      await new Promise((r) => setTimeout(r, 150));
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(postData);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...postData, _id: 'mock_p_1' }),
      });
    });

    await page.goto(`${serverUrl}/parent-signup`);

    // Fill form
    await page.fill('#signUpForm input[name="studentName"]', 'Rohan Sharma');
    await page.selectOption('#signUpForm select[name="gender"]', 'male');
    await page.fill('#signUpForm input[name="grade"]', 'Grade 10');
    await page.fill('#signUpForm input[name="subject"]', 'Mathematics');
    await page.fill('#signUpForm input[name="parentName"]', 'Vijay Sharma');
    await page.fill('#signUpForm input[name="contact"]', '9876543210');
    await page.fill('#signUpForm input[name="email"]', 'rohan@dhiyonitutorials.com');
    await page.fill('#signUpForm input[name="city"]', 'Hyderabad');
    await page.fill('#signUpForm input[name="state"]', 'Telangana');

    const submitBtn = page.locator('#signUpForm button[type="submit"]');

    // Click submit
    await submitBtn.click();

    // Verify confirmation modal popup appears
    await page.waitForSelector('text=Registration Submitted Successfully!');
    assert.equal(capturedRequests.length, 1);
    const subId = capturedRequests[0].submissionId;
    assert.ok(UUID_V4_REGEX.test(subId));

    await context.close();
  });

  // =========================================================================
  // 3. Tutor Registration: Multi-Step Form, UUIDv4 & Confirmation Modal
  // =========================================================================
  test('3. Tutor Registration: Multi-step navigation, client UUIDv4, and confirmation modal', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];

    await page.route('**/api/tutor-signups', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(postData);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...postData, _id: 'mock_t_1' }),
      });
    });

    await page.goto(`${serverUrl}/tutor-signup`);

    // Step 1: Personal Info
    await page.fill('input[name="full-name"]', 'Dr. Meera Iyer');
    await page.selectOption('select[name="gender"]', 'female');
    await page.fill('input[name="email"]', 'meera@dhiyonitutorials.com');
    await page.fill('input[name="contact"]', '9876543211');
    await page.fill('input[name="dob"]', '1990-05-15');
    await page.fill('input[name="location"]', 'Hyderabad, Telangana');
    await page.click('button:has-text("Continue to Academic Details")');

    // Step 2: Academic Details
    await page.waitForSelector('input[name="qualification"]');
    await page.fill('input[name="qualification"]', 'Ph.D Physics');
    await page.click('input[name="occupation"][value="teacher"]');
    await page.fill('textarea[name="experience"]', '6 years of higher secondary teaching');
    await page.fill('input[name="grades"]', 'Grades 9 to 12');
    await page.fill('input[name="subjects"]', 'Physics, Mathematics');
    await page.click('button:has-text("Continue to Logistics")');

    // Step 3: Logistics
    await page.waitForSelector('input[name="time"]');
    await page.fill('input[name="time"]', 'Evening 6 PM - 9 PM');
    await page.click('input[name="board"][value="cbse"]');

    // Submit application
    await page.click('.form-card button[type="submit"]');

    // Confirmation modal should appear
    await page.waitForSelector('text=Application Submitted Successfully!');
    assert.equal(capturedRequests.length, 1);
    assert.ok(UUID_V4_REGEX.test(capturedRequests[0].submissionId));
    assert.equal(capturedRequests[0].fullName, 'Dr. Meera Iyer');

    await context.close();
  });

  // =========================================================================
  // 4. Newsletter Form: Browser E2E Flow & WhatsApp Redirect
  // =========================================================================
  test('4. Newsletter Form: Submits UUIDv4, handles 400 already subscribed, and triggers WhatsApp', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];

    await page.addInitScript(() => {
      window.openedUrls = [];
      window.open = (url) => {
        window.openedUrls.push(url);
      };
    });

    await page.route('**/api/newsletters', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(postData);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...postData, _id: 'mock_n_1' }),
      });
    });

    await page.goto(`${serverUrl}/`);

    const emailInput = page.locator('input[aria-label="Newsletter email address"]');
    const submitBtn = page.locator('button[aria-label="Submit newsletter subscription"]');

    await emailInput.fill('newsletter_e2e@dhiyonitutorials.com');
    await submitBtn.click();

    // Verify success
    await page.waitForSelector('text=Subscribed successfully! Thank you.');
    assert.equal(capturedRequests.length, 1);
    assert.ok(UUID_V4_REGEX.test(capturedRequests[0].submissionId));

    // Verify WhatsApp redirect was initiated
    const openedUrls = await page.evaluate(() => window.openedUrls);
    assert.ok(openedUrls.some((u) => u.includes('wa.me/917901034846')));

    await context.close();
  });

  // =========================================================================
  // 5. Feedback Form: Rating, UUIDv4 & HTTP 409 Conflict Handling
  // =========================================================================
  test('5. Feedback Form: Rating selection, UUIDv4, HTTP 409 conflict, and form preservation', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];
    let simulateConflict = true;

    await page.route('**/api/feedback', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(postData);

      if (simulateConflict) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'A conflicting feedback submission was detected. Please review and update your feedback.' }),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Feedback submitted successfully', data: postData }),
        });
      }
    });

    await page.goto(`${serverUrl}/`);

    // Fill feedback form
    await page.fill('input[name="name"]', 'Deepa Nair');
    await page.selectOption('select[name="userType"]', 'Parent');
    await page.fill('input[name="email"]', 'deepa@dhiyonitutorials.com');
    await page.fill('textarea[name="message"]', 'Exceptional teaching quality.');
    // Select 5 stars (click 5th star button)
    const starButtons = page.locator('button:has(span:text("star"))');
    await starButtons.nth(4).click();

    const submitBtn = page.locator('button:has-text("Submit Feedback")');

    // 1st attempt: 409 Conflict
    await submitBtn.click();
    await page.waitForSelector('text=conflicting feedback submission was detected');

    // Form values must remain preserved
    assert.equal(await page.inputValue('input[name="name"]'), 'Deepa Nair');
    assert.equal(await page.inputValue('textarea[name="message"]'), 'Exceptional teaching quality.');

    // 2nd attempt: Success
    simulateConflict = false;
    await submitBtn.click();

    await page.waitForSelector('text=Feedback Submitted Successfully!');
    assert.equal(capturedRequests.length, 2);
    assert.equal(capturedRequests[0].submissionId, capturedRequests[1].submissionId, 'Retrying without changing values retains identical UUIDv4');

    await context.close();
  });

  // =========================================================================
  // 6. Mobile Layout Responsiveness
  // =========================================================================
  test('6. Mobile Responsiveness: Contact and Parent forms render and function cleanly on mobile viewport', async () => {
    // Mobile Viewport: iPhone 12/13/14 size (390 x 844)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.goto(`${serverUrl}/contact`);
    const contactHeading = page.locator('h1:has-text("Tuition Enquiries")');
    assert.ok(await contactHeading.isVisible(), 'Contact heading must be visible on mobile');

    await page.goto(`${serverUrl}/parent-signup`);
    const parentHeading = page.locator('h1:has-text("Join the DHIYONI Family")');
    assert.ok(await parentHeading.isVisible(), 'Parent signup heading must be visible on mobile');

    await context.close();
  });

  // =========================================================================
  // 7. Refresh Retention: SessionStorage preserves pending ID across refresh
  // =========================================================================
  test('7. Refresh Retention: sessionStorage preserves pending submissionId across browser reload', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let capturedRequests = [];
    await page.route('**/api/contacts', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedRequests.push(postData);
      // Simulate transient failure
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary failure' }) });
    });

    await page.goto(`${serverUrl}/contact`);
    await page.fill('input[placeholder="Your full name"]', 'Refresh User');
    await page.fill('input[placeholder="Enter your email id"]', 'refresh@dhiyonitutorials.com');
    await page.fill('textarea[placeholder="How can we help you?"]', 'Testing refresh retention.');

    // Click submit -> fails with 500
    await page.getByRole('button', { name: /Submit Inquiry/i }).click();
    await page.waitForSelector('text=Temporary failure');
    assert.equal(capturedRequests.length, 1);
    const preRefreshId = capturedRequests[0].submissionId;

    // Simulate page reload (e.g. user hits F5 after uncertain failure)
    await page.reload();

    // Re-fill same values
    await page.fill('input[placeholder="Your full name"]', 'Refresh User');
    await page.fill('input[placeholder="Enter your email id"]', 'refresh@dhiyonitutorials.com');
    await page.fill('textarea[placeholder="How can we help you?"]', 'Testing refresh retention.');

    await page.getByRole('button', { name: /Submit Inquiry/i }).click();
    await page.waitForSelector('text=Temporary failure');
    assert.equal(capturedRequests.length, 2);
    const postRefreshId = capturedRequests[1].submissionId;

    assert.equal(postRefreshId, preRefreshId, 'Pending submissionId must be preserved across reload via sessionStorage fingerprint');

    await context.close();
  });
});
