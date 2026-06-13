/**
 * /api/progress/:username — child growth & progress summary.
 *
 * The "show me it's working" endpoint. Derives per-skill trends, streaks,
 * weekly highlights and a recommended focus ENTIRELY from existing session
 * data — it writes nothing and adds no new collections, so it cannot affect
 * gameplay or existing analytics.
 *
 * Security: requireAuth + requireOwnData
 *   • a child sees only their own progress
 *   • therapists / superadmin may view any child's
 */
import express from 'express';
import mongoose from 'mongoose';
import PhonemeTapSession   from '../models/PhonemeTapSession.js';
import LetterSoundSession  from '../models/LetterSoundSession.js';
import ConfusableSession   from '../models/ConfusableSession.js';
import MorphologySession   from '../models/MorphologySession.js';
import FluencySession      from '../models/FluencySession.js';
import RANSession          from '../models/RANSession.js';
import VerbalMemorySession from '../models/VerbalMemorySession.js';
import SightWordProgress   from '../models/SightWordProgress.js';
import { requireAuth, requireOwnData } from '../middleware/auth.js';

const router = express.Router();

const DAY_MS = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// Build a trend summary from a date-sorted [{date, value}] series.
function trend(series, unit) {
  const clean = series
    .filter(s => s.value != null && !Number.isNaN(s.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (clean.length === 0) {
    return { unit, count: 0, series: [], first: null, latest: null, deltaPct: null };
  }
  const n = clean.length;
  const firstVals  = clean.slice(0, Math.min(3, n)).map(s => s.value);
  const recentVals = clean.slice(-Math.min(3, n)).map(s => s.value);
  const baseline = avg(firstVals);
  const recent   = avg(recentVals);
  const deltaPct = baseline > 0 ? Math.round(((recent - baseline) / baseline) * 100) : null;
  return {
    unit,
    count: n,
    series: clean.map(s => ({ date: s.date, value: Math.round(s.value * 10) / 10 })),
    first: Math.round(baseline * 10) / 10,
    latest: Math.round(recent * 10) / 10,
    deltaPct,
  };
}

function computeStreaks(dayKeys) {
  const days = [...new Set(dayKeys)].sort();
  if (days.length === 0) return { current: 0, longest: 0, daysActive: 0 };

  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]) - new Date(days[i - 1])) / DAY_MS);
    if (diff === 1) { run++; longest = Math.max(longest, run); }
    else if (diff > 1) { run = 1; }
  }

  const set = new Set(days);
  const todayKey = dayKey(Date.now());
  const yesterdayKey = dayKey(Date.now() - DAY_MS);
  let current = 0;
  if (set.has(todayKey) || set.has(yesterdayKey)) {
    let cursor = new Date(set.has(todayKey) ? todayKey : yesterdayKey);
    while (set.has(dayKey(cursor))) {
      current++;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
  }
  return { current, longest, daysActive: days.length };
}

function durationMin(s) {
  if (s.startTime && s.endTime) {
    return Math.max(0, (new Date(s.endTime) - new Date(s.startTime)) / 60000);
  }
  return 0;
}

