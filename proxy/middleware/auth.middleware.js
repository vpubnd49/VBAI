/**
 * Shared Auth Middleware Factory (Prompt 03)
 *
 * Provides reusable Express middleware for Firebase authentication.
 * Uses dependency-injection pattern: pass a modular Firebase Auth client
 * so this module remains testable without needing real Firebase credentials.
 *
 * Usage:
 *   const { makeAuthMiddleware } = require('../middleware/auth.middleware');
 *   const { requireAuth, requireAdmin, optionalAuth } = makeAuthMiddleware(getAuth(app));
 *
 *   router.post('/some-route', requireAuth(), handler);
 *   router.post('/admin-route', requireAuth(), requireAdmin(), handler);
 */
'use strict';

/**
 * Extract Bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = String(req.headers['authorization'] || '').trim();
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Build auth middleware factories bound to a firebase-admin instance.
 * @param {{verifyIdToken: Function}} authClient - modular Firebase Auth client (or mock)
 */
function makeAuthMiddleware(authClient) {
  if (!authClient || typeof authClient.verifyIdToken !== 'function') {
    throw new Error('[auth.middleware] authClient must expose verifyIdToken()');
  }

  /**
   * requireAuth() — verifies Firebase ID token.
   * On success: attaches `req.user` (decoded token) and calls next().
   * On failure: returns 401 JSON.
   */
  function requireAuth() {
    return async function authMiddleware(req, res, next) {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header',
        });
      }
      try {
        const decoded = await authClient.verifyIdToken(token);
        req.user = decoded;
        return next();
      } catch (err) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
      }
    };
  }

  /**
   * requireAdmin() — checks that req.user has admin custom claim.
   * Must be used AFTER requireAuth().
   * On success: calls next().
   * On failure: returns 403 JSON.
   */
  function requireAdmin() {
    return function adminMiddleware(req, res, next) {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'requireAdmin must be used after requireAuth',
        });
      }
      const isAdmin =
        req.user.admin === true ||
        req.user.role === 'admin' ||
        req.user['https://vbai.app/role'] === 'admin';
      if (!isAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required',
        });
      }
      return next();
    };
  }

  /**
   * optionalAuth() — attaches req.user if a valid token is present,
   * but calls next() regardless. Useful for endpoints that give
   * enhanced responses to authenticated users.
   */
  function optionalAuth() {
    return async function optionalAuthMiddleware(req, res, next) {
      const token = extractBearerToken(req);
      if (!token) {
        req.user = null;
        return next();
      }
      try {
        const decoded = await authClient.verifyIdToken(token);
        req.user = decoded;
      } catch (_) {
        req.user = null;
      }
      return next();
    };
  }

  return { requireAuth, requireAdmin, optionalAuth };
}

module.exports = { makeAuthMiddleware, extractBearerToken };
