/**
 * /api/reports
 *
 * GET /:childUsername — Aggregate all data for a printable PDF report
 *
 * Security: requireAuth + requireRole('therapist', 'superadmin')
 */
import express from 'express';
import mongoose from 'mongoose';
import PhonemeTapSession   from '../models/PhonemeTapSession.js';
import LetterSoundSession  from '../models/LetterSoundSession.js';
import RANSession          from '../models/RANSession.js';
import VerbalMemorySession from '../models/VerbalMemorySession.js';
import ConfusableSession   from '../models/ConfusableSession.js';
import ReadingProgress     from '../models/ReadingProgress.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reports/:childUsername
router.get('/:childUsername',
  requireAuth,
  requireRole('therapist', 'superadmin'),
  async (req, res) => {
    const username = req.params.childUsername;
    try {
      const GameSession = mongoose.models.GameSession;

      const [phonemeSessions, letterSoundSessions, ranSessions, vmSessions, confusableSessions, gameSessions, readingProgress] = await Promise.all([
        PhonemeTapSession.find({ username }).sort({ createdAt: -1 }).limit(20),
        LetterSoundSession.find({ username }).sort({ createdAt: -1 }).limit(20),
        RANSession.find({ username }).sort({ createdAt: -1 }).limit(20),
        VerbalMemorySession.find({ username }).sort({ createdAt: -1 }).limit(20),
        ConfusableSession.find({ username }).sort({ createdAt: -1 }).limit(20),
        GameSession ? GameSession.find({ username }).sort({ createdAt: -1 }).limit(20) : [],
        ReadingProgress.findOne({ username }),
      ]);

      const avgAccuracy = (arr) => arr.length
        ? Math.round(arr.reduce((s, x) => s + (x.overallAccuracy || 0), 0) / arr.length)
        : null;

      const latestRAN = ranSessions[0];
      const latestWM  = vmSessions[0];

      const moodCounts = {};
      (gameSessions || []).forEach(s => {
        if (s.moodAtStart) moodCounts[s.moodAtStart] = (moodCounts[s.moodAtStart] || 0) + 1;
      });

      const phonemeTrend = [
        ...phonemeSessions.map(s => ({ date: s.createdAt, accuracy: s.overallAccuracy, level: s.phonicsLevel })),
        ...letterSoundSessions.map(s => ({ date: s.createdAt, accuracy: s.overallAccuracy, level: s.phonicsLevel })),
      ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);

      const ranTrend = ranSessions.slice().reverse().map(s => ({
        date: s.createdAt,
        itemsPerMinute: s.itemsPerMinute,
        category: s.category,
      }));

      const latestConfusable = confusableSessions[0];
      const pairAccuracy = latestConfusable?.pairAccuracy
        ? (latestConfusable.pairAccuracy instanceof Map
            ? Object.fromEntries(latestConfusable.pairAccuracy)
            : latestConfusable.pairAccuracy)
        : null;

      res.json({
        username,
        generatedAt: new Date(),
        readingProgress: readingProgress || { currentLevel: 'pre-reader', levelHistory: [] },
        summary: {
          phonemeAvgAccuracy:       avgAccuracy(phonemeSessions),
          letterSoundAvgAccuracy:   avgAccuracy(letterSoundSessions),
          latestRANItemsPerMin:     latestRAN?.itemsPerMinute ?? null,
          latestWMScore:            latestWM?.workingMemoryScore ?? null,
          totalSessions:            (gameSessions || []).length,
          moodCounts,
        },
        phonemeTrend,
        ranTrend,
        pairAccuracy,
        sessions: {
          phonemeTap:   phonemeSessions,
          letterSound:  letterSoundSessions,
          ran:          ranSessions,
          verbalMemory: vmSessions,
          confusable:   confusableSessions,
        },
      });
    } catch (err) {
      console.error('[reports] Error:', err.message);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  }
);

export default router;
