import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Helper to extract cookie token from req.cookies or raw Cookie header
 */
function extractCookieToken(req) {
  if (req.cookies && req.cookies.dhiyoni_admin_session) {
    return req.cookies.dhiyoni_admin_session;
  }
  if (req.headers && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)dhiyoni_admin_session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/**
 * Protect middleware: Verifies JWT Bearer token or HttpOnly session cookie,
 * checks tokenVersion revocation, and attaches authenticated user.
 */
export const protect = async (req, res, next) => {
  let token = null;

  // 1. Try Bearer token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[1].trim() !== '') {
      token = parts[1].trim();
    }
  }

  // 2. Fall back to HttpOnly session cookie
  if (!token) {
    token = extractCookieToken(req);
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user excluding password
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    // Server-side session invalidation: Verify tokenVersion
    // Legacy tokens missing tokenVersion are treated as version 0.
    // If user's tokenVersion > 0 (e.g. after logout or password change), legacy tokens are strictly rejected.
    const tokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
    const currentVersion = req.user.tokenVersion !== undefined ? req.user.tokenVersion : 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({
        message: 'Session invalidated due to password change or logout. Please log in again.',
      });
    }

    // CSRF Defense for Cookie-Authenticated State-Changing Requests:
    // If request relied on the session cookie (without a Bearer token in Authorization header),
    // enforce that state-changing methods (POST, PUT, DELETE, PATCH) originate from an allowed origin.
    const isCookieAuth = !req.headers.authorization && !!extractCookieToken(req);
    if (isCookieAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const allowedOrigins = [
        'https://www.dhiyonitutorials.com',
        'https://dhiyonitutorials.com',
        process.env.FRONTEND_URL,
      ].filter(Boolean);

      const requestOrigin =
        req.headers.origin ||
        (req.headers.referer ? new URL(req.headers.referer).origin : null);

      if (process.env.NODE_ENV === 'production' || req.headers['x-test-csrf'] === 'true') {
        if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
          return res.status(403).json({
            message: 'CSRF validation failed: Request origin is not authorized for cookie-based state changes.',
          });
        }
      }
    }

    // Set strict cache headers for all authenticated responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

/**
 * Admin middleware: Verifies the authenticated user holds the administrator role.
 * Must be placed after `protect` middleware.
 */
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Administrator privileges required' });
};
