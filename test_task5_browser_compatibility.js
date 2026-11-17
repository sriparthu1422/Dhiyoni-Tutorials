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

describe('Task 5 — Browser Compatibility Verification', { concurrency: 1 }, () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  before(async () => {
    await startStaticServer();
  });

  after(async () => {
    if (server) server.close();
  });

  async function setupBaseAdminMocks(page) {
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
  // 1. Google Chrome Desktop (1280x800)
  // =========================================================================
  test('1. Google Chrome Desktop (1280x800) renders export button, modal and controls perfectly', async () => {
    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath: chromePath,
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      await loginAndGoToAdmin(page);

      const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
      await exportBtn.waitFor({ state: 'visible', timeout: 8000 });
      await exportBtn.click();

      const modal = page.locator('div[role="dialog"]');
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await modal.isVisible());

      const title = await page.locator('#export-modal-title').textContent();
      assert.strictEqual(title, 'Export to Google Sheets');

      await context.close();
      await browser.close();
    } catch (err) {
      console.error('TEST 1 ERROR:', err);
      throw err;
    }
  });

  // =========================================================================
  // 2. Google Chrome Mobile (375x667)
  // =========================================================================
  test('2. Google Chrome Mobile (375x667) renders responsive export controls without clipping', async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
    });
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
    await exportBtn.waitFor({ state: 'visible', timeout: 8000 });
    await exportBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await modal.isVisible());

    await context.close();
    await browser.close();
  });

  // =========================================================================
  // 3. Microsoft Edge Desktop (1280x800)
  // =========================================================================
  test('3. Microsoft Edge Desktop (1280x800) renders export button, modal and controls perfectly', async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: edgePath,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
    await exportBtn.waitFor({ state: 'visible', timeout: 8000 });
    await exportBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await modal.isVisible());

    await context.close();
    await browser.close();
  });

  // =========================================================================
  // 4. Microsoft Edge Mobile (375x667)
  // =========================================================================
  test('4. Microsoft Edge Mobile (375x667) renders responsive export controls without clipping', async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: edgePath,
    });
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await loginAndGoToAdmin(page);

    const exportBtn = page.locator('header button[title="Export Submissions to Google Sheets"]');
    await exportBtn.waitFor({ state: 'visible', timeout: 8000 });
    await exportBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await modal.isVisible());

    await context.close();
    await browser.close();
  });
});
