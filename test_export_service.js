import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_CATEGORIES,
  CATEGORY_LABELS,
  getAdminHeaders,
  initiateExport,
  getExportJobStatus,
  getExportHistory,
} from './frontend/src/services/exportService.js';

// Setup browser globals mock for Node environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

global.window = {
  location: {
    origin: 'http://localhost:5000',
  },
};

describe('Export API Service Unit Tests (Phase 6.1)', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  test('VALID_CATEGORIES contains all 5 required submission types', () => {
    assert.deepEqual(VALID_CATEGORIES, [
      'contacts',
      'parentSignups',
      'tutorSignups',
      'newsletters',
      'feedbacks',
    ]);
    assert.equal(CATEGORY_LABELS.contacts, 'Contact Enquiries');
    assert.equal(CATEGORY_LABELS.parentSignups, 'Parent Registrations');
    assert.equal(CATEGORY_LABELS.tutorSignups, 'Tutor Applications');
    assert.equal(CATEGORY_LABELS.newsletters, 'Newsletter Subscribers');
    assert.equal(CATEGORY_LABELS.feedbacks, 'User Feedback');
  });

  test('getAdminHeaders includes Authorization when token is present', () => {
    mockStorage.set('dhiyoni_admin_token', 'jwt_test_token_123');
    const headers = getAdminHeaders();
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers['Authorization'], 'Bearer jwt_test_token_123');
  });

  test('getAdminHeaders sets empty Authorization when token is absent', () => {
    const headers = getAdminHeaders();
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers['Authorization'], '');
  });

  test('initiateExport sends POST with correct body and receives 202 response', async () => {
    mockStorage.set('dhiyoni_admin_token', 'admin_tok_abc');
    let calledUrl = '';
    let calledOptions = {};

    global.fetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 202,
        json: async () => ({
          success: true,
          jobId: 'exp_12345_abc',
          status: 'pending',
          destination: {
            spreadsheetId: '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY',
          },
        }),
      };
    };

    const res = await initiateExport({ categories: ['contacts', 'newsletters'] });
    assert.equal(calledUrl, '/api/export');
    assert.equal(calledOptions.method, 'POST');
    assert.equal(calledOptions.headers.Authorization, 'Bearer admin_tok_abc');
    assert.deepEqual(JSON.parse(calledOptions.body), {
      runSync: false,
      categories: ['contacts', 'newsletters'],
    });
    assert.equal(res.success, true);
    assert.equal(res.jobId, 'exp_12345_abc');
    assert.equal(res.status, 'pending');
  });

  test('initiateExport handles 409 conflict error properly with lock details', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        message: 'Concurrent export in progress',
        activeJobId: 'exp_running_999',
        lockedAt: '2026-11-16T15:00:00.000Z',
        expiresAt: '2026-11-16T15:05:00.000Z',
      }),
    });

    try {
      await initiateExport();
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.equal(err.status, 409);
      assert.equal(err.message, 'Concurrent export in progress');
      assert.equal(err.activeJobId, 'exp_running_999');
    }
  });

  test('getExportJobStatus validates jobId input', async () => {
    await assert.rejects(
      async () => await getExportJobStatus(''),
      /Valid jobId is required/
    );
  });

  test('getExportJobStatus sends GET request and returns job details', async () => {
    global.fetch = async (url) => {
      assert.equal(url, '/api/export/exp_12345');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            jobId: 'exp_12345',
            status: 'completed',
            recordCounts: { contacts: 5 },
          },
        }),
      };
    };

    const result = await getExportJobStatus('exp_12345');
    assert.equal(result.success, true);
    assert.equal(result.data.jobId, 'exp_12345');
    assert.equal(result.data.status, 'completed');
  });

  test('getExportHistory sends GET with pagination params', async () => {
    global.fetch = async (url) => {
      const u = new URL(url);
      assert.equal(u.searchParams.get('page'), '2');
      assert.equal(u.searchParams.get('limit'), '15');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          data: [{ jobId: 'exp_999' }],
          pagination: { total: 16, page: 2, limit: 15, totalPages: 2 },
        }),
      };
    };

    const result = await getExportHistory({ page: 2, limit: 15 });
    assert.equal(result.success, true);
    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.totalPages, 2);
  });
});