router.get('/:username', requireAuth, requireOwnData, async (req, res) => {
  const username = req.params.username;
  try {
    const GameSession = mongoose.models.GameSession;
    const [phoneme, letter, confusable, morph, fluency, ran, vm, sightWords, games] =
      await Promise.all([
        PhonemeTapSession.find({ username }).select('overallAccuracy startTime endTime createdAt'),
        LetterSoundSession.find({ username }).select('overallAccuracy startTime endTime createdAt'),
        ConfusableSession.find({ username }).select('overallAccuracy startTime endTime createdAt'),
        MorphologySession.find({ username }).select('accuracy createdAt'),
        FluencySession.find({ username }).select('wpm accuracy timeSeconds createdAt'),
        RANSession.find({ username }).select('itemsPerMinute accuracy startTime endTime createdAt'),
        VerbalMemorySession.find({ username }).select('workingMemoryScore startTime endTime createdAt'),
        SightWordProgress.find({ username }).select('repetitions interval lastReview totalCorrect totalAttempts'),
        GameSession ? GameSession.find({ username }).select('score startTime endTime createdAt') : [],
      ]);

    // ── Per-skill trends ──────────────────────────────────────────────────
    const phonicsSeries = [
      ...phoneme.map(s => ({ date: s.createdAt, value: s.overallAccuracy })),
      ...letter.map(s => ({ date: s.createdAt, value: s.overallAccuracy })),
      ...confusable.map(s => ({ date: s.createdAt, value: s.overallAccuracy })),
      ...morph.map(s => ({ date: s.createdAt, value: s.accuracy })),
    ];
    const skills = {
      phonics:       trend(phonicsSeries, '%'),
      fluency:       trend(fluency.map(s => ({ date: s.createdAt, value: s.wpm })), 'WPM'),
      rapidNaming:   trend(ran.map(s => ({ date: s.createdAt, value: s.itemsPerMinute })), 'items/min'),
      workingMemory: trend(vm.map(s => ({ date: s.createdAt, value: s.workingMemoryScore })), 'score'),
    };

    // ── Streaks, activity, minutes ────────────────────────────────────────
    const everySession = [
      ...phoneme, ...letter, ...confusable, ...morph, ...fluency, ...ran, ...vm, ...(games || []),
    ];
    const allDayKeys = everySession.map(s => dayKey(s.createdAt));
    const streaks = computeStreaks(allDayKeys);
    const todayKey = dayKey(Date.now());
    const sessionsToday = allDayKeys.filter(k => k === todayKey).length;

    let totalMinutes = 0;
    [...phoneme, ...letter, ...confusable, ...ran, ...vm, ...(games || [])].forEach(s => {
      totalMinutes += durationMin(s);
    });
    fluency.forEach(s => { totalMinutes += (s.timeSeconds || 0) / 60; });

    const masteredWords     = sightWords.filter(w => (w.repetitions || 0) >= 3 || (w.interval || 0) >= 6);
    const practicingWords   = sightWords.filter(w => !((w.repetitions || 0) >= 3 || (w.interval || 0) >= 6));

    // ── This week vs last week ────────────────────────────────────────────
    const weekAgo = Date.now() - 7 * DAY_MS;
    const inLastWeek = (d) => new Date(d).getTime() >= weekAgo;
    const sessionsThisWeek = everySession.filter(s => inLastWeek(s.createdAt)).length;
    const newSightWordsThisWeek = masteredWords.filter(w => w.lastReview && inLastWeek(w.lastReview)).length;

    // Human-friendly highlights for the weekly summary card.
    const highlights = [];
    if (newSightWordsThisWeek > 0)
      highlights.push(`Mastered ${newSightWordsThisWeek} new sight word${newSightWordsThisWeek > 1 ? 's' : ''} 📚`);
    if (skills.fluency.deltaPct != null && skills.fluency.deltaPct > 0)
      highlights.push(`Reading speed up ${skills.fluency.deltaPct}% 🚀`);
    if (skills.phonics.deltaPct != null && skills.phonics.deltaPct > 0)
      highlights.push(`Phonics accuracy up ${skills.phonics.deltaPct}% 🎯`);
    if (streaks.current >= 2)
      highlights.push(`${streaks.current}-day practice streak 🔥`);
    if (sessionsThisWeek > 0 && highlights.length === 0)
      highlights.push(`${sessionsThisWeek} practice session${sessionsThisWeek > 1 ? 's' : ''} this week 💪`);

    // ── Recommended focus (lightweight personalization) ───────────────────
    let recommendedFocus = null;
    if (skills.phonics.count > 0 && skills.phonics.latest != null && skills.phonics.latest < 70) {
      recommendedFocus = { skill: 'phonics', label: 'Letter sounds & phonics', route: '/lettersound',
        reason: 'A little more phonics practice will build your decoding confidence.' };
    } else if (skills.fluency.count > 0 && skills.fluency.latest != null && skills.fluency.latest < 60) {
      recommendedFocus = { skill: 'fluency', label: 'Reading fluency', route: '/reading-fluency',
        reason: 'Practising reading aloud will grow your reading speed.' };
    } else if (practicingWords.length > 0) {
      recommendedFocus = { skill: 'sightWords', label: 'Sight words', route: '/sight-words',
        reason: `You have ${practicingWords.length} sight words still warming up.` };
    } else {
      recommendedFocus = { skill: 'phonics', label: 'Keep exploring', route: '/games',
        reason: 'Great work — keep a balanced mix of games going!' };
    }

    res.json({
      summary: {
        totalSessions: everySession.length,
        totalMinutes: Math.round(totalMinutes),
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
        daysActive: streaks.daysActive,
        sessionsToday,
        dailyGoal: 3,
        sightWordsMastered: masteredWords.length,
        sightWordsPracticing: practicingWords.length,
      },
      skills,
      weekly: { sessionsThisWeek, newSightWords: newSightWordsThisWeek, highlights },
      recommendedFocus,
    });
  } catch (err) {
    console.error('[progress] Error:', err.message);
    res.status(500).json({ message: 'Failed to compute progress' });
  }
});

export default router;
