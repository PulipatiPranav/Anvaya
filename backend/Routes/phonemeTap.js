/**
 * /api/phoneme-tap
 *
 * POST /         — Save a completed session
 * GET  /         — Fetch sessions by username
 * GET  /summary  — Aggregated stats by phonics level
 *
 * Security: requireAuth on all. Children restricted to own username.
 */
import express from 'express';
import PhonemeTapSession from '../models/PhonemeTapSession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function resolveUsername(req, res) {
  if (req.user.role === 'child') return req.user.username;
  const u = req.query.username || req.body.username;
  if (!u) { res.status(400).json({ error: 'username is required' }); return null; }
  return u;
}

// GET /api/phoneme-tap/summary?username=
router.get('/summary', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await PhonemeTapSession.find({ username });
    if (sessions.length === 0) return res.json({ sessions: 0, avgAccuracy: 0, byLevel: {} });

    const byLevel = {};
    sessions.forEach(s => {
      const lv = s.phonicsLevel || 'unknown';
      if (!byLevel[lv]) byLevel[lv] = { totalAccuracy: 0, count: 0 };
      byLevel[lv].totalAccuracy += s.overallAccuracy;
      byLevel[lv].count += 1;
    });
    Object.keys(byLevel).forEach(lv => {
      byLevel[lv].avgAccuracy = +(byLevel[lv].totalAccuracy / byLevel[lv].count).toFixed(1);
    });

    const avgAccuracy = +(sessions.reduce((s, x) => s + x.overallAccuracy, 0) / sessions.length).toFixed(1);
    res.json({ sessions: sessions.length, avgAccuracy, byLevel });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// POST /api/phoneme-tap — save session
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, username: req.user.username };
    const session = new PhonemeTapSession(data);
    await session.save();
    res.status(201).json({ message: 'Phoneme tap session saved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/phoneme-tap?username=
router.get('/', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await PhonemeTapSession.find({ username }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch phoneme tap sessions' });
  }
});

export default router;
