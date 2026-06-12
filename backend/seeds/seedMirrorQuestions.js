/**
 * Seed script — MirrorQuestion collection (Mirror Words Game)
 *
 * Questions target dyslexia-specific letter reversals (b/d/p/q, m/w, n/u)
 * and common mirror-word confusions.
 *
 * Run: node --env-file=.env seeds/seedMirrorQuestions.js
 */
import mongoose from 'mongoose';
import MirrorQuestion from '../models/MirrorQuestion.js';

await mongoose.connect(process.env.MONGO_URI);
await MirrorQuestion.deleteMany({});

const questions = [
  // ── Easy — single letter identification ──────────────────────────────────
  {
    level: 'Easy',
    question: 'Which one is the letter "b"?',
    options:  ['b', 'd', 'p', 'q'],
    correct:  'b',
  },
  {
    level: 'Easy',
    question: 'Which one is the letter "d"?',
    options:  ['b', 'd', 'p', 'q'],
    correct:  'd',
  },
  {
    level: 'Easy',
    question: 'Which one is the letter "p"?',
    options:  ['b', 'd', 'p', 'q'],
    correct:  'p',
  },
  {
    level: 'Easy',
    question: 'Which one is the letter "m"?',
    options:  ['m', 'w', 'n', 'u'],
    correct:  'm',
  },
  {
    level: 'Easy',
    question: 'Which one is the letter "n"?',
    options:  ['n', 'u', 'm', 'h'],
    correct:  'n',
  },
  {
    level: 'Easy',
    question: 'Which word says "dog"?',
    options:  ['dog', 'bog', 'dob', 'god'],
    correct:  'dog',
  },
  {
    level: 'Easy',
    question: 'Which word says "bad"?',
    options:  ['bad', 'dad', 'bab', 'dab'],
    correct:  'bad',
  },
  {
    level: 'Easy',
    question: 'Which word says "bed"?',
    options:  ['bed', 'ded', 'beb', 'deb'],
    correct:  'bed',
  },
  {
    level: 'Easy',
    question: 'Which word says "big"?',
    options:  ['big', 'dig', 'pig', 'dib'],
    correct:  'big',
  },
  {
    level: 'Easy',
    question: 'Which word says "pot"?',
    options:  ['pot', 'top', 'dot', 'god'],
    correct:  'pot',
  },

  // ── Medium — word reversals & confusable pairs ────────────────────────────
  {
    level: 'Medium',
    question: 'Which word says "was"?',
    options:  ['was', 'saw', 'wsa', 'swa'],
    correct:  'was',
  },
  {
    level: 'Medium',
    question: 'What is the MIRROR of the word "saw"?',
    options:  ['was', 'saw', 'wsa', 'saw'],
    correct:  'was',
  },
  {
    level: 'Medium',
    question: 'Which word says "no"?',
    options:  ['no', 'on', 'nu', 'ou'],
    correct:  'no',
  },
  {
    level: 'Medium',
    question: 'Which word says "net"?',
    options:  ['net', 'ten', 'nen', 'tet'],
    correct:  'net',
  },
  {
    level: 'Medium',
    question: 'Which word says "tip"?',
    options:  ['tip', 'pit', 'dip', 'tib'],
    correct:  'tip',
  },
  {
    level: 'Medium',
    question: 'Which word says "nap"?',
    options:  ['nap', 'pan', 'nab', 'pab'],
    correct:  'nap',
  },
  {
    level: 'Medium',
    question: 'Which word says "bat"?',
    options:  ['bat', 'tab', 'dat', 'bad'],
    correct:  'bat',
  },
  {
    level: 'Medium',
    question: 'Which word says "tap"?',
    options:  ['tap', 'pat', 'dap', 'tab'],
    correct:  'tap',
  },
  {
    level: 'Medium',
    question: 'What is the MIRROR of "bud"?',
    options:  ['dub', 'bud', 'dud', 'bub'],
    correct:  'dub',
  },
  {
    level: 'Medium',
    question: 'Which word says "den"?',
    options:  ['den', 'ned', 'ben', 'deb'],
    correct:  'den',
  },

  // ── Hard — longer words, full reversal, mixed confusables ─────────────────
  {
    level: 'Hard',
    question: 'Which word says "debut"?',
    options:  ['debut', 'deput', 'depud', 'debud'],
    correct:  'debut',
  },
  {
    level: 'Hard',
    question: 'What is the MIRROR of the word "stop"?',
    options:  ['pots', 'tops', 'spot', 'opts'],
    correct:  'pots',
  },
  {
    level: 'Hard',
    question: 'Which word says "dessert"?',
    options:  ['dessert', 'desert', 'desssert', 'dessret'],
    correct:  'dessert',
  },
  {
    level: 'Hard',
    question: 'What is the MIRROR of the word "live"?',
    options:  ['evil', 'vile', 'live', 'veil'],
    correct:  'evil',
  },
  {
    level: 'Hard',
    question: 'Which word says "debut"?',
    options:  ['debut', 'depud', 'deput', 'dubut'],
    correct:  'debut',
  },
  {
    level: 'Hard',
    question: 'What is the MIRROR of the word "trap"?',
    options:  ['part', 'tarp', 'rapt', 'prat'],
    correct:  'part',
  },
  {
    level: 'Hard',
    question: 'Which word says "bread"?',
    options:  ['bread', 'breab', 'dreak', 'braid'],
    correct:  'bread',
  },
  {
    level: 'Hard',
    question: 'What is the MIRROR of "draw"?',
    options:  ['ward', 'wrad', 'dwar', 'rawd'],
    correct:  'ward',
  },
  {
    level: 'Hard',
    question: 'Which word says "spider"?',
    options:  ['spider', 'sbider', 'spiden', 'spiber'],
    correct:  'spider',
  },
  {
    level: 'Hard',
    question: 'What is the MIRROR of the word "stressed"?',
    options:  ['desserts', 'stresed', 'dessrest', 'dessered'],
    correct:  'desserts',
  },
];

await MirrorQuestion.insertMany(questions);
console.log(`✅  Inserted ${questions.length} mirror word questions`);
await mongoose.disconnect();
