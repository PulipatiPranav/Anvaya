/**
 * Seed script — WordQuestion collection (Word Puzzle Adventure)
 *
 * The `image` field holds an emoji character.  The frontend renders it as
 * a large emoji span when the value does not start with "http".
 *
 * Run: node --env-file=.env seeds/seedWordQuestions.js
 */
import mongoose from 'mongoose';
import WordQuestion from '../models/WordQuestion.js';

await mongoose.connect(process.env.MONGO_URI);
await WordQuestion.deleteMany({});

const questions = [
  // ── easy (3–4 letter words, concrete nouns) ───────────────────────────────
  { difficulty: 'easy', word: 'cat',  image: '🐱', hint: 'A small furry pet that says meow'  },
  { difficulty: 'easy', word: 'dog',  image: '🐶', hint: 'A loyal pet that wags its tail'    },
  { difficulty: 'easy', word: 'sun',  image: '☀️', hint: 'It shines in the sky during the day' },
  { difficulty: 'easy', word: 'hat',  image: '🎩', hint: 'You wear this on your head'         },
  { difficulty: 'easy', word: 'cup',  image: '🥤', hint: 'You drink juice from this'          },
  { difficulty: 'easy', word: 'bus',  image: '🚌', hint: 'A big vehicle that takes you to school' },
  { difficulty: 'easy', word: 'pen',  image: '🖊️', hint: 'You write with this'                },
  { difficulty: 'easy', word: 'bed',  image: '🛏️', hint: 'You sleep on this at night'         },
  { difficulty: 'easy', word: 'ant',  image: '🐜', hint: 'A tiny insect that lives in a colony' },
  { difficulty: 'easy', word: 'egg',  image: '🥚', hint: 'A bird lays this'                   },
  { difficulty: 'easy', word: 'fox',  image: '🦊', hint: 'A clever orange wild animal'        },
  { difficulty: 'easy', word: 'frog', image: '🐸', hint: 'A green animal that jumps and croaks' },

  // ── medium (4–6 letter words) ─────────────────────────────────────────────
  { difficulty: 'medium', word: 'tiger',  image: '🐯', hint: 'A big wild cat with orange and black stripes' },
  { difficulty: 'medium', word: 'apple',  image: '🍎', hint: 'A crunchy red or green fruit'                 },
  { difficulty: 'medium', word: 'piano',  image: '🎹', hint: 'A musical instrument with black and white keys' },
  { difficulty: 'medium', word: 'house',  image: '🏠', hint: 'A place where families live'                   },
  { difficulty: 'medium', word: 'train',  image: '🚂', hint: 'It travels on tracks and carries passengers'   },
  { difficulty: 'medium', word: 'globe',  image: '🌍', hint: 'A round map of the Earth'                      },
  { difficulty: 'medium', word: 'clock',  image: '🕐', hint: 'It tells you the time'                         },
  { difficulty: 'medium', word: 'chair',  image: '🪑', hint: 'You sit on this'                               },
  { difficulty: 'medium', word: 'beach',  image: '🏖️', hint: 'Sandy place next to the ocean'                 },
  { difficulty: 'medium', word: 'robot',  image: '🤖', hint: 'A machine that can be programmed'              },
  { difficulty: 'medium', word: 'candy',  image: '🍬', hint: 'A sweet treat kids love'                       },
  { difficulty: 'medium', word: 'crown',  image: '👑', hint: 'A king or queen wears this on their head'      },

  // ── hard (6–8 letter words) ───────────────────────────────────────────────
  { difficulty: 'hard', word: 'dolphin', image: '🐬', hint: 'A smart ocean mammal that jumps'             },
  { difficulty: 'hard', word: 'penguin', image: '🐧', hint: 'A black and white bird that cannot fly'      },
  { difficulty: 'hard', word: 'volcano', image: '🌋', hint: 'A mountain that can erupt with lava'         },
  { difficulty: 'hard', word: 'compass', image: '🧭', hint: 'It always points north'                      },
  { difficulty: 'hard', word: 'blanket', image: '🛌', hint: 'You wrap yourself in this to stay warm'      },
  { difficulty: 'hard', word: 'lantern', image: '🏮', hint: 'A portable light used before electricity'     },
  { difficulty: 'hard', word: 'feather', image: '🪶', hint: 'A light fluffy thing from a bird'            },
  { difficulty: 'hard', word: 'balloon', image: '🎈', hint: 'You blow air into this at a party'           },
  { difficulty: 'hard', word: 'bicycle', image: '🚲', hint: 'A two-wheeled vehicle you pedal'             },
  { difficulty: 'hard', word: 'rainbow', image: '🌈', hint: 'Colourful arch in the sky after rain'        },
  { difficulty: 'hard', word: 'chicken', image: '🐔', hint: 'A farm bird that lays eggs'                  },
  { difficulty: 'hard', word: 'tornado', image: '🌪️', hint: 'A spinning column of wind'                   },
];

await WordQuestion.insertMany(questions);
console.log(`✅  Inserted ${questions.length} word puzzle questions`);
await mongoose.disconnect();
