/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { flexibleAuth } = require('../middleware/auth');

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', flexibleAuth, async (req, res) => {
  try {
    const user = await db.prepare(
      'SELECT id, email, name, plan, created_at FROM users WHERE id = ?'
    ).get(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/auth/register
 * Register or update user from Clerk webhook
 */
router.post('/register', async (req, res) => {
  try {
    const { id, email, name } = req.body;

    if (!id || !email) {
      return res.status(400).json({ error: 'Missing id or email' });
    }

    // Upsert user
    const existing = await db.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).get(id);

    if (existing) {
      await db.prepare(
        'UPDATE users SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(email, name, id);
    } else {
      await db.prepare(
        'INSERT INTO users (id, email, name) VALUES (?, ?, ?)'
      ).run(id, email, name);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/logout
 * Clear session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

module.exports = router;
