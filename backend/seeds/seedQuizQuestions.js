/**
 * Seed script — Question collection (Fun Quiz game)
 *
 * Run: node --env-file=.env seeds/seedQuizQuestions.js
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';

await mongoose.connect(process.env.MONGO_URI);
await Question.deleteMany({});

const questions = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  {
    question: 'What colour is the sky on a sunny day?',
    options:  [{ text: 'Blue' }, { text: 'Green' }, { text: 'Red' }, { text: 'Purple' }],
    answer:   'Blue',
    difficulty: 'Easy',
  },
  {
    question: 'How many legs does a dog have?',
    options:  [{ text: '2' }, { text: '4' }, { text: '6' }, { text: '8' }],
    answer:   '4',
    difficulty: 'Easy',
  },
  {
    question: 'What do bees make?',
    options:  [{ text: 'Milk' }, { text: 'Honey' }, { text: 'Butter' }, { text: 'Juice' }],
    answer:   'Honey',
    difficulty: 'Easy',
  },
  {
    question: 'Which animal says "moo"?',
    options:  [{ text: 'Pig' }, { text: 'Horse' }, { text: 'Cow' }, { text: 'Duck' }],
    answer:   'Cow',
    difficulty: 'Easy',
  },
  {
    question: 'What shape is a ball?',
    options:  [{ text: 'Square' }, { text: 'Triangle' }, { text: 'Round' }, { text: 'Flat' }],
    answer:   'Round',
    difficulty: 'Easy',
  },
  {
    question: 'How many days are in a week?',
    options:  [{ text: '5' }, { text: '6' }, { text: '7' }, { text: '8' }],
    answer:   '7',
    difficulty: 'Easy',
  },
  {
    question: 'What fruit is yellow and curved?',
    options:  [{ text: 'Apple' }, { text: 'Banana' }, { text: 'Grape' }, { text: 'Orange' }],
    answer:   'Banana',
    difficulty: 'Easy',
  },
  {
    question: 'Which of these is a vegetable?',
    options:  [{ text: 'Apple' }, { text: 'Mango' }, { text: 'Carrot' }, { text: 'Grape' }],
    answer:   'Carrot',
    difficulty: 'Easy',
  },

  // ── Medium ────────────────────────────────────────────────────────────────
  {
    question: 'Which planet is closest to the Sun?',
    options:  [{ text: 'Earth' }, { text: 'Venus' }, { text: 'Mercury' }, { text: 'Mars' }],
    answer:   'Mercury',
    difficulty: 'Medium',
  },
  {
    question: 'How many sides does a hexagon have?',
    options:  [{ text: '4' }, { text: '5' }, { text: '6' }, { text: '7' }],
    answer:   '6',
    difficulty: 'Medium',
  },
  {
    question: 'What gas do plants absorb to make food?',
    options:  [{ text: 'Oxygen' }, { text: 'Carbon dioxide' }, { text: 'Nitrogen' }, { text: 'Hydrogen' }],
    answer:   'Carbon dioxide',
    difficulty: 'Medium',
  },
  {
    question: 'What is the largest ocean on Earth?',
    options:  [{ text: 'Atlantic' }, { text: 'Indian' }, { text: 'Arctic' }, { text: 'Pacific' }],
    answer:   'Pacific',
    difficulty: 'Medium',
  },
  {
    question: 'What is 7 × 8?',
    options:  [{ text: '54' }, { text: '56' }, { text: '48' }, { text: '64' }],
    answer:   '56',
    difficulty: 'Medium',
  },
  {
    question: 'What is the capital city of France?',
    options:  [{ text: 'Rome' }, { text: 'Berlin' }, { text: 'Paris' }, { text: 'Madrid' }],
    answer:   'Paris',
    difficulty: 'Medium',
  },
  {
    question: 'Which animal is the fastest on land?',
    options:  [{ text: 'Lion' }, { text: 'Cheetah' }, { text: 'Leopard' }, { text: 'Horse' }],
    answer:   'Cheetah',
    difficulty: 'Medium',
  },
  {
    question: 'What is the chemical symbol for water?',
    options:  [{ text: 'O2' }, { text: 'CO2' }, { text: 'H2O' }, { text: 'NaCl' }],
    answer:   'H2O',
    difficulty: 'Medium',
  },

  // ── Hard ──────────────────────────────────────────────────────────────────
  {
    question: 'What is the square root of 144?',
    options:  [{ text: '10' }, { text: '11' }, { text: '12' }, { text: '13' }],
    answer:   '12',
    difficulty: 'Hard',
  },
  {
    question: 'Which element has atomic number 79?',
    options:  [{ text: 'Silver' }, { text: 'Gold' }, { text: 'Platinum' }, { text: 'Copper' }],
    answer:   'Gold',
    difficulty: 'Hard',
  },
  {
    question: 'Who wrote "Romeo and Juliet"?',
    options:  [{ text: 'Charles Dickens' }, { text: 'Jane Austen' }, { text: 'William Shakespeare' }, { text: 'Homer' }],
    answer:   'William Shakespeare',
    difficulty: 'Hard',
  },
  {
    question: 'Which country has the most natural lakes?',
    options:  [{ text: 'Russia' }, { text: 'Brazil' }, { text: 'USA' }, { text: 'Canada' }],
    answer:   'Canada',
    difficulty: 'Hard',
  },
  {
    question: 'What is the powerhouse of the cell?',
    options:  [{ text: 'Nucleus' }, { text: 'Ribosome' }, { text: 'Mitochondria' }, { text: 'Vacuole' }],
    answer:   'Mitochondria',
    difficulty: 'Hard',
  },
  {
    question: 'In what year did World War II end?',
    options:  [{ text: '1943' }, { text: '1944' }, { text: '1945' }, { text: '1946' }],
    answer:   '1945',
    difficulty: 'Hard',
  },
  {
    question: 'What is the longest bone in the human body?',
    options:  [{ text: 'Tibia' }, { text: 'Femur' }, { text: 'Humerus' }, { text: 'Fibula' }],
    answer:   'Femur',
    difficulty: 'Hard',
  },
  {
    question: 'How many bones does an adult human body have?',
    options:  [{ text: '186' }, { text: '196' }, { text: '206' }, { text: '216' }],
    answer:   '206',
    difficulty: 'Hard',
  },
];

await Question.insertMany(questions);
console.log(`✅  Inserted ${questions.length} quiz questions`);
await mongoose.disconnect();
