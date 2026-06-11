/**
 * /api/superadmin
 *
 * POST /therapists               — Create a new therapist account
 * GET  /therapists-with-children — List all therapists and their children
 *
 * Security:
 *  • Both endpoints require superadmin JWT
 *  • Passwords are never returned in responses
 *  • Input validation on therapist creation
 */
import express from 'express';
import Therapist from '../models/Therapist.js';
import Child from '../models/Child.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/superadmin/therapists — create a new therapist
router.post('/therapists',
  requireAuth,
  requireRole('superadmin'),
  async (req, res) => {
    const { therapistId, name, username, password } = req.body;

    if (!therapistId || typeof therapistId !== 'string' || therapistId.trim().length === 0) {
      return res.status(400).json({ message: 'therapistId is required' });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'name is required' });
    }
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ message: 'username must be at least 3 characters' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }

    try {
      const newTherapist = new Therapist({
        therapistId: therapistId.trim(),
        name:        name.trim(),
        username:    username.trim().toLowerCase(),
        password,
      });
      await newTherapist.save();
      // toJSON hook strips password automatically
      res.status(201).json({ message: 'Therapist added successfully', therapist: newTherapist });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Username or therapistId already exists' });
      }
      console.error('[superadmin] Create therapist error:', error.message);
      res.status(400).json({ message: error.message });
    }
  }
);

// GET /api/superadmin/therapists-with-children — list all therapists + their children
router.get('/therapists-with-children',
  requireAuth,
  requireRole('superadmin'),
  async (req, res) => {
    try {
      const therapists = await Therapist.find().select('-password').lean();
      const result = [];
      for (const therapist of therapists) {
        const children = await Child.find({ therapistId: therapist.therapistId }).select('-password').lean();
        result.push({ therapist, children });
      }
      res.json(result);
    } catch (error) {
      console.error('[superadmin] Fetch error:', error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
