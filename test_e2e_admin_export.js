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

describe('Phase 6 Google Sheets Admin Export Browser E2E Suite', { concurrency: 1 }, () => {
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

  async function setupBaseAdminMocks(page) {
    // 1. Auth Profile check
    await page.route('**/api/auth/profile', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'admin_123',
          username: 'Director Sharma',
          email: 'admin@dhiyonitutorials.com',
          role: 'admin',
        }),
      });
    });

    // 2. Auth Login
    await page.route('**/api/auth/login', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'admin_123',
          username: 'Director Sharma',
          email: 'admin@dhiyonitutorials.com',
          role: 'admin',
          token: 'mock_admin_token_jwt_xyz',
        }),
      });
    });

    // 3. Dashboard Stats
    await page.route('**/api/auth/dashboard-stats', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            contacts: { total: 10, pending: 2 },
            parentSignups: { total: 20, pending: 3 },
            tutorSignups: { total: 15, pending: 1 },
            newsletters: { total: 50, pending: 0 },
            feedbacks: { total: 25, pending: 0 },
          },
        }),
      });
    });

    // Tutors & Gallery Public Endpoints
    await page.route('**/api/tutors*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/gallery*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  }

  async function loginAndGoToAdmin(page) {
    await setupBaseAdminMocks(page);
    await page.goto(`${serverUrl}/admin/login`);
    await page.fill('#email', 'admin@dhiyonitutorials.com');
    await page.fill('#password', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    await page.waitForSelector('text=DHIYONI Panel');
  }

  // =========================================================================
  // Test 1: Header One-Click Button & Modal Visibility
  // =========================================================================
  test('1. Admin Header renders "Export to Sheets" button which opens Export Modal', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    // Verify button exists in header
    const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
    await assert.doesNotReject(async () => {
      await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    }, 'Export button should be visible in header');

    // Click button to open modal
    await exportBtn.click();

    // Verify modal is visible
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    const modalTitle = page.locator('#export-modal-title');
    assert.equal(await modalTitle.textContent(), 'Export to Google Sheets');

    // Verify destination info
    const destText = await modal.textContent();
    assert.ok(destText.includes('Dhiyoni Tutorials Website Submissions'), 'Destination spreadsheet should be displayed');
    assert.ok(destText.includes('All Collections (Recommended)'), 'Should have All Collections option');

    // Close modal
    await page.locator('button[aria-label="Close export modal"]').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    await context.close();
  });

  // =========================================================================
  // Test 2: Category Selection & Validation
  // =========================================================================
  test('2. Export Modal allows individual collection toggling and requires at least 1 selection', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    await page.locator('header button[title="Export Submissions to Google Sheets"]').click();
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible' });

    // Uncheck "All Collections"
    const allCheckbox = modal.locator('input[type="checkbox"]').first();
    await allCheckbox.uncheck();

    // Start Export button should now be disabled (0 selected)
    const startBtn = modal.locator('button:has-text("Start Export")');
    assert.equal(await startBtn.isDisabled(), true, 'Start Export should be disabled when 0 collections selected');

    // Check one category (e.g. Contact Enquiries)
    const contactCheckbox = modal.locator('label:has-text("Contact Enquiries") input[type="checkbox"]');
    await contactCheckbox.check();

    assert.equal(await startBtn.isDisabled(), false, 'Start Export should be enabled when 1 collection is selected');

    await context.close();
  });

  // =========================================================================
  // Test 3: Export Initiation, Polling, and Completion Flow
  // =========================================================================
  test('3. Initiates export, tracks progress via polling, and displays completion summary with Google Sheets link', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    let exportInitiated = false;
    let pollCount = 0;

    // Mock POST /api/export
    await page.route('**/api/export', async (route) => {
      if (route.request().method() === 'POST') {
        exportInitiated = true;
        const body = JSON.parse(route.request().postData());
        assert.ok(Array.isArray(body.categories), 'Categories must be an array');
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            jobId: 'exp_e2e_12345',
            status: 'pending',
            destination: {
              spreadsheetId: '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
              spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
            },
          }),
        });
      }
      return route.fallback();
    });

    // Mock GET /api/export/exp_e2e_12345
    await page.route('**/api/export/exp_e2e_12345', async (route) => {
      pollCount++;
      if (pollCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              jobId: 'exp_e2e_12345',
              status: 'processing',
              destination: {
                spreadsheetId: '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
                spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
              },
            },
          }),
        });
      } else {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              jobId: 'exp_e2e_12345',
              status: 'completed',
              recordCounts: {
                contacts: 10,
                parentSignups: 20,
                tutorSignups: 15,
                newsletters: 50,
                feedbacks: 25,
              },
              destination: {
                spreadsheetId: '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
                spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
              },
            },
          }),
        });
      }
    });

    // Open modal and start export
    await page.locator('header button[title="Export Submissions to Google Sheets"]').click();
    await page.locator('div[role="dialog"]').waitFor({ state: 'visible' });
    await page.locator('button:has-text("Start Export")').click();

    // Verify modal closes and tracker appears
    await page.locator('div[role="dialog"]').waitFor({ state: 'hidden' });
    assert.equal(exportInitiated, true, 'POST /api/export should have been called');

    // Tracker should be visible
    const tracker = page.locator('text=Job: exp_e2e_12345');
    await tracker.waitFor({ state: 'visible', timeout: 8000 });

    // Wait for completion state
    const completedHeader = page.locator('text=Export Completed');
    await completedHeader.waitFor({ state: 'visible', timeout: 8000 });

    // Verify total records = 120 (10+20+15+50+25)
    const countText = await page.locator('text=Total Records Exported:').locator('..').textContent();
    assert.ok(countText.includes('120'), `Expected 120 total records in tracker, got ${countText}`);

    // Verify Google Spreadsheet button
    const sheetsLink = page.locator('a:has-text("Open Google Spreadsheet")');
    await sheetsLink.waitFor({ state: 'visible' });
    const href = await sheetsLink.getAttribute('href');
    assert.equal(href, 'https://docs.google.com/spreadsheets/d/14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY');

    // Dismiss tracker
    await page.locator('button[aria-label="Dismiss export notification"]').click();
    await tracker.waitFor({ state: 'hidden' });

    await context.close();
  });

  // =========================================================================
  // Test 4: Page Refresh Recovery via SessionStorage
  // =========================================================================
  test('4. Page refresh restores active export tracker without re-initiating export', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupBaseAdminMocks(page);

    // Mock GET /api/export/exp_active_reload
    await page.route('**/api/export/exp_active_reload', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            jobId: 'exp_active_reload',
            status: 'processing',
            destination: {
              spreadsheetId: '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
            },
          },
        }),
      });
    });

    // Populate sessionStorage with active job before loading
    await page.addInitScript(() => {
      sessionStorage.setItem('dhiyoni_active_export_jobId', 'exp_active_reload');
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem(
        'dhiyoni_admin_user',
        JSON.stringify({ _id: 'admin_123', username: 'Director Sharma', role: 'admin' })
      );
    });

    await page.goto(`${serverUrl}/admin`);

    // Verify tracker is automatically restored on page load
    const restoredTracker = page.locator('text=Job: exp_active_reload');
    await restoredTracker.waitFor({ state: 'visible', timeout: 5000 });

    const statusBadge = page.locator('text=processing');
    await statusBadge.waitFor({ state: 'visible' });

    // Dismiss tracker and verify sessionStorage is cleared
    await page.locator('button:has-text("Dismiss")').click();
    await restoredTracker.waitFor({ state: 'hidden' });

    const storedKey = await page.evaluate(() => sessionStorage.getItem('dhiyoni_active_export_jobId'));
    assert.equal(storedKey, null, 'sessionStorage key should be removed on dismiss');

    await context.close();
  });

  // =========================================================================
  // Test 5: 409 Conflict Handling (Active Lock Warning)
  // =========================================================================
  test('5. Handles 409 Conflict gracefully and displays lock conflict alert with active Job ID', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    // Mock 409 Conflict on POST /api/export
    await page.route('**/api/export', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Concurrent export in progress: Destination spreadsheet is currently locked by another export job',
            activeJobId: 'exp_lock_holder_888',
            lockedAt: '2026-11-16T15:00:00.000Z',
            expiresAt: '2026-11-16T15:05:00.000Z',
          }),
        });
      }
      return route.fallback();
    });

    await page.locator('header button[title="Export Submissions to Google Sheets"]').click();
    await page.locator('div[role="dialog"]').waitFor({ state: 'visible' });

    await page.locator('button:has-text("Start Export")').click();

    // Verify conflict banner in modal
    const conflictAlert = page.locator('text=Concurrent Export Active');
    await conflictAlert.waitFor({ state: 'visible', timeout: 5000 });

    const jobNotice = page.locator('text=exp_lock_holder_888');
    await jobNotice.waitFor({ state: 'visible' });

    await context.close();
  });

  // =========================================================================
  // Test 6: Export History Tab & Details Modal
  // =========================================================================
  test('6. Export History navigation loads audit trail, displays past jobs, and opens details modal', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    // Mock GET /api/export history
    await page.route('**/api/export?page=1&limit=10', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 2,
          data: [
            {
              _id: 'job_record_1',
              jobId: 'exp_hist_001',
              status: 'completed',
              createdAt: '2026-11-16T10:00:00.000Z',
              requestedBy: { username: 'Director Sharma' },
              categories: ['contacts', 'newsletters'],
              recordCounts: { contacts: 12, newsletters: 45 },
              destination: {
                spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
              },
            },
            {
              _id: 'job_record_2',
              jobId: 'exp_hist_002',
              status: 'failed',
              createdAt: '2026-11-15T08:00:00.000Z',
              requestedBy: { username: 'Admin' },
              categories: ['feedbacks'],
              errorDetails: { message: 'Network timeout connecting to Google Sheets API' },
            },
          ],
          pagination: {
            total: 2,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }),
      });
    });

    // Navigate to Export History tab
    await page.locator('nav button[title="Export History"]').click();
    await page.waitForSelector('text=Google Sheets Export History');

    // Verify jobs in table
    const job1Cell = page.locator('td:has-text("exp_hist_001")');
    await job1Cell.waitFor({ state: 'visible' });

    const job2Cell = page.locator('td:has-text("exp_hist_002")');
    await job2Cell.waitFor({ state: 'visible' });

    // Verify status badges
    assert.ok(await page.locator('span:has-text("completed")').first().isVisible());
    assert.ok(await page.locator('span:has-text("failed")').first().isVisible());

    // Click "Details" on job 1
    const detailsBtns = page.locator('button:has-text("Details")');
    await detailsBtns.first().click();

    // Verify details breakdown modal
    const breakdownHeader = page.locator('text=Export Job Breakdown');
    await breakdownHeader.waitFor({ state: 'visible' });
    assert.ok(await page.locator('text=Contact Enquiries:').isVisible());
    assert.ok(await page.locator('text=12').isVisible());

    // Close details modal
    await page.locator('button[aria-label="Close details modal"]').click();
    await breakdownHeader.waitFor({ state: 'hidden' });

    await context.close();
  });
});

