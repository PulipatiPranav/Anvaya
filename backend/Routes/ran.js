/**
 * /api/ran
 *
 * GET  /summary  — Aggregated RAN stats
 * POST /         — Save session
 * GET  /         — Fetch sessions by username
 *
 * Security: requireAuth on all. Children restricted to own username.
 */
import express from 'express';
import RANSession from '../models/RANSession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function resolveUsername(req, res) {
  if (req.user.role === 'child') return req.user.username;
  const u = req.query.username || req.body.username;
  if (!u) { res.status(400).json({ error: 'username required' }); return null; }
  return u;
}

// GET /api/ran/summary?username= — before GET /
router.get('/summary', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await RANSession.find({ username }).sort({ createdAt: 1 });
    if (!sessions.length)
      return res.json({ sessions: 0, avgAccuracy: 0, avgItemsPerMinute: 0, longitudinal: [] });

    const avgAccuracy = Math.round(
      sessions.reduce((s, x) => s + (x.accuracy || 0), 0) / sessions.length
    );
    const avgIPM = Math.round(
      sessions.reduce((s, x) => s + (x.itemsPerMinute || 0), 0) / sessions.length
    );
    const longitudinal = sessions.map(s => ({
      date:           s.createdAt,
      category:       s.category,
      accuracy:       s.accuracy,
      itemsPerMinute: s.itemsPerMinute,
    }));

    res.json({ sessions: sessions.length, avgAccuracy, avgItemsPerMinute: avgIPM, longitudinal });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ran — save session
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, username: req.user.username };
    const session = new RANSession(data);
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// GET /api/ran?username=
router.get('/', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await RANSession.find({ username }).sort({ createdAt: -1 }).limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
