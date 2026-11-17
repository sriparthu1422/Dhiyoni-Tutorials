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
    if (
      decoded.tokenVersion !== undefined &&
      req.user.tokenVersion !== undefined &&
      decoded.tokenVersion !== req.user.tokenVersion
    ) {
      return res.status(401).json({
        message: 'Session invalidated due to password change or logout. Please log in again.',
      });
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
