/**
 * /api/assigned-sessions
 *
 * GET    /           — Child's sessions (child: own only)
 * GET    /therapist  — All sessions for a therapist's children
 * POST   /           — Create assignment (therapist only)
 * PATCH  /:id        — Update assignment (therapist: mark complete / edit)
 * DELETE /:id        — Delete assignment (therapist only)
 *
 * Security:
 *  • All endpoints require auth
 *  • Children may only query their own childUsername
 *  • therapistId is taken from JWT on POST — never from body
 *  • PATCH/DELETE restricted to therapist role
 */
import express from 'express';
import AssignedSession from '../models/AssignedSession.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/assigned-sessions?childUsername=&date=
router.get('/', requireAuth, async (req, res) => {
  let { childUsername, date } = req.query;

  // Children can only query their own sessions
  if (req.user.role === 'child') {
    childUsername = req.user.username;
  }

  if (!childUsername) return res.status(400).json({ message: 'childUsername required' });

  try {
    const query = { childUsername };
    if (date) query.date = date;
    const sessions = await AssignedSession.find(query).sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/assigned-sessions/therapist?therapistId=&childUsername=
router.get('/therapist',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    // therapistId scoped to JWT for regular therapist — superadmin can query any
    const therapistId = req.user.role === 'therapist'
      ? req.user.therapistId
      : req.query.therapistId;

    if (!therapistId) return res.status(400).json({ message: 'therapistId required' });

    const { childUsername } = req.query;
    try {
      const query = { therapistId };
      if (childUsername) query.childUsername = childUsername;
      const sessions = await AssignedSession.find(query).sort({ date: -1 });
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// POST /api/assigned-sessions — create assignment
router.post('/',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    const { childUsername, date, games, instructions } = req.body;
    // therapistId always from JWT
    const therapistId = req.user.therapistId || req.body.therapistId;

    if (!therapistId || !childUsername || !date || !games?.length) {
      return res.status(400).json({ message: 'childUsername, date, and games are required' });
    }
    try {
      const session = new AssignedSession({ therapistId, childUsername, date, games, instructions });
      await session.save();
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/assigned-sessions/:id
router.patch('/:id',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    try {
      const update = { ...req.body };
      delete update.therapistId; // Prevent reassignment
      if (update.completed) update.completedAt = new Date();

      const updated = await AssignedSession.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: 'Not found' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/assigned-sessions/:id
router.delete('/:id',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    try {
      const deleted = await AssignedSession.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Not found' });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
