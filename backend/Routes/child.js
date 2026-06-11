/**
 * /api/children
 *
 * POST /      — Therapist creates a child account
 * GET  /      — Therapist lists their own children
 *
 * Security:
 *  • Both endpoints require a valid JWT (requireAuth)
 *  • POST requires therapist role — therapistId is taken from JWT, not body
 *  • GET requires therapist role — filters by JWT therapistId
 *  • Passwords are NEVER returned (toJSON hook strips them, select('-password'))
 *  • Input length limits prevent oversized payloads
 */
import express from 'express';
import Child from '../models/Child.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/children — create a child (therapist only)
router.post('/',
  requireAuth,
  requireRole('therapist'),
  async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (name.length > 100 || username.length > 50) {
      return res.status(400).json({ error: 'Input too long' });
    }

    try {
      // Use therapistId from the authenticated JWT — never trust the request body
      const newChild = new Child({
        name:        name.trim(),
        username:    username.trim().toLowerCase(),
        password,                          // bcrypt hook hashes it before save
        therapistId: req.user.therapistId, // from JWT
      });
      await newChild.save();
      // toJSON strips password automatically
      res.status(201).json({ message: 'Child added successfully', child: newChild });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Username already taken. Choose a different username.' });
      }
      console.error('[child] Create error:', error.message);
      res.status(500).json({ error: 'Failed to add child' });
    }
  }
);

// GET /api/children — list children for the authenticated therapist
router.get('/',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    try {
      // Therapist: only their children. SuperAdmin: all children (by optional therapistId filter).
      const filter = req.user.role === 'therapist'
        ? { therapistId: req.user.therapistId }
        : {};

      const children = await Child.find(filter).select('-password').lean();
      res.json(children);
    } catch (err) {
      console.error('[child] Fetch error:', err.message);
      res.status(500).json({ error: 'Failed to fetch children' });
    }
  }
);

export default router;
