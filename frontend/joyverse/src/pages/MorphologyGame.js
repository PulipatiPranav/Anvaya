import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameShell from '../components/GameShell';
import FeedbackGif from '../components/FeedbackGif';
import useEmotionDetection from '../hooks/useEmotionDetection';
import { getCardStyle } from '../utils/EmotionThemeMap';
import SpeechService from '../services/SpeechService';
import { API_BASE } from '../config/api';
import axios from 'axios';
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import './MorphologyGame.css';

const PREFIXES = [
  { affix: 'un', meaning: 'not / opposite of', color: '#8b5cf6', examples: ['unhappy','undo','unfair','unsafe','unkind'] },
  { affix: 're', meaning: 'again', color: '#3b82f6', examples: ['redo','replay','rewrite','reread','rebuild'] },
  { affix: 'pre', meaning: 'before', color: '#0891b2', examples: ['preview','prepay','preschool','preheat'] },
  { affix: 'dis', meaning: 'not / opposite of', color: '#dc2626', examples: ['dislike','disagree','dishonest','discover'] },
  { affix: 'mis', meaning: 'wrongly', color: '#ea580c', examples: ['mistake','misread','mishear','misplace'] },
  { affix: 'over', meaning: 'too much', color: '#7c3aed', examples: ['overflow','overdo','overcooked','overlap'] },
];

const SUFFIXES = [
  { affix: 'ing', meaning: 'action happening now', color: '#059669', examples: ['running','jumping','reading','playing'] },
  { affix: 'ed', meaning: 'happened in the past', color: '#0d9488', examples: ['jumped','walked','played','helped'] },
  { affix: 'er', meaning: 'a person who does something', color: '#16a34a', examples: ['reader','writer','runner','teacher'] },
  { affix: 'ful', meaning: 'full of', color: '#65a30d', examples: ['helpful','hopeful','colorful','playful'] },
  { affix: 'less', meaning: 'without', color: '#ca8a04', examples: ['hopeless','careless','helpless','fearless'] },
  { affix: 'ly', meaning: 'in a certain way', color: '#b45309', examples: ['quickly','slowly','kindly','happily'] },
  { affix: 'ness', meaning: 'the state of being', color: '#92400e', examples: ['happiness','sadness','kindness','darkness'] },
  { affix: 'est', meaning: 'the most', color: '#7c3aed', examples: ['fastest','tallest','biggest','loudest'] },
];

const TOTAL_QUESTIONS = 10;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickRandom(arr, n = 1) {
  const s = shuffle(arr);
  return n === 1 ? s[0] : s.slice(0, n);
}

function otherMeanings(correct, pool, count = 3) {
  const others = pool.filter(p => p.meaning !== correct && p.affix !== correct).map(p => p.meaning);
  return pickRandom(others, count);
}

function otherAffixes(correct, pool, count = 3) {
  return pickRandom(pool.filter(p => p.affix !== correct).map(p => p.affix), count);
}

function buildQuestions(difficulty) {
  const prefixPool = difficulty === 'suffixes' ? [] : PREFIXES;
  const suffixPool = difficulty === 'prefixes' ? [] : SUFFIXES;
  const allPool = [...prefixPool, ...suffixPool];
  const questions = [];

  const aCount = difficulty === 'both' ? 3 : 4;
  const bCount = 3;
  const cCount = difficulty === 'both' ? 2 : 1;
  const dCount = difficulty === 'both' ? 2 : 2;

  // Type A — identify prefix
  if (prefixPool.length >= 1) {
    for (let i = 0; i < aCount && prefixPool.length; i++) {
      const pref = pickRandom(prefixPool);
      const word = pickRandom(pref.examples);
      const wrongs = otherAffixes(pref.affix, allPool, 2);
      const options = shuffle([pref.affix, ...wrongs, 'no prefix'].slice(0, 4));
      questions.push({
        type: 'A',
        question: `What is the PREFIX in this word?`,
        displayWord: word,
        targetAffix: pref.affix,
        affixColor: pref.color,
        answer: pref.affix,
        options,
      });
    }
  }

  // Type B — meaning of affix
  for (let i = 0; i < bCount; i++) {
    const item = pickRandom(allPool);
    const isPrefix = prefixPool.some(p => p.affix === item.affix);
    const poolForWrongs = isPrefix ? PREFIXES : SUFFIXES;
    const wrongs = otherMeanings(item.meaning, poolForWrongs, 3);
    const options = shuffle([item.meaning, ...wrongs].slice(0, 4));
    questions.push({
      type: 'B',
      question: `What does "${item.affix + (isPrefix ? '-' : '')}" mean?`,
      displayAffix: item.affix,
      affixColor: item.color,
      isPrefix,
      answer: item.meaning,
      options,
    });
  }

  // Type C — build a word
  if (prefixPool.length >= 1 && cCount > 0) {
    for (let i = 0; i < cCount; i++) {
      const pref = pickRandom(prefixPool);
      const combined = pickRandom(pref.examples);
      const root = combined.replace(new RegExp(`^${pref.affix}`), '');
      const distractors = shuffle(
        allPool.flatMap(p => p.examples).filter(e => e !== combined)
      ).slice(0, 3);
      const options = shuffle([combined, ...distractors].slice(0, 4));
      questions.push({
        type: 'C',
        question: 'What word do they make together?',
        prefixAffix: pref.affix,
        prefixColor: pref.color,
        rootWord: root,
        answer: combined,
        options,
      });
    }
  }

  // Type D — identify suffix
  if (suffixPool.length >= 1) {
    for (let i = 0; i < dCount && suffixPool.length; i++) {
      const suf = pickRandom(suffixPool);
      const word = pickRandom(suf.examples);
      const wrongs = otherAffixes(suf.affix, allPool, 2);
      const options = shuffle([suf.affix, ...wrongs, 'no suffix'].slice(0, 4));
      questions.push({
        type: 'D',
        question: 'What is the SUFFIX in this word?',
        displayWord: word,
        targetAffix: suf.affix,
        affixColor: suf.color,
        answer: suf.affix,
        options,
      });
    }
  }

  return shuffle(questions).slice(0, TOTAL_QUESTIONS);
}

