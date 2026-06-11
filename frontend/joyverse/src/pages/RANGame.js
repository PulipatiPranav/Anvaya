import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './RANGame.css';
import useEmotionDetection from '../hooks/useEmotionDetection';
import useGameSessionLogger from '../hooks/useGameSessionLogger';
import axios from 'axios';
import { API_BASE } from '../config/api';

// ── Content pools ─────────────────────────────────────────────────────────
const POOLS = {
  letters: {
    easy:   ['b', 'd', 'p', 'q', 'n', 'u', 'm', 'w'],
    medium: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'],
    hard:   'abcdefghijklmnopqrstuvwxyz'.split(''),
  },
  numbers: {
    easy:   ['1', '2', '3', '4', '5'],
    medium: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    hard:   ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  },
  colors: {
    easy:   ['red', 'blue', 'green', 'yellow'],
    medium: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'],
    hard:   ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown'],
  },
};

const COLOR_HEX = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', brown: '#92400e',
};

const SEQUENCE_LENGTH = { easy: 10, medium: 20, hard: 30 };

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function generateSequence(category, difficulty) {
  const pool = POOLS[category][difficulty];
  const len  = SEQUENCE_LENGTH[difficulty];
  const seq  = [];
  let prev   = null;
  for (let i = 0; i < len; i++) {
    let item;
    let tries = 0;
    do {
      item = pool[Math.floor(Math.random() * pool.length)];
      tries++;
    } while (item === prev && tries < 10);
    seq.push(item);
    prev = item;
  }
  return seq;
}

function getOptions(correct, pool) {
  const others = shuffle(pool.filter(x => x !== correct));
  return shuffle([correct, ...others.slice(0, 3)]);
}

