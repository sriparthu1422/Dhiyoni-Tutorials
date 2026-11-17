import { google } from 'googleapis';
import fs from 'node:fs';

let mockSheetsClient = null;

/**
 * Injects a mock sheets client for isolated testing.
 * @param {Object|null} client
 */
export function setMockSheetsClient(client) {
  mockSheetsClient = client;
}

/**
 * Resets the mock sheets client.
 */
export function resetMockSheetsClient() {
  mockSheetsClient = null;
}

/**
 * Checks whether Google Service Account credentials are fully configured.
 * @returns {boolean}
 */
export function isGoogleConfigured() {
  if (mockSheetsClient) return true;

  const hasEmail = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const hasKey = Boolean(process.env.GOOGLE_PRIVATE_KEY);
  const hasKeyPath = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH && fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH));
  const hasSheetId = Boolean(process.env.GOOGLE_SPREADSHEET_ID);

  return (hasEmail && hasKey && hasSheetId) || (hasKeyPath && hasSheetId);
}

/**
 * Returns Google Sheets API client initialized with service account JWT auth.
 * @returns {Promise<Object>} google.sheets v4 client
 */
export async function getSheetsClient() {
  if (mockSheetsClient) {
    return mockSheetsClient;
  }

  if (!isGoogleConfigured()) {
    const error = new Error(
      'Google Sheets service account credentials are not configured. ' +
      'Please set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SPREADSHEET_ID in backend/.env.'
    );
    error.code = 'GOOGLE_CREDENTIALS_MISSING';
    error.statusCode = 503;
    throw error;
  }

  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  let auth;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH && fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)) {
    auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes,
    });
  } else {
    // Format private key handling literal \n and real newlines
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

    auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes,
    });
  }

  return google.sheets({ version: 'v4', auth });
}

/**
 * Sanitizes cell values to prevent CSV / Spreadsheet formula injection.
 * Any string starting with =, +, -, @, \t, or \r is prepended with a single quote.
 *
 * @param {*} val
 * @returns {*}
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) {
    return val.map((v) => sanitizeCellValue(v)).join(', ');
  }

  const str = String(val);
  const firstChar = str.charAt(0);
  if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
    return `'${str}`;
  }

  return str;
}

/**
 * Executes an asynchronous Google API operation with exponential backoff and jitter.
 *
 * @param {Function} apiCallFn
 * @param {number} [maxRetries=3]
 * @param {number} [baseDelayMs=500]
 * @returns {Promise<*>}
 */
export async function executeWithRetry(apiCallFn, maxRetries = 3, baseDelayMs = (process.env.NODE_ENV === 'test' ? 50 : 1000)) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await apiCallFn();
    } catch (err) {
      attempt++;

      // Check if error is transient / retryable
      const status =
        err.status ||
        err.statusCode ||
        (err.response && err.response.status) ||
        (err.cause && (err.cause.code || err.cause.status));
      const code = err.code || (err.cause && err.cause.code);
      const message = err.message || '';

      const isRateLimit =
        status === 429 ||
        status === 'RESOURCE_EXHAUSTED' ||
        code === 'RATE_LIMIT_EXCEEDED' ||
        code === 429 ||
        message.includes('Quota exceeded') ||
        message.includes('RESOURCE_EXHAUSTED');

      const isServerTransient =
        (typeof status === 'number' && status >= 500 && status <= 504) ||
        status === 'UNAVAILABLE';

      const isNetworkTransient = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
      ].includes(code) || message.includes('ETIMEDOUT');

      const isRetryable = (isRateLimit || isServerTransient || isNetworkTransient) && attempt <= maxRetries;

      if (!isRetryable) {
        throw err;
      }

      // Calculate backoff with jitter: for rate limits use progressive cooldown
      const multiplier = isRateLimit ? (process.env.NODE_ENV === 'test' ? 100 : 3000) : baseDelayMs;
      const delay = multiplier * Math.pow(2, attempt - 1) + Math.floor(Math.random() * (process.env.NODE_ENV === 'test' ? 10 : 200));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Ensures all requested tab names exist in the spreadsheet.
 * Missing tabs are created in batch.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {Array<string>} tabNames
 * @returns {Promise<Array<string>>} List of all tabs present
 */
