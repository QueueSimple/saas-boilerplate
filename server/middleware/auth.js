/**
 * Authentication Middleware
 *
 * Supports:
 * - Clerk authentication
 * - Session-based auth
 * - Test mode (for development)
 */

const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

/**
 * Flexible auth middleware
 * Extracts userId from session, Clerk, or test headers
 */
const flexibleAuth = (req, res, next) => {
  // Priority: session > Clerk > test header > query param
  const userId = req.session?.userId
    || req.auth?.userId
    || req.headers['x-user-id']
    || req.query.userId;

  if (!userId && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Allow dev mode without auth
  if (!userId && process.env.NODE_ENV !== 'production') {
    req.userId = process.env.DEV_USER_ID || 'dev-user';
  } else {
    req.userId = userId;
  }

  next();
};

/**
 * Strict Clerk auth (for production routes)
 */
const requireClerkAuth = ClerkExpressRequireAuth({
  onError: (err) => {
    console.error('Clerk auth error:', err);
  }
});

/**
 * Optional auth (allows unauthenticated access)
 */
const optionalAuth = (req, res, next) => {
  req.userId = req.session?.userId
    || req.auth?.userId
    || req.headers['x-user-id']
    || req.query.userId
    || null;
  next();
};

module.exports = {
  flexibleAuth,
  requireClerkAuth,
  optionalAuth
};
