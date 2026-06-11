/**
 * /api/reading-progress
 *
 * GET   /:childUsername              — Get or create reading progress
 * POST  /:childUsername/check        — Auto-advance level check
 * PATCH /:childUsername/override     — Therapist manually sets level
 * PATCH /:childUsername/release-override — Re-enable auto advancement
 *
 * Security:
 *  • All endpoints require auth
 *  • Children may only access their own username
 *  • override/release-override restricted to therapist/superadmin
 */
import express from 'express';
import ReadingProgress, { READING_LEVELS } from '../models/ReadingProgress.js';
import PhonemeTapSession from '../models/PhonemeTapSession.js';
import LetterSoundSession from '../models/LetterSoundSession.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

async function getOrCreate(childUsername) {
  let rp = await ReadingProgress.findOne({ childUsername });
  if (!rp) rp = await ReadingProgress.create({ childUsername });
  return rp;
}

function checkAccess(req, res, username) {
  if (req.user.role === 'child' && req.user.username !== username) {
    res.status(403).json({ message: 'Access denied' });
    return false;
  }
  return true;
}

// GET /api/reading-progress/:childUsername
router.get('/:childUsername', requireAuth, async (req, res) => {
  const username = req.params.childUsername;
  if (!checkAccess(req, res, username)) return;
  try {
    const rp = await getOrCreate(username);
    res.json(rp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reading-progress/:childUsername/check
router.post('/:childUsername/check', requireAuth, async (req, res) => {
  const username = req.params.childUsername;
  if (!checkAccess(req, res, username)) return;
  try {
    const rp = await getOrCreate(username);

    if (rp.therapistOverride) {
      return res.json({ advanced: false, reason: 'therapist_override', currentLevel: rp.currentLevel });
    }

    const currentIdx = READING_LEVELS.indexOf(rp.currentLevel);
    if (currentIdx === READING_LEVELS.length - 1) {
      return res.json({ advanced: false, reason: 'max_level', currentLevel: rp.currentLevel });
    }

    const [phonemeSessions, letterSoundSessions] = await Promise.all([
      PhonemeTapSession.find({ username, phonicsLevel: rp.currentLevel })
        .sort({ createdAt: -1 }).limit(3).select('overallAccuracy'),
      LetterSoundSession.find({ username, phonicsLevel: rp.currentLevel })
        .sort({ createdAt: -1 }).limit(3).select('overallAccuracy'),
    ]);

    const combined = [...phonemeSessions, ...letterSoundSessions];
    if (combined.length < 3) {
      rp.lastChecked = new Date();
      await rp.save();
      return res.json({ advanced: false, reason: 'insufficient_data', sessionsFound: combined.length, currentLevel: rp.currentLevel });
    }

    const avgAccuracy = combined.reduce((s, x) => s + x.overallAccuracy, 0) / combined.length;

    if (avgAccuracy >= 85) {
      const newLevel = READING_LEVELS[currentIdx + 1];
      rp.levelHistory.push({ fromLevel: rp.currentLevel, toLevel: newLevel, advancedBy: 'auto' });
      rp.currentLevel = newLevel;
      rp.lastChecked  = new Date();
      await rp.save();
      return res.json({ advanced: true, newLevel, avgAccuracy: Math.round(avgAccuracy), currentLevel: newLevel });
    }

    rp.lastChecked = new Date();
    await rp.save();
    res.json({ advanced: false, reason: 'below_threshold', avgAccuracy: Math.round(avgAccuracy), currentLevel: rp.currentLevel });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/reading-progress/:childUsername/override
router.patch('/:childUsername/override',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    const { level, note } = req.body;
    if (!level || !READING_LEVELS.includes(level)) {
      return res.status(400).json({ message: `level must be one of: ${READING_LEVELS.join(', ')}` });
    }
    try {
      const rp = await getOrCreate(req.params.childUsername);
      rp.levelHistory.push({
        fromLevel:  rp.currentLevel,
        toLevel:    level,
        advancedBy: 'therapist',
        note:       note || '',
      });
      rp.currentLevel     = level;
      rp.therapistOverride = true;
      rp.overriddenBy     = req.user.therapistId || req.user.userId;
      await rp.save();
      res.json(rp);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/reading-progress/:childUsername/release-override
router.patch('/:childUsername/release-override',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    try {
      const rp = await getOrCreate(req.params.childUsername);
      rp.therapistOverride = false;
      rp.overriddenBy      = null;
      await rp.save();
      res.json(rp);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
