/**
 * Rate Limiting Middleware for Dhiyoni Tutorials
 * Implements sliding-window and failed-attempt tracking with IP normalization.
 * Enforced in production or when explicitly enabled via ENABLE_RATE_LIMIT / x-test-rate-limit.
 */

// In-memory store for rate limiting with automatic cleanup
const stores = {
  loginFailures: new Map(), // ip -> { count, resetAt }
  formSubmissions: new Map(), // ip -> [timestamps]
  exportRequests: new Map(), // ip -> [timestamps]
};

// Periodic garbage collection every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of stores.loginFailures.entries()) {
    if (record.resetAt <= now) stores.loginFailures.delete(key);
  }
  for (const [key, timestamps] of stores.formSubmissions.entries()) {
    const valid = timestamps.filter((t) => t > now - 60000);
    if (valid.length === 0) stores.formSubmissions.delete(key);
    else stores.formSubmissions.set(key, valid);
  }
  for (const [key, timestamps] of stores.exportRequests.entries()) {
    const valid = timestamps.filter((t) => t > now - 300000);
    if (valid.length === 0) stores.exportRequests.delete(key);
    else stores.exportRequests.set(key, valid);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  try {
    // When trust proxy is configured in Express (app.set('trust proxy', 1)),
    // req.ip resolves the client IP securely via Express's trusted proxy logic,
    // ignoring spoofed client-supplied values in X-Forwarded-For.
    if (req.ip) return req.ip;
    if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
    if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
    if (req.headers && req.headers['x-forwarded-for']) {
      return req.headers['x-forwarded-for'].split(',')[0].trim();
    }
  } catch {
    // In mock request environments where socket is undefined
  }
  return '127.0.0.1';
}

function isRateLimitActive(req) {
  // In production, rate limiting is STRICTLY ALWAYS active.
  // Forged headers (e.g. x-bypass-rate-limit) are NEVER honored in production.
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  // In staging or when explicitly toggled on via environment variable
  if (process.env.ENABLE_RATE_LIMIT === 'true') {
    return true;
  }
  // For isolated test suites that explicitly test rate limiting
  if (req?.headers?.['x-test-rate-limit'] === 'true') {
    return true;
  }
  // Bypassed by default in test/development environments to prevent test harness flakiness
  return false;
}

/**
 * Login Rate Limiter: Tracks consecutive failed login attempts.
 * Max 5 failed attempts within 15 minutes.
 */
export const loginRateLimiter = (req, res, next) => {
  if (!isRateLimitActive(req)) {
    return next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const record = stores.loginFailures.get(ip);

  if (record && record.resetAt > now && record.count >= 5) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfterSeconds: retryAfterSec,
    });
  }

  // Hook into response to record failures or clear on success
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401) {
      // Record failure
      const existing = stores.loginFailures.get(ip);
      if (!existing || existing.resetAt <= now) {
        stores.loginFailures.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
      } else {
        existing.count += 1;
      }
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      // Clear failure record on successful login
      stores.loginFailures.delete(ip);
    }
    return originalJson(body);
  };

  next();
};

/**
 * Public Form Submission Rate Limiter:
 * Up to 25 submissions per minute per IP.
 */
export const formSubmissionRateLimiter = (req, res, next) => {
  if (!isRateLimitActive(req)) {
    return next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxLimit = 25;

  let timestamps = stores.formSubmissions.get(ip) || [];
  timestamps = timestamps.filter((t) => t > now - windowMs);

  if (timestamps.length >= maxLimit) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      message: 'Submission rate limit reached. Please wait a moment before trying again.',
      retryAfterSeconds: retryAfterSec,
    });
  }

  timestamps.push(now);
  stores.formSubmissions.set(ip, timestamps);
  next();
};

/**
 * Export Initiation Rate Limiter:
 * Up to 10 export attempts per 5 minutes per IP.
 */
export const exportRateLimiter = (req, res, next) => {
  if (!isRateLimitActive(req)) {
    return next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxLimit = 10;

  let timestamps = stores.exportRequests.get(ip) || [];
  timestamps = timestamps.filter((t) => t > now - windowMs);

  if (timestamps.length >= maxLimit) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      message: 'Too many export initiation requests. Please wait a few minutes before retrying.',
      retryAfterSeconds: retryAfterSec,
    });
  }

  timestamps.push(now);
  stores.exportRequests.set(ip, timestamps);
  next();
};

/**
 * Helper to reset rate limits (used in automated tests)
 */
export const resetRateLimits = () => {
  stores.loginFailures.clear();
  stores.formSubmissions.clear();
  stores.exportRequests.clear();
};
