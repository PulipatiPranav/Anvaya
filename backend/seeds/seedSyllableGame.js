/**
 * Seed script — SyllableGame collection
 * Run: node --env-file=.env seeds/seedSyllableGame.js
 */
import mongoose from 'mongoose';
import SyllableGame from '../models/SyllableGame.js';

await mongoose.connect(process.env.MONGO_URI);
await SyllableGame.deleteMany({});

const words = [
  // ── easy (1–2 syllables, CVC / simple) ───────────────────────────────────
  { word: 'cat',    syllables: 1, split: ['cat'],       difficulty: 'easy' },
  { word: 'dog',    syllables: 1, split: ['dog'],       difficulty: 'easy' },
  { word: 'sun',    syllables: 1, split: ['sun'],       difficulty: 'easy' },
  { word: 'hat',    syllables: 1, split: ['hat'],       difficulty: 'easy' },
  { word: 'pen',    syllables: 1, split: ['pen'],       difficulty: 'easy' },
  { word: 'bat',    syllables: 1, split: ['bat'],       difficulty: 'easy' },
  { word: 'cup',    syllables: 1, split: ['cup'],       difficulty: 'easy' },
  { word: 'bed',    syllables: 1, split: ['bed'],       difficulty: 'easy' },
  { word: 'fox',    syllables: 1, split: ['fox'],       difficulty: 'easy' },
  { word: 'pig',    syllables: 1, split: ['pig'],       difficulty: 'easy' },
  { word: 'apple',  syllables: 2, split: ['ap',  'ple'], difficulty: 'easy' },
  { word: 'happy',  syllables: 2, split: ['hap', 'py'],  difficulty: 'easy' },
  { word: 'baby',   syllables: 2, split: ['ba',  'by'],  difficulty: 'easy' },
  { word: 'sunny',  syllables: 2, split: ['sun', 'ny'],  difficulty: 'easy' },
  { word: 'funny',  syllables: 2, split: ['fun', 'ny'],  difficulty: 'easy' },

  // ── medium (2–3 syllables) ────────────────────────────────────────────────
  { word: 'tiger',    syllables: 2, split: ['ti',   'ger'],         difficulty: 'medium' },
  { word: 'rabbit',   syllables: 2, split: ['rab',  'bit'],         difficulty: 'medium' },
  { word: 'button',   syllables: 2, split: ['but',  'ton'],         difficulty: 'medium' },
  { word: 'pencil',   syllables: 2, split: ['pen',  'cil'],         difficulty: 'medium' },
  { word: 'garden',   syllables: 2, split: ['gar',  'den'],         difficulty: 'medium' },
  { word: 'monkey',   syllables: 2, split: ['mon',  'key'],         difficulty: 'medium' },
  { word: 'flower',   syllables: 2, split: ['flow', 'er'],          difficulty: 'medium' },
  { word: 'basket',   syllables: 2, split: ['bas',  'ket'],         difficulty: 'medium' },
  { word: 'banana',   syllables: 3, split: ['ba',   'na',  'na'],   difficulty: 'medium' },
  { word: 'computer', syllables: 3, split: ['com',  'pu',  'ter'],  difficulty: 'medium' },
  { word: 'umbrella', syllables: 3, split: ['um',   'brel','la'],   difficulty: 'medium' },
  { word: 'remember', syllables: 3, split: ['re',   'mem', 'ber'],  difficulty: 'medium' },
  { word: 'together', syllables: 3, split: ['to',   'geth','er'],   difficulty: 'medium' },
  { word: 'tomorrow', syllables: 3, split: ['to',   'mor', 'row'],  difficulty: 'medium' },
  { word: 'beautiful',syllables: 3, split: ['beau', 'ti',  'ful'],  difficulty: 'medium' },

  // ── hard (4–6 syllables) ──────────────────────────────────────────────────
  { word: 'helicopter',   syllables: 4, split: ['hel',  'i',   'cop', 'ter'],        difficulty: 'hard' },
  { word: 'mathematics',  syllables: 4, split: ['math', 'e',   'mat', 'ics'],        difficulty: 'hard' },
  { word: 'celebration',  syllables: 4, split: ['cel',  'e',   'bra', 'tion'],       difficulty: 'hard' },
  { word: 'information',  syllables: 4, split: ['in',   'for', 'ma',  'tion'],       difficulty: 'hard' },
  { word: 'architecture', syllables: 4, split: ['ar',   'chi', 'tec', 'ture'],       difficulty: 'hard' },
  { word: 'understanding',syllables: 4, split: ['un',   'der', 'stand','ing'],       difficulty: 'hard' },
  { word: 'communication',syllables: 5, split: ['com',  'mu',  'ni',  'ca', 'tion'], difficulty: 'hard' },
  { word: 'imagination',  syllables: 5, split: ['i',    'mag', 'i',   'na', 'tion'], difficulty: 'hard' },
  { word: 'refrigerator', syllables: 5, split: ['re',   'fri', 'ge',  'ra', 'tor'],  difficulty: 'hard' },
  { word: 'encyclopedia', syllables: 6, split: ['en',   'cy',  'clo', 'pe', 'di','a'],difficulty: 'hard' },
];

await SyllableGame.insertMany(words);
console.log(`✅  Inserted ${words.length} syllable game words`);
await mongoose.disconnect();
