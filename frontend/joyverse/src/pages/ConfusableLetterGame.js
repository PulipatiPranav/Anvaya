import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './ConfusableLetterGame.css';
import useEmotionDetection from '../hooks/useEmotionDetection';
import useGameSessionLogger from '../hooks/useGameSessionLogger';
import SpeechService from '../services/SpeechService';
import axios from 'axios';

import { API_BASE } from '../config/api';
const QUESTIONS_PER_ROUND = 10;
const PAIR_LABELS = { bd: 'b / d', pq: 'p / q', mw: 'm / w', nu: 'n / u' };
const PAIR_COLORS = {
  bd: '#e0e7ff', pq: '#fce7f3', mw: '#d1fae5', nu: '#fef3c7',
};

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function computePairAccuracy(events) {
  const acc = {};
  ['bd', 'pq', 'mw', 'nu'].forEach(pair => {
    const pairEvts = events.filter(e => e.pair === pair);
    if (pairEvts.length > 0) {
      acc[pair] = Math.round((pairEvts.filter(e => e.correct).length / pairEvts.length) * 100);
    }
  });
  return acc;
}

export default function ConfusableLetterGame() {
  const { emotion, videoRef, canvasRef } = useEmotionDetection();

  const [difficulty, setDifficulty] = useState('easy');
  const [focusPair,  setFocusPair]  = useState('all');

  const [questions,   setQuestions]  = useState([]);
  const [currentIdx,  setCurrentIdx] = useState(0);
  const [selected,    setSelected]   = useState(null);
  const [score,       setScore]      = useState(0);
  const [events,      setEvents]     = useState([]);
  const [gameOver,    setGameOver]   = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [loadError,   setLoadError]  = useState('');

  const questionStartRef = useRef(null);
  const sessionStartRef  = useRef(new Date());
  const username = localStorage.getItem('username');
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score });

  const loadQuestions = useCallback(async (diff, pair) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ difficulty: diff });
      if (pair !== 'all') params.set('pair', pair);
      const res = await fetch(`${API_BASE}/api/confusable-letter/content?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const raw = await res.json();

      if (!raw || raw.length === 0) {
        setLoadError('No content found for this selection. Try a different difficulty or pair.');
        setQuestions([]);
        setLoading(false);
        return;
      }

      const picked = shuffle(raw).slice(0, QUESTIONS_PER_ROUND);
      setQuestions(picked);
      setCurrentIdx(0);
      setSelected(null);
      setScore(0);
      setEvents([]);
      setGameOver(false);
      sessionStartRef.current = new Date();
    } catch {
      setLoadError('Could not load content. Check that the backend is running and the database is seeded.');
      setQuestions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuestions(difficulty, focusPair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, focusPair]);

  const current = questions[currentIdx];

  // Announce the question via TTS when it changes
  useEffect(() => {
    if (current && !selected && !gameOver) {
      questionStartRef.current = Date.now();
      const announcement = current.type === 'letter_id'
        ? `Which letter is this?`
        : `Which letter fills the blank in: ${current.question}`;
      const t = setTimeout(() => SpeechService.speak(announcement, { rate: 0.8 }), 300);
      return () => clearTimeout(t);
    }
  }, [currentIdx, current, selected, gameOver]);

  const handleSelect = (option) => {
    if (selected || gameOver) return;

    const reactionTimeMs = questionStartRef.current
      ? Math.round(Date.now() - questionStartRef.current)
      : 0;
    const isCorrect = option === current.correct;
    const event = {
      pair:           current.pair,
      type:           current.type,
      question:       current.question,
      selected:       option,
      correct:        isCorrect,
      reactionTimeMs,
    };

    setSelected(option);
    setEvents(prev => [...prev, event]);

    if (isCorrect) {
      setScore(s => s + 10);
      SpeechService.speak('Correct!', { rate: 1.0 });
    } else {
      SpeechService.speak(`Not quite — the answer is ${current.correct}.`, { rate: 0.85 });
    }

    setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        finishGame([...events, event]);
      } else {
        setCurrentIdx(nextIdx);
        setSelected(null);
      }
    }, 1400);
  };

  const finishGame = (allEvents) => {
    setGameOver(true);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

    const total           = allEvents.length;
    const correctCount    = allEvents.filter(e => e.correct).length;
    const overallAccuracy = total ? Math.round((correctCount / total) * 100) : 0;
    const pairAccuracy    = computePairAccuracy(allEvents);
    const finalScore      = correctCount * 10;
    const moodAtStart     = localStorage.getItem('selectedEmotion') || 'neutral';
    const focusPairs      = focusPair === 'all' ? ['bd', 'pq', 'mw', 'nu'] : [focusPair];

    axios.post('http://localhost:4000/api/confusable-letter', {
      username,
      difficulty,
      focusPairs,
      startTime:       sessionStartRef.current.toISOString(),
      endTime:         new Date().toISOString(),
      score:           finalScore,
      events:          allEvents,
      overallAccuracy,
      pairAccuracy,
      moodAtStart,
    }).catch(err => console.error('Failed to save confusable session:', err));

    endSession();
  };

  const getEmotionStyle = (em) => {
    switch (em) {
      case 'Happy':    return { backgroundColor: '#FFFDE7', color: '#333' };
      case 'Sad':      return { backgroundColor: '#E8F5E9', color: '#3B2F2F' };
      case 'Angry':    return { backgroundColor: '#E0F2F1', color: '#223344' };
      case 'Surprise': return { backgroundColor: '#FFF3E0', color: '#4B0082' };
      default:         return { backgroundColor: '#F3F4FF', color: '#1e1b4b' };
    }
  };
  const cardStyle = getEmotionStyle(emotion);

  if (loading) {
    return (
      <div className="clg-container">
        <div className="clg-card" style={cardStyle}>
          <p className="clg-loading">Loading questions…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="clg-container">
        <div className="clg-card" style={cardStyle}>
          <h1 className="clg-title">Confusable Letter Trainer</h1>
          <p className="clg-error">{loadError}</p>
        </div>
      </div>
    );
  }

  // ── Game over ────────────────────────────────────────────────────────────
  if (gameOver) {
    const total          = events.length;
    const correctCount   = events.filter(e => e.correct).length;
    const accuracy       = total ? Math.round((correctCount / total) * 100) : 0;
    const pairAccuracy   = computePairAccuracy(events);
    const worstPair      = Object.entries(pairAccuracy).sort((a, b) => a[1] - b[1])[0];

    return (
      <div className="clg-container">
        <div className="clg-card" style={cardStyle}>
          <h1 className="clg-title">Confusable Letter Trainer</h1>
          <div className="clg-summary">
            <h2>Round complete! 🎉</h2>
            <p className="clg-stat">Score: <strong>{score}</strong></p>
            <p className="clg-stat">Correct: <strong>{correctCount}/{total}</strong></p>
            <p className="clg-stat">Overall accuracy: <strong>{accuracy}%</strong></p>

            {/* Per-pair accuracy breakdown */}
            <div className="clg-pair-grid">
              {Object.entries(pairAccuracy).map(([pair, pct]) => (
                <div key={pair} className="clg-pair-tile"
                  style={{ background: PAIR_COLORS[pair] || '#eee',
                           borderColor: pct < 70 ? '#ef4444' : '#22c55e' }}>
                  <span className="clg-pair-label">{PAIR_LABELS[pair]}</span>
                  <span className="clg-pair-pct"
                    style={{ color: pct < 70 ? '#991b1b' : '#166534' }}>{pct}%</span>
                </div>
              ))}
            </div>

            {worstPair && worstPair[1] < 80 && (
              <p className="clg-tip">
                Needs more practice: <strong>{PAIR_LABELS[worstPair[0]]}</strong> ({worstPair[1]}%)
              </p>
            )}

            {/* Detailed event list */}
            <details className="clg-details">
              <summary>Question-by-question results</summary>
              <div className="clg-results-list">
                {events.map((ev, i) => (
                  <div key={i} className={`clg-result-row ${ev.correct ? 'correct' : 'wrong'}`}>
                    <span className="clg-result-q">{ev.question}</span>
                    <span className="clg-result-detail">
                      {ev.correct ? '✅' : `❌ → ${ev.selected} (ans: ${ev.correct ? ev.selected : current?.correct ?? ''})`}
                      &nbsp;·&nbsp;{(ev.reactionTimeMs / 1000).toFixed(1)}s
                    </span>
                    <span className="clg-pair-chip" style={{ background: PAIR_COLORS[ev.pair] }}>
                      {PAIR_LABELS[ev.pair]}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            <button className="clg-btn clg-btn--primary"
              onClick={() => loadQuestions(difficulty, focusPair)}>
              Play Again
            </button>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </div>
    );
  }

  // ── Active question ───────────────────────────────────────────────────────
  const colCount = current?.options.length <= 2 ? 2 : 4;

  return (
    <div className="clg-container">
      <div className="clg-card" style={cardStyle}>
        <h1 className="clg-title">Confusable Letter Trainer</h1>

        {/* Controls */}
        <div className="clg-controls">
          <div className="clg-select-group">
            <label htmlFor="clg-pair">Pair:</label>
            <select id="clg-pair" value={focusPair} onChange={e => setFocusPair(e.target.value)}>
              <option value="all">All pairs</option>
              {Object.entries(PAIR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="clg-select-group">
            <label htmlFor="clg-diff">Difficulty:</label>
            <select id="clg-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
            </select>
          </div>
        </div>

        {/* Progress */}
        <div className="clg-statusbar">
          <span>Question {currentIdx + 1} / {questions.length}</span>
          <span>⭐ {score}</span>
          {current && (
            <span className="clg-pair-badge" style={{ background: PAIR_COLORS[current.pair] }}>
              {PAIR_LABELS[current.pair]}
            </span>
          )}
        </div>

        {/* Question display */}
        {current && (
          <>
            <div className="clg-question-panel">
              {current.type === 'letter_id' ? (
                <span className="clg-big-letter">{current.question}</span>
              ) : (
                <span className="clg-word-template">{current.question}</span>
              )}
              <p className="clg-prompt">
                {current.type === 'letter_id'
                  ? 'Which letter is this?'
                  : 'Which letter fills the blank?'}
              </p>
              <button
                className="clg-speak-btn"
                onClick={() => SpeechService.speak(
                  current.type === 'letter_id'
                    ? `The letter ${current.correct}`
                    : current.question,
                  { rate: 0.75 }
                )}
                aria-label="Hear the question"
              >🔊</button>
            </div>

            <div className="clg-options" data-cols={colCount}>
              {current.options.map(opt => {
                let cls = 'clg-option';
                if (selected) {
                  if (opt === current.correct)  cls += ' clg-option--correct';
                  else if (opt === selected)     cls += ' clg-option--wrong';
                  else                           cls += ' clg-option--dimmed';
                }
                return (
                  <button key={opt} className={cls}
                    onClick={() => handleSelect(opt)} disabled={!!selected}>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Hint shown after answering */}
            {selected && current.hint && (
              <p className="clg-hint">{current.hint}</p>
            )}
          </>
        )}
      </div>

      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </div>
  );
}
