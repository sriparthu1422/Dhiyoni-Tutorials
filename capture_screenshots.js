import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'https://www.dhiyonitutorials.com';

async function run() {
  console.log('Launching browser (Edge)...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  const pagesToCapture = [
    { name: '01_home_hero.png', path: '/', fullPage: false, wait: 2000 },
    { name: '02_home_full.png', path: '/', fullPage: true, wait: 2500 },
    { name: '03_about_page.png', path: '/about', fullPage: true, wait: 2000 },
    { name: '04_courses_page.png', path: '/courses', fullPage: true, wait: 2000 },
    { name: '05_tutors_page.png', path: '/tutors', fullPage: true, wait: 2500 },
    { name: '06_gallery_page.png', path: '/gallery', fullPage: true, wait: 2000 },
    { name: '07_contact_page.png', path: '/contact', fullPage: true, wait: 2000 },
    { name: '08_parent_signup.png', path: '/parent-signup', fullPage: true, wait: 2000 },
    { name: '09_tutor_signup.png', path: '/tutor-signup', fullPage: true, wait: 2000 },
    { name: '10_faq_page.png', path: '/faq', fullPage: true, wait: 1500 },
    { name: '11_admin_login.png', path: '/admin/login', fullPage: false, wait: 1500 },
  ];

  for (const item of pagesToCapture) {
    const targetUrl = `${BASE_URL}${item.path}`;
    console.log(`Navigating to ${targetUrl}...`);
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });
    } catch (e) {
      console.log(`Networkidle timeout for ${targetUrl}, continuing...`);
    }
    await page.waitForTimeout(item.wait);
    const savePath = path.join(SCREENSHOTS_DIR, item.name);
    await page.screenshot({ path: savePath, fullPage: item.fullPage });
    console.log(`Saved screenshot: ${item.name}`);
  }

  // Admin Login Flow
  console.log('Logging into Admin Portal...');
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await page.fill('input#email', 'admin@dhiyoni.com');
  await page.fill('input#password', 'DhiyoniAdmin2026!');
  await page.click('button[type="submit"]');

  console.log('Submitted credentials, waiting for navigation to admin...');
  await page.waitForURL('**/admin**', { timeout: 15000 }).catch(err => console.log('Wait for URL note:', err.message));
  await page.waitForTimeout(4000);

  // Capture Admin Overview
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_admin_overview.png'), fullPage: false });
  console.log('Saved: 12_admin_overview.png');

  // Admin tabs to capture
  const adminTabs = [
    { title: 'Parent Requests', file: '13_admin_parent_signups.png' },
    { title: 'Tutor Applications', file: '14_admin_tutor_applications.png' },
    { title: 'Inquiries', file: '15_admin_inquiries.png' },
    { title: 'Feedbacks', file: '16_admin_feedbacks.png' },
    { title: 'Newsletter Subscribers', file: '17_admin_newsletters.png' },
    { title: 'Manage Tutors', file: '18_admin_manage_tutors.png' },
    { title: 'Manage Gallery', file: '19_admin_manage_gallery.png' },
    { title: 'Security Settings', file: '20_admin_security_settings.png' },
  ];

  for (const tab of adminTabs) {
    console.log(`Clicking admin tab: ${tab.title}...`);
    const button = page.locator(`button[title="${tab.title}"]`);
    if (await button.count() > 0) {
      await button.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, tab.file), fullPage: false });
      console.log(`Saved: ${tab.file}`);
    } else {
      console.warn(`Tab button not found: ${tab.title}`);
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