export default function RANGame() {
  const { emotion, videoRef, canvasRef } = useEmotionDetection();

  const [category,   setCategory]   = useState('letters');
  const [difficulty, setDifficulty] = useState('easy');

  const [gameState,  setGameState]  = useState('setup');   // setup | countdown | playing | done
  const [countdown,  setCountdown]  = useState(3);
  const [sequence,   setSequence]   = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [options,    setOptions]    = useState([]);
  const [items,      setItems]      = useState([]);
  const [elapsed,    setElapsed]    = useState(0);          // ms
  const [flash,      setFlash]      = useState(null);       // 'correct' | 'wrong' | null
  const [score,      setScore]      = useState(0);

  const timerRef       = useRef(null);
  const itemStartRef   = useRef(null);
  const sessionStartRef = useRef(null);
  const username = localStorage.getItem('username');
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score });

  const startRound = useCallback((cat, diff) => {
    const seq = generateSequence(cat, diff);
    setSequence(seq);
    setCurrentIdx(0);
    setOptions(getOptions(seq[0], POOLS[cat][diff]));
    setItems([]);
    setElapsed(0);
    setFlash(null);
    setScore(0);
    setCountdown(3);
    setGameState('countdown');
  }, []);

  // Countdown effect
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown === 0) {
      setGameState('playing');
      sessionStartRef.current = Date.now();
      itemStartRef.current    = Date.now();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  // Live timer while playing
  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => setElapsed(e => e + 100), 100);
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  const handleSelect = (option) => {
    if (gameState !== 'playing') return;

    const timeMs  = itemStartRef.current ? Math.round(Date.now() - itemStartRef.current) : 0;
    const correct = option === sequence[currentIdx];
    const itemRecord = { item: sequence[currentIdx], selected: option, correct, timeMs };
    const newItems = [...items, itemRecord];

    setItems(newItems);
    if (correct) setScore(s => s + 10);
    setFlash(correct ? 'correct' : 'wrong');

    const advance = () => {
      setFlash(null);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= sequence.length) {
        finishGame(newItems);
      } else {
        setCurrentIdx(nextIdx);
        setOptions(getOptions(sequence[nextIdx], POOLS[category][difficulty]));
        itemStartRef.current = Date.now();
      }
    };

    if (correct) {
      // Immediate advance for correct
      advance();
    } else {
      // Brief flash then advance
      setTimeout(advance, 600);
    }
  };

  const finishGame = (allItems) => {
    clearInterval(timerRef.current);
    setGameState('done');
    confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });

    const totalTimeMs    = Date.now() - sessionStartRef.current;
    const totalItems     = allItems.length;
    const correctItems   = allItems.filter(i => i.correct).length;
    const accuracy       = totalItems ? Math.round((correctItems / totalItems) * 100) : 0;
    const itemsPerMinute = totalItems
      ? Math.round((totalItems / totalTimeMs) * 60000)
      : 0;
    const moodAtStart = localStorage.getItem('selectedEmotion') || 'neutral';

    axios.post(`${API_BASE}/api/ran`, {
      username,
      category,
      difficulty,
      startTime:      new Date(sessionStartRef.current).toISOString(),
      endTime:        new Date().toISOString(),
      totalTimeMs,
      itemsPerMinute,
      totalItems,
      correctItems,
      accuracy,
      items:          allItems,
      moodAtStart,
    }).catch(err => console.error('Failed to save RAN session:', err));

    endSession();
  };

  const getEmotionStyle = (em) => {
    switch (em) {
      case 'Happy':    return { backgroundColor: '#FFFDE7', color: '#333' };
      case 'Sad':      return { backgroundColor: '#E8F5E9', color: '#3B2F2F' };
      case 'Angry':    return { backgroundColor: '#E0F2F1', color: '#223344' };
      case 'Surprise': return { backgroundColor: '#FFF3E0', color: '#4B0082' };
      default:         return { backgroundColor: '#F0FDF4', color: '#052e16' };
    }
  };
  const cardStyle = getEmotionStyle(emotion);

  const currentItem = sequence[currentIdx];
  const elapsedSec  = (elapsed / 1000).toFixed(1);

  // ── Setup ──────────────────────────────────────────────────────────────
  if (gameState === 'setup') {
    return (
      <div className="ran-container">
        <div className="ran-card" style={cardStyle}>
          <h1 className="ran-title">Rapid Naming</h1>
          <p className="ran-intro">Name as many items as you can — as fast as possible!</p>

          <div className="ran-controls">
            <div className="ran-select-group">
              <label htmlFor="ran-cat">Category:</label>
              <select id="ran-cat" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="letters">🔤 Letters</option>
                <option value="numbers">🔢 Numbers</option>
                <option value="colors">🎨 Colors</option>
              </select>
            </div>
            <div className="ran-select-group">
              <label htmlFor="ran-diff">Difficulty:</label>
              <select id="ran-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">🟢 Easy (10 items)</option>
                <option value="medium">🟡 Medium (20 items)</option>
                <option value="hard">🔴 Hard (30 items)</option>
              </select>
            </div>
          </div>

          <button className="ran-btn ran-btn--go" onClick={() => startRound(category, difficulty)}>
            Start!
          </button>
        </div>
      </div>
    );
  }

  // ── Countdown ──────────────────────────────────────────────────────────
  if (gameState === 'countdown') {
    return (
      <div className="ran-container">
        <div className="ran-card" style={cardStyle}>
          <h1 className="ran-title">Get ready…</h1>
          <div className="ran-countdown">{countdown === 0 ? 'Go!' : countdown}</div>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────
  if (gameState === 'done') {
    const totalMs  = items.reduce((s, i) => s + i.timeMs, 0);
    const correct  = items.filter(i => i.correct).length;
    const accuracy = items.length ? Math.round((correct / items.length) * 100) : 0;
    const ipm      = items.length ? Math.round((items.length / totalMs) * 60000) : 0;

    return (
      <div className="ran-container">
        <div className="ran-card" style={cardStyle}>
          <h1 className="ran-title">Rapid Naming</h1>
          <div className="ran-summary">
            <h2>Round complete! ⚡</h2>
            <div className="ran-stats-grid">
              <div className="ran-stat-box">
                <span className="ran-stat-val">{(totalMs / 1000).toFixed(1)}s</span>
                <span className="ran-stat-lbl">Total time</span>
              </div>
              <div className="ran-stat-box">
                <span className="ran-stat-val">{ipm}</span>
                <span className="ran-stat-lbl">Items / min</span>
              </div>
              <div className="ran-stat-box">
                <span className="ran-stat-val"
                  style={{ color: accuracy >= 70 ? '#166534' : '#991b1b' }}>{accuracy}%</span>
                <span className="ran-stat-lbl">Accuracy</span>
              </div>
              <div className="ran-stat-box">
                <span className="ran-stat-val">{score}</span>
                <span className="ran-stat-lbl">Score</span>
              </div>
            </div>

            <details className="ran-details">
              <summary>Item-by-item results</summary>
              <div className="ran-results-list">
                {items.map((it, i) => (
                  <div key={i} className={`ran-result-row ${it.correct ? 'correct' : 'wrong'}`}>
                    {category === 'colors'
                      ? <span className="ran-result-swatch"
                          style={{ background: COLOR_HEX[it.item] || '#999' }} />
                      : <span className="ran-result-item">{it.item}</span>}
                    <span className="ran-result-ans">
                      {it.correct ? '✅' : `❌ → ${it.selected}`}
                    </span>
                    <span className="ran-result-time">{(it.timeMs / 1000).toFixed(2)}s</span>
                  </div>
                ))}
              </div>
            </details>

            <div className="ran-replay-row">
              <button className="ran-btn ran-btn--primary"
                onClick={() => startRound(category, difficulty)}>
                Play Again
              </button>
              <button className="ran-btn ran-btn--secondary"
                onClick={() => setGameState('setup')}>
                Change Settings
              </button>
            </div>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────
  return (
    <div className="ran-container">
      <div className="ran-card" style={cardStyle}>
        <div className="ran-hud">
          <span className="ran-hud-item">⚡ {elapsedSec}s</span>
          <span className="ran-hud-item">{currentIdx + 1} / {sequence.length}</span>
          <span className="ran-hud-item">⭐ {score}</span>
        </div>

        {/* Progress bar */}
        <div className="ran-progress-bar">
          <div className="ran-progress-fill"
            style={{ width: `${((currentIdx) / sequence.length) * 100}%` }} />
        </div>

        {/* Item display */}
        <div className={`ran-item-display ${flash ? `ran-flash--${flash}` : ''}`}>
          {category === 'colors' ? (
            <div className="ran-color-swatch"
              style={{ background: COLOR_HEX[currentItem] || '#999' }} />
          ) : (
            <span className="ran-item-letter">{currentItem}</span>
          )}
        </div>

        {/* Options */}
        <div className="ran-options">
          {options.map(opt => (
            <button key={opt} className="ran-option"
              onClick={() => handleSelect(opt)}
              disabled={flash !== null}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </div>
  );
}
