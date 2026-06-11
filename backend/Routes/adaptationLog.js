/**
 * /api/adaptation-log
 *
 * POST / — Record an adaptation event
 * GET  / — Fetch adaptation log for a user
 *
 * Security: requireAuth on all. Children restricted to own username.
 */
import express from 'express';
import AdaptationLog from '../models/AdaptationLog.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/adaptation-log
router.post('/', requireAuth, async (req, res) => {
  const { gameKey, emotionDetected, previousDifficulty, newDifficulty, backgroundChange, triggerType, sessionId } = req.body;
  // Username always from JWT — never trust body
  const username = req.user.username;
  if (!gameKey) return res.status(400).json({ message: 'gameKey required' });
  try {
    const log = new AdaptationLog({ username, gameKey, emotionDetected, previousDifficulty, newDifficulty, backgroundChange, triggerType, sessionId });
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/adaptation-log?username=&gameKey=&limit=
router.get('/', requireAuth, async (req, res) => {
  let { gameKey, limit = 50 } = req.query;
  const username = req.user.role === 'child'
    ? req.user.username
    : req.query.username;

  if (!username) return res.status(400).json({ message: 'username required' });
  try {
    const query = { username };
    if (gameKey) query.gameKey = gameKey;
    const logs = await AdaptationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 200));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
