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

describe('Phase 4 Admin Dashboard Browser End-to-End Suite', { concurrency: 1 }, () => {
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

  // Setup mock admin API routes on the browser context
  async function setupAdminMocks(page) {
    // 1. Auth Profile check
    await page.route('**/api/auth/profile', async (route) => {
      const auth = route.request().headers()['authorization'];
      if (!auth || !auth.includes('mock_admin_token')) {
        return route.fulfill({ status: 401, body: JSON.stringify({ message: 'Session expired' }) });
      }
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
            contacts: { total: 42, pending: 7 },
            parentSignups: { total: 128, pending: 14 },
            tutorSignups: { total: 35, pending: 5 },
            newsletters: { total: 250, pending: 0 },
            feedbacks: { total: 89, pending: 0 },
          },
        }),
      });
    });

    // 4. Contacts Paginated
    await page.route('**/api/contacts*', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ _id: 'c_1', status: 'Resolved' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 2,
          data: [
            {
              _id: 'c_1',
              name: 'Arjun Inquiry',
              email: 'arjun@example.com',
              subject: 'Physics Tuition Class 11',
              message: 'Looking for experienced faculty in Ameenpur.',
              status: 'Pending',
              submissionId: 'e4d8a1c2-3b4f-4000-8000-000000000001',
              createdAt: '2026-11-15T08:00:00.000Z',
            },
            {
              _id: 'c_2',
              name: 'Kavitha Rao',
              email: 'kavitha@example.com',
              subject: 'Maths Coaching',
              message: 'CBSE Class 10 term exam prep.',
              status: 'Resolved',
              submissionId: 'e4d8a1c2-3b4f-4000-8000-000000000002',
              createdAt: '2026-11-14T10:00:00.000Z',
            },
          ],
          pagination: {
            total: 42,
            page: Number(url.searchParams.get('page') || '1'),
            limit: 10,
            totalPages: 5,
            hasNextPage: true,
            hasPrevPage: false,
          },
        }),
      });
    });

    // 5. Parent Signups Paginated
    await page.route('**/api/parent-signups*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 1,
          data: [
            {
              _id: 'p_1',
              studentName: 'Rohan Sharma',
              gender: 'male',
              grade: 'Grade 10',
              subject: 'Mathematics',
              parentName: 'Vijay Sharma',
              contact: '9876543210',
              email: 'rohan@example.com',
              city: 'Hyderabad',
              state: 'Telangana',
              referral: 'social_media',
              status: 'Pending',
              submissionId: 'f5d8a1c2-3b4f-4000-8000-000000000001',
              createdAt: '2026-11-15T09:30:00.000Z',
            },
          ],
          pagination: { total: 128, page: 1, limit: 10, totalPages: 13, hasNextPage: true, hasPrevPage: false },
        }),
      });
    });

    // 6. Tutor Signups Paginated
    await page.route('**/api/tutor-signups*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 1,
          data: [
            {
              _id: 't_1',
              fullName: 'Dr. Meera Iyer',
              gender: 'female',
              email: 'meera@example.com',
              contact: '9876543211',
              dob: '1990-05-15',
              location: 'Hyderabad, Telangana',
              qualification: 'Ph.D Physics',
              occupation: 'professional',
              experience: '6 years of coaching',
              grades: 'Grades 9 to 12',
              subjects: 'Physics',
              time: 'Evening',
              boards: ['cbse'],
              hasTech: true,
              status: 'Pending',
              submissionId: 'a1d8a1c2-3b4f-4000-8000-000000000001',
              createdAt: '2026-11-15T11:00:00.000Z',
            },
          ],
          pagination: { total: 35, page: 1, limit: 10, totalPages: 4, hasNextPage: true, hasPrevPage: false },
        }),
      });
    });

    // 7. Newsletters Paginated
    await page.route('**/api/newsletters*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 1,
          data: [
            {
              _id: 'n_1',
              email: 'subscriber@example.com',
              submissionId: 'b2d8a1c2-3b4f-4000-8000-000000000001',
              createdAt: '2026-11-15T12:00:00.000Z',
            },
          ],
          pagination: { total: 250, page: 1, limit: 10, totalPages: 25, hasNextPage: true, hasPrevPage: false },
        }),
      });
    });

    // 8. Feedbacks Paginated
    await page.route('**/api/feedback*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 1,
          data: [
            {
              _id: 'fb_1',
              name: 'Deepa Nair',
              userType: 'Parent',
              email: 'deepa@example.com',
              contactNumber: '9988776655',
              rating: 5,
              message: 'Exceptional teaching quality and individualized attention.',
              submissionId: 'c3d8a1c2-3b4f-4000-8000-000000000001',
              createdAt: '2026-11-15T12:30:00.000Z',
            },
          ],
          pagination: { total: 89, page: 1, limit: 10, totalPages: 9, hasNextPage: true, hasPrevPage: false },
        }),
      });
    });

    // 9. Tutors & Gallery Public Endpoints
    await page.route('**/api/tutors*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/gallery*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  }

  // =========================================================================
  // Test 1: Admin Login and Overview Stats Render
  // =========================================================================
  test('1. Admin Login & Overview: Authenticates, stores JWT, and displays aggregate statistics', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.goto(`${serverUrl}/admin/login`);

    // Enter login credentials
    await page.fill('#email', 'admin@dhiyonitutorials.com');
    await page.fill('#password', 'AdminPassword123!');
    await page.click('button[type="submit"]');

    // Should redirect to /admin dashboard
    await page.waitForURL('**/admin');
    await page.waitForSelector('text=Data Management Center');

    // Check stats rendered on overview cards
    await page.waitForSelector('text=Parent Signups');
    await page.waitForSelector('text=128'); // Parent count
    await page.waitForSelector('text=42');  // Contact count

    await context.close();
  });

  // =========================================================================
  // Test 2: Inquiries Tab Navigation, Pagination & Review Modal
  // =========================================================================
  test('2. Inquiries Tab: Navigates, displays records with UUIDs, opens detail modal, and updates status', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    // Pre-seed localStorage with admin token
    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=contacts`);
    await page.waitForSelector('text=Arjun Inquiry');

    // Verify pagination metadata bar
    await page.waitForSelector('text=Showing 1 to 2 of 42 records');
    await page.waitForSelector('text=Page 1 of 5');

    // Click "Read" to open Contact Detail Modal
    await page.click('button:has-text("Read")');

    // Verify Modal Contents
    await page.waitForSelector('text=General Inquiry');
    await page.waitForSelector('text=Physics Tuition Class 11');
    await page.waitForSelector('text=e4d8a1c2-3b4f-4000-8000-000000000001');

    // Update Status from modal dropdown
    await page.selectOption('.bg-white select', 'Resolved');

    // Close Modal
    await page.click('button[aria-label="Close modal"]');

    await context.close();
  });

  // =========================================================================
  // Test 3: Parent Requests Tab & Review Modal
  // =========================================================================
  test('3. Parent Requests Tab: Renders student & parent details and opens review modal with UUID', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=parentSignups`);
    await page.waitForSelector('text=Rohan Sharma');
    await page.waitForSelector('text=Vijay Sharma');

    // Open Review Modal
    await page.click('button:has-text("Review")');
    await page.waitForSelector('text=Student Signup Request');
    await page.waitForSelector('text=f5d8a1c2-3b4f-4000-8000-000000000001');
    await page.waitForSelector('text=Social media');

    await page.click('button[aria-label="Close modal"]');
    await context.close();
  });

  // =========================================================================
  // Test 4: Tutor Applications Tab & Review Modal
  // =========================================================================
  test('4. Tutor Applications Tab: Renders qualifications and opens review modal with logistics', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=tutorSignups`);
    await page.waitForSelector('text=Dr. Meera Iyer');
    await page.waitForSelector('text=Ph.D Physics');

    await page.click('button:has-text("Review")');
    await page.waitForSelector('text=Tutor Application');
    await page.waitForSelector('text=a1d8a1c2-3b4f-4000-8000-000000000001');

    await page.click('button[aria-label="Close modal"]');
    await context.close();
  });

  // =========================================================================
  // Test 5: Feedbacks Tab & Review Modal
  // =========================================================================
  test('5. Feedbacks Tab: Renders ratings, message snippet, and opens feedback detail modal', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=feedbacks`);
    await page.waitForSelector('text=Deepa Nair');

    await page.click('table button:has-text("View")');
    await page.waitForSelector('text=User Feedback');
    await page.waitForSelector('text=c3d8a1c2-3b4f-4000-8000-000000000001');
    await page.waitForSelector('text=Exceptional teaching quality and individualized attention.');

    await page.click('button[aria-label="Close modal"]');
    await context.close();
  });

  // =========================================================================
  // Test 6: Newsletter Subscribers Tab & Details Modal
  // =========================================================================
  test('6. Newsletter List: Renders subscribers, provides details modal, and search input', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=newsletters`);
    await page.waitForSelector('text=subscriber@example.com');

    await page.click('button:has-text("Details")');
    await page.waitForSelector('text=Newsletter Subscriber');
    await page.waitForSelector('text=b2d8a1c2-3b4f-4000-8000-000000000001');

    await page.click('button[aria-label="Close modal"]');
    await context.close();
  });

  // =========================================================================
  // Test 7: Mobile Viewport Usability (390 x 844)
  // =========================================================================
  test('7. Mobile Usability: Sidebar toggling, table horizontal scrolling, and responsive actions', async () => {
    // iPhone 14 viewport
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=contacts`);
    await page.waitForSelector('text=Arjun Inquiry');

    // Verify menu button toggles sidebar
    const menuBtn = page.locator('button[aria-label="Toggle sidebar"]');
    await menuBtn.click();

    // Verify table container is scrollable on mobile
    const tableContainer = page.locator('.overflow-x-auto');
    assert.ok(await tableContainer.isVisible(), 'Table container must remain visible with horizontal overflow');

    await context.close();
  });

  // =========================================================================
  // Test 8: Empty Results UI Handling
  // =========================================================================
  test('8. Empty Results UI: Displays clean empty state and zero record count', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    // Override contacts route for this test to return empty results
    await page.route('**/api/contacts*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 0,
          data: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('dhiyoni_admin_token', 'mock_admin_token_jwt_xyz');
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({ username: 'Director Sharma', email: 'admin@dhiyonitutorials.com', role: 'admin' }));
    });

    await page.goto(`${serverUrl}/admin?tab=contacts`);
    await page.waitForSelector('text=No inquiries found matching criteria.');
    await page.waitForSelector('text=0 records found');

    await context.close();
  });

  // =========================================================================
  // Test 9: Unauthorized Session Handling (Redirect to /admin/login)
  // =========================================================================
  test('9. Unauthorized Session: Missing token automatically redirects to /admin/login', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await setupAdminMocks(page);

    // Do NOT set any tokens in localStorage (anonymous visitor)
    await page.goto(`${serverUrl}/admin`);

    // Should automatically redirect to /admin/login
    await page.waitForURL('**/admin/login');
    await page.waitForSelector('text=Admin Portal');
    await page.waitForSelector('#email');

    await context.close();
  });
});

