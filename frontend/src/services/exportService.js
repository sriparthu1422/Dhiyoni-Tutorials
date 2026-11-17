/**
 * DHIYONI Tutorials - Export API Service
 * Phase 6: One-Click Google Sheets Export Integration
 *
 * Provides client methods to initiate exports, poll job statuses,
 * and retrieve paginated export history from the protected backend API.
 */

export const VALID_CATEGORIES = [
  'contacts',
  'parentSignups',
  'tutorSignups',
  'newsletters',
  'feedbacks',
];

export const CATEGORY_LABELS = {
  contacts: 'Contact Enquiries',
  parentSignups: 'Parent Registrations',
  tutorSignups: 'Tutor Applications',
  newsletters: 'Newsletter Subscribers',
  feedbacks: 'User Feedback',
};

/**
 * Get authorization headers for admin requests
 * @returns {HeadersInit}
 */
export function getAdminHeaders() {
  const token = localStorage.getItem('dhiyoni_admin_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

/**
 * Handle API error responses consistently
 * @param {Response} res
 * @param {string} fallbackMessage
 */
async function handleApiError(res, fallbackMessage) {
  let errorData = {};
  try {
    errorData = await res.json();
  } catch {
    // Non-JSON response
  }

  const message = errorData.message || `${fallbackMessage} (HTTP ${res.status})`;
  const error = new Error(message);
  error.status = res.status;
  error.data = errorData;

  if (res.status === 409) {
    error.activeJobId = errorData.activeJobId;
    error.lockedAt = errorData.lockedAt;
    error.expiresAt = errorData.expiresAt;
  }

  throw error;
}

/**
 * Initiate an export job to Google Sheets
 * @param {Object} options
 * @param {string[]} [options.categories] - Array of collection names to export
 * @param {string} [options.spreadsheetId] - Optional custom destination spreadsheet ID
 * @param {boolean} [options.runSync=false] - Whether to run synchronously
 * @returns {Promise<{success: boolean, jobId: string, status: string, destination?: object, data?: object}>}
 */
export async function initiateExport({ categories, spreadsheetId, runSync = false, idempotencyKey } = {}) {
  const payload = { runSync };

  if (categories && Array.isArray(categories) && categories.length > 0) {
    payload.categories = categories;
  }

  if (spreadsheetId && typeof spreadsheetId === 'string' && spreadsheetId.trim()) {
    payload.spreadsheetId = spreadsheetId.trim();
  }

  const reqHeaders = getAdminHeaders();
  const activeIdempotencyKey =
    idempotencyKey ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  reqHeaders['Idempotency-Key'] = activeIdempotencyKey;
  if (idempotencyKey) {
    payload.clientRequestId = idempotencyKey;
  }

  let res;
  try {
    res = await fetch('/api/export', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    const error = new Error(
      netErr.message || 'Unable to connect to export service. Please check your network connection.'
    );
    error.isNetworkError = true;
    throw error;
  }

  if (!res.ok) {
    await handleApiError(res, 'Failed to initiate export');
  }

  const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : 'application/json';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status}). Please verify API connectivity.`);
  }

  const json = await res.json();
  return {
    success: true,
    jobId: json.jobId || json.data?.jobId,
    status: json.status || json.data?.status || 'pending',
    destination: json.destination || json.data?.destination,
    data: json.data,
  };
}

/**
 * Get status and progress details of a specific export job
 * @param {string} jobId
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getExportJobStatus(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('Valid jobId is required to check export status');
  }

  let res;
  try {
    res = await fetch(`/api/export/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: getAdminHeaders(),
    });
  } catch (netErr) {
    const error = new Error(
      netErr.message || 'Unable to connect to export service. Please check your network connection.'
    );
    error.isNetworkError = true;
    throw error;
  }

  if (!res.ok) {
    await handleApiError(res, `Failed to retrieve status for export job ${jobId}`);
  }

  const json = await res.json();
  return {
    success: true,
    data: json.data,
  };
}

/**
 * Get paginated export history
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<{success: boolean, count: number, data: object[], pagination: object}>}
 */
export async function getExportHistory({ page = 1, limit = 10 } = {}) {
  const url = new URL('/api/export', window.location.origin);
  url.searchParams.set('page', String(Math.max(1, page)));
  url.searchParams.set('limit', String(Math.max(1, Math.min(50, limit))));

  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: getAdminHeaders(),
    });
  } catch (netErr) {
    const error = new Error(
      netErr.message || 'Unable to connect to export service. Please check your network connection.'
    );
    error.isNetworkError = true;
    throw error;
  }

  if (!res.ok) {
    await handleApiError(res, 'Failed to load export history');
  }

  const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : 'application/json';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status}). Please verify API connectivity.`);
  }

  const json = await res.json();
  return {
    success: true,
    count: json.count || 0,
    data: json.data || [],
    pagination: json.pagination || {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