function AffixHighlight({ word, affix, color }) {
  if (!affix || !word) return <span className="mg-word-display">{word}</span>;
  const idx = word.indexOf(affix);
  if (idx === -1) return <span className="mg-word-display">{word}</span>;
  return (
    <span className="mg-word-display">
      {word.slice(0, idx)}
      <span className="mg-affix" style={{ backgroundColor: color, color: '#fff' }}>{affix}</span>
      {word.slice(idx + affix.length)}
    </span>
  );
}

export default function MorphologyGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();
  const username = localStorage.getItem('username');

  const [phase, setPhase] = useState('setup'); // setup | playing | done
  const [difficulty, setDifficulty] = useState('both'); // prefixes | suffixes | both
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState([]); // { q, selected }
  const autoAdvanceRef = useRef(null);

  const cardStyle = getCardStyle(emotion);

  const startGame = useCallback(() => {
    const qs = buildQuestions(difficulty);
    setQuestions(qs);
    setCurrentQ(0);
    setScore(0);
    setSelectedOption(null);
    setAnswered(false);
    setWrongAnswers([]);
    setPhase('playing');
  }, [difficulty]);

  // Speak question on change
  useEffect(() => {
    if (phase !== 'playing' || !questions[currentQ]) return;
    const q = questions[currentQ];
    const speakText = q.type === 'A' || q.type === 'D'
      ? `${q.question} ${q.displayWord}`
      : q.type === 'B'
      ? q.question
      : `${q.question} ${q.prefixAffix} plus ${q.rootWord}`;
    const t = setTimeout(() => SpeechService.speak(speakText, { rate: 0.85 }), 250);
    return () => clearTimeout(t);
  }, [currentQ, questions, phase]);

  const handleAnswer = useCallback((option) => {
    if (answered) return;
    const q = questions[currentQ];
    setSelectedOption(option);
    setAnswered(true);

    const correct = option === q.answer;
    triggerFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      setScore(s => s + 10);
      SpeechService.speak('Correct!', { rate: 1 });
    } else {
      SpeechService.speak(`The answer is ${q.answer}`, { rate: 0.85 });
      setWrongAnswers(prev => [...prev, { q, selected: option }]);
    }

    autoAdvanceRef.current = setTimeout(() => {
      const next = currentQ + 1;
      if (next >= questions.length) {
        setPhase('done');
        triggerFeedback('correct');
        // Save session
        axios.post(`${API_BASE}/api/morphology`, {
          username,
          difficulty,
          score: correct ? score + 10 : score,
          accuracy: Math.round(((correct ? score + 10 : score) / (questions.length * 10)) * 100),
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      } else {
        setCurrentQ(next);
        setSelectedOption(null);
        setAnswered(false);
      }
    }, 2200);
  }, [answered, currentQ, questions, score, difficulty, username]);

  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      SpeechService.stop(); // never let narration bleed past leaving the game
    };
  }, []);

  // ── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <GameShell title="Word Builder" emotion={emotion} confidence={confidence}>
        <div className="mg-container">
          <div className="gs-card" style={cardStyle}>
            <h1 className="gs-card__title">Word Builder 🧩</h1>
            <p className="mg-setup-desc">
              Words are built from parts — a beginning (prefix), an ending (suffix),
              and a root.<br />
              Spot the parts and discover what each one means!
            </p>
            <div className="mg-diff-row">
              {[
                { val: 'prefixes', label: '📌 Prefixes Only', desc: 'un-, re-, pre-...' },
                { val: 'suffixes', label: '🏷 Suffixes Only', desc: '-ing, -ed, -er...' },
                { val: 'both',    label: '🎯 Mixed',          desc: 'Prefixes & suffixes' },
              ].map(d => (
                <button
                  key={d.val}
                  className={`mg-diff-btn${difficulty === d.val ? ' mg-diff-btn--active' : ''}`}
                  onClick={() => setDifficulty(d.val)}
                  aria-label={`Select difficulty: ${d.label}`}
                >
                  <span className="mg-diff-label">{d.label}</span>
                  <span className="mg-diff-desc">{d.desc}</span>
                </button>
              ))}
            </div>
            <button
              className="gs-btn gs-btn--primary"
              onClick={startGame}
              aria-label="Play the morphology game"
            >
              Play! ▶
            </button>
          </div>
        </div>
        <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── Done phase ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const maxScore = questions.length * 10;
    const acc = Math.round((score / maxScore) * 100);
    return (
      <GameShell title="Word Builder" emotion={emotion} confidence={confidence}>
        <div className="mg-container">
          <div className="gs-card" style={cardStyle}>
            <div className="gs-complete">
              <span className="gs-complete__trophy">🎉</span>
              <h2 className="gs-complete__heading">Well done!</h2>
              <p className="gs-complete__score">Score: <strong>{score} / {maxScore}</strong></p>
              <p className="gs-complete__score">Accuracy: <strong>{acc}%</strong></p>
              {wrongAnswers.length > 0 && (
                <div className="mg-review">
                  <p className="mg-review-title">Quick review:</p>
                  {wrongAnswers.slice(0, 4).map((wa, i) => (
                    <div key={i} className="mg-review-row">
                      <span className="mg-review-q">{wa.q.question}</span>
                      <span className="mg-review-wrong">You said: <em>{wa.selected}</em></span>
                      <span className="mg-review-correct">Answer: <strong>{wa.q.answer}</strong></span>
                    </div>
                  ))}
                </div>
              )}
              <div className="swd-action-row">
                <button
                  className="gs-btn gs-btn--primary"
                  onClick={startGame}
                  aria-label="Play again with same difficulty"
                >
                  Play Again
                </button>
                <button
                  className="gs-btn gs-btn--ghost"
                  onClick={() => setPhase('setup')}
                  aria-label="Change difficulty"
                >
                  Change Difficulty
                </button>
              </div>
            </div>
          </div>
        </div>
        <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── Playing phase ─────────────────────────────────────────────────────────────
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <GameShell title="Word Builder" emotion={emotion} confidence={confidence}>
      <FeedbackGif result={answered ? (selectedOption === q.answer ? 'correct' : 'wrong') : null} />
      <div className="mg-container">
        <div className="gs-card" style={cardStyle}>
          <div className="mg-header-row">
            <span className="gs-score">Question {currentQ + 1} of {questions.length}</span>
            <span className="gs-score">⭐ {score}</span>
          </div>

          {/* Question display */}
          <div className="gs-question">
            {q.type === 'A' && <AffixHighlight word={q.displayWord} affix={q.targetAffix} color={q.affixColor} />}
            {q.type === 'D' && <AffixHighlight word={q.displayWord} affix={q.targetAffix} color={q.affixColor} />}
            {q.type === 'B' && (
              <span
                className="mg-affix-pill"
                style={{ backgroundColor: q.affixColor, color: '#fff' }}
              >
                {q.displayAffix}{q.isPrefix ? '-' : ''}
              </span>
            )}
            {q.type === 'C' && (
              <div className="mg-build-row">
                <span className="mg-tile mg-tile--prefix" style={{ borderColor: q.prefixColor }}>
                  {q.prefixAffix}
                </span>
                <span className="mg-plus">+</span>
                <span className="mg-tile mg-tile--root">{q.rootWord}</span>
              </div>
            )}
          </div>
          <p className="mg-question-text">{q.question}</p>

          {/* Options */}
          <div className="mg-options gs-options--grid">
            {q.options.map((opt, idx) => {
              let cls = 'gs-option';
              if (answered) {
                if (opt === q.answer) cls += ' gs-option--correct';
                else if (opt === selectedOption) cls += ' gs-option--incorrect';
              }
              return (
                <button
                  key={idx}
                  className={cls}
                  onClick={() => handleAnswer(opt)}
                  disabled={answered}
                  aria-label={`Answer option: ${opt}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <div className={`gs-feedback ${selectedOption === q.answer ? 'gs-feedback--correct' : 'gs-feedback--incorrect'}`}>
              {selectedOption === q.answer
                ? `✅ Correct! "${q.answer}" is right.`
                : `❌ The answer is "${q.answer}".`}
            </div>
          )}
        </div>
      </div>
      <video ref={videoRef} autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </GameShell>
  );
}
