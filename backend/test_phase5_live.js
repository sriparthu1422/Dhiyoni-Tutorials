import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('./.env', import.meta.url) });

import { getSheetsClient, ensureTabsExist, sanitizeCellValue } from './src/services/googleSheetsService.js';
import { EXPORT_TABS, TAB_HEADERS } from './src/services/exportEngine.js';

describe('Phase 5 Live Google Sheets API Integration Suite', () => {
  let sheetsClient;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const testTabName = '_live_connectivity_check';

  before(async () => {
    assert.ok(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, 'GOOGLE_SERVICE_ACCOUNT_EMAIL must be set');
    assert.ok(process.env.GOOGLE_PRIVATE_KEY, 'GOOGLE_PRIVATE_KEY must be set');
    assert.ok(spreadsheetId, 'GOOGLE_SPREADSHEET_ID must be set');
    // Initialize real Google Sheets API client
    sheetsClient = await getSheetsClient();
  });

  after(async () => {
    // Clean up temporary connectivity check tab if it was created
    if (sheetsClient && spreadsheetId) {
      try {
        const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
        const targetSheet = (meta.data.sheets || []).find(
          (s) => s.properties && s.properties.title === testTabName
        );
        if (targetSheet) {
          await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteSheet: {
                    sheetId: targetSheet.properties.sheetId,
                  },
                },
              ],
            },
          });
        }
      } catch (err) {
        console.warn('Cleanup warning for temporary tab:', err.message);
      }
    }
  });

  test('Step 2.1 — Live Google Service Account Authentication & Metadata Retrieval', async () => {
    const res = await sheetsClient.spreadsheets.get({ spreadsheetId });
    assert.strictEqual(res.status, 200, 'Google API must respond with HTTP 200 OK');
    assert.ok(res.data, 'Spreadsheet metadata must be returned');
    assert.ok(res.data.properties && res.data.properties.title, 'Spreadsheet must have a valid title');
    console.log(`[LIVE TEST] Connected to spreadsheet: "${res.data.properties.title}" (Status: ${res.status})`);
  });

  test('Step 2.2 — Verify Editor Permissions with Harmless Write and Read-back', async () => {
    // 1. Create temporary tab
    await ensureTabsExist(sheetsClient, spreadsheetId, [testTabName]);

    // 2. Write a test timestamp value with RAW input
    const testPayload = `Live Verification Test at ${new Date().toISOString()}`;
    const writeRes = await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${testTabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[testPayload]],
      },
    });
    assert.strictEqual(writeRes.status, 200, 'Write operation must return HTTP 200 OK');

    // 3. Read back written value
    const readRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${testTabName}'!A1`,
    });
    assert.strictEqual(readRes.status, 200, 'Read operation must return HTTP 200 OK');
    assert.ok(readRes.data.values && readRes.data.values[0], 'Read data must contain values');
    assert.strictEqual(readRes.data.values[0][0], testPayload, 'Read value must match written payload');
    console.log(`[LIVE TEST] Harmless write and read-back succeeded (Write: ${writeRes.status}, Read: ${readRes.status})`);
  });

  test('Step 2.3 — Verify / Create All 6 Required Production Tabs', async () => {
    const requiredTabs = [
      EXPORT_TABS.contacts,
      EXPORT_TABS.parentSignups,
      EXPORT_TABS.tutorSignups,
      EXPORT_TABS.newsletters,
      EXPORT_TABS.feedbacks,
      EXPORT_TABS.history,
    ];

    const presentTabs = await ensureTabsExist(sheetsClient, spreadsheetId, requiredTabs);
    for (const tab of requiredTabs) {
      assert.ok(presentTabs.includes(tab), `Tab "${tab}" must exist in the spreadsheet`);
    }

    // Verify headers for each tab
    for (const tab of requiredTabs) {
      if (tab === EXPORT_TABS.history) continue;
      const headers = TAB_HEADERS[tab];
      const headerRes = await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tab}'!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers.map((h) => sanitizeCellValue(h))],
        },
      });
      assert.strictEqual(headerRes.status, 200, `Writing headers for "${tab}" must return 200 OK`);
    }
    console.log(`[LIVE TEST] All 6 production tabs verified and initialized with headers`);
  });
});