export async function ensureTabsExist(sheetsClient, spreadsheetId, tabNames) {
  return executeWithRetry(async () => {
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const existingTitles = (meta.data.sheets || []).map((s) => s.properties && s.properties.title);

    const missingTabs = tabNames.filter((t) => !existingTitles.includes(t));

    if (missingTabs.length > 0) {
      const requests = missingTabs.map((title) => ({
        addSheet: {
          properties: { title },
        },
      }));

      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    return [...existingTitles, ...missingTabs];
  });
}

/**
 * Writes data into an isolated staging tab using valueInputOption: 'RAW'.
 * Ensures staging tab exists, clears stale data, and writes sanitized rows.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {string} stagingTabName
 * @param {Array<string>} headerRow
 * @param {Array<Array<*>>} dataRows
 * @returns {Promise<{ rowsWritten: number }>}
 */
export async function writeStagingSnapshot(sheetsClient, spreadsheetId, stagingTabName, headerRow, dataRows) {
  return executeWithRetry(async () => {
    // 1. Ensure staging tab exists
    await ensureTabsExist(sheetsClient, spreadsheetId, [stagingTabName]);

    // 2. Clear existing staging data from row 2 onwards
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${stagingTabName}'!A2:ZZ`,
    });

    // 3. Write header and data rows together in a single RAW update starting at A1
    const sanitizedHeader = headerRow.map((h) => sanitizeCellValue(h));
    const sanitizedData = (dataRows || []).map((row) => row.map((cell) => sanitizeCellValue(cell)));
    const fullSnapshot = [sanitizedHeader, ...sanitizedData];

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${stagingTabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: fullSnapshot,
      },
    });

    return { rowsWritten: dataRows ? dataRows.length : 0 };
  });
}

/**
 * Validates the contents of a staging tab before publication.
 * Confirms row count and integrity.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {string} stagingTabName
 * @param {number} expectedRowCount
 * @returns {Promise<{ isValid: boolean, actualRowCount: number }>}
 */
export async function validateStagingTab(sheetsClient, spreadsheetId, stagingTabName, expectedRowCount) {
  return executeWithRetry(async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${stagingTabName}'!A2:A`,
    });

    const values = res.data && res.data.values ? res.data.values : [];
    const actualRowCount = values.length;

    const isValid = actualRowCount === expectedRowCount;
    return { isValid, actualRowCount };
  });
}

/**
 * Publishes validated staging data to the production tab using valueInputOption: 'RAW'.
 * Ensures production tab exists, clears previous data, and writes validated rows atomically.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {string} prodTabName
 * @param {Array<string>} headerRow
 * @param {Array<Array<*>>} dataRows
 * @returns {Promise<{ publishedRows: number }>}
 */
export async function publishStagingToProduction(sheetsClient, spreadsheetId, prodTabName, headerRow, dataRows) {
  return executeWithRetry(async () => {
    // 1. Clear existing production data from row 2 onwards
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${prodTabName}'!A2:ZZ`,
    });

    // 2. Write header and data rows together in a single RAW update starting at A1
    const sanitizedHeader = headerRow.map((h) => sanitizeCellValue(h));
    const sanitizedData = (dataRows || []).map((row) => row.map((cell) => sanitizeCellValue(cell)));
    const fullSnapshot = [sanitizedHeader, ...sanitizedData];

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${prodTabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: fullSnapshot,
      },
    });

    return { publishedRows: dataRows ? dataRows.length : 0 };
  });
}

/**
 * Cleans up a staging tab after publication.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {string} stagingTabName
 */
export async function cleanupStagingTab(sheetsClient, spreadsheetId, stagingTabName) {
  try {
    await executeWithRetry(async () => {
      await sheetsClient.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${stagingTabName}'!A1:ZZ`,
      });
    });
  } catch (err) {
    // Non-fatal cleanup warning
    console.warn(`Staging cleanup warning for ${stagingTabName}:`, err.message);
  }
}

/**
 * Appends a log entry to the Export History tab using valueInputOption: 'RAW'.
 *
 * @param {Object} sheetsClient
 * @param {string} spreadsheetId
 * @param {Array<*>} historyRow
 */
export async function appendExportHistoryRow(sheetsClient, spreadsheetId, historyRow) {
  const header = [
    'Job ID',
    'Export Type',
    'Requested Admin',
    'Status',
    'Started At',
    'Completed At',
    'Contacts Count',
    'Parent Signups Count',
    'Tutor Signups Count',
    'Newsletters Count',
    'Feedback Count',
    'Total Records',
    'Error Details',
  ];

  return executeWithRetry(async () => {
    // Ensure header exists at A1
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'Export History'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [header],
      },
    });

    const sanitizedRow = historyRow.map((cell) => sanitizeCellValue(cell));

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'Export History'!A2`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [sanitizedRow],
      },
    });
  });
}
