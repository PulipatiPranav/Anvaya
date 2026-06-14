import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './VerbalMemoryGame.css';
import useEmotionDetection from '../hooks/useEmotionDetection';
import useGameSessionLogger from '../hooks/useGameSessionLogger';
import SpeechService from '../services/SpeechService';
import GameShell from '../components/GameShell';
import FeedbackGif from '../components/FeedbackGif';
import axios from 'axios';

import { API_BASE } from '../config/api';
// ── Content pools (no database needed — client-side generation) ────────────
const ITEM_POOLS = {
  words: {
    easy:   ['cat', 'dog', 'sun', 'bed', 'hat', 'cup', 'red', 'pen'],
    medium: ['table', 'house', 'green', 'happy', 'water', 'light', 'brown', 'door', 'bird', 'fish'],
    hard:   ['elephant', 'umbrella', 'yellow', 'garden', 'kitchen', 'balloon', 'rabbit', 'window', 'orange', 'purple', 'pencil', 'butter'],
  },
  letters: {
    easy:   ['b', 'd', 'p', 'q', 'n', 'u', 'm', 'w'],
    medium: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    hard:   ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
  },
  numbers: {
    easy:   ['1', '2', '3', '4', '5', '6', '7', '8'],
    medium: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    hard:   ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  },
};

// speak gap (ms) per mode — allows speech to finish before next item
const SPEAK_GAP = { words: 1500, letters: 900, numbers: 900 };

const SEQ_CONFIG = {
  easy:   { start: 3, max: 6 },
  medium: { start: 4, max: 7 },
  hard:   { start: 5, max: 8 },
};

const ROUNDS_PER_GAME = 8;

function computeWorkingMemoryScore(maxLen, avgAccuracy) {
  return Math.round(maxLen * (avgAccuracy / 100) * 10);
}

export default function VerbalMemoryGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();

  const [mode,       setMode]       = useState('words');
  const [difficulty, setDifficulty] = useState('easy');
  const [gamePhase,  setGamePhase]  = useState('setup'); // setup|listen|recall|feedback|done

  const [roundNum,          setRoundNum]          = useState(0);
  const [seqLength,         setSeqLength]         = useState(SEQ_CONFIG.easy.start);
  const [consecutiveFails,  setConsecutiveFails]  = useState(0);
  const [sequence,          setSequence]          = useState([]);
  const [currentPool,       setCurrentPool]       = useState([]);
  const [recalled,          setRecalled]          = useState([]);
  const [listenIdx,         setListenIdx]         = useState(-1);
  const [roundResult,       setRoundResult]       = useState(null);
  const [rounds,            setRounds]            = useState([]);
  const [score,             setScore]             = useState(0);

  const playbackRef    = useRef(false);
  const roundsRef      = useRef([]);
  const seqLengthRef   = useRef(SEQ_CONFIG.easy.start);
  const consFailsRef   = useRef(0);
  const sessionStartRef = useRef(new Date());
  const username = localStorage.getItem('username');
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score });

  // ── Sequence playback ─────────────────────────────────────────────────
  const startListenPhase = useCallback(async (items, itemMode) => {
    playbackRef.current = true;
    setListenIdx(-1);
    const gap = SPEAK_GAP[itemMode] || 1400;

    await new Promise(r => setTimeout(r, 500));

    for (let i = 0; i < items.length; i++) {
      if (!playbackRef.current) return;
      setListenIdx(i);
      SpeechService.speak(items[i], { rate: itemMode === 'words' ? 0.8 : 0.9 });
      await new Promise(r => setTimeout(r, gap));
    }

    if (!playbackRef.current) return;
    setListenIdx(-1);
    await new Promise(r => setTimeout(r, 600));

    if (!playbackRef.current) return;
    setGamePhase('recall');
  }, []);

  // ── Start a round ─────────────────────────────────────────────────────
  const startRound = useCallback((length, currentMode, currentDifficulty) => {
    const pool = [...ITEM_POOLS[currentMode][currentDifficulty]];
    // Shuffle pool; pick `length` items without repetition
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const seq = shuffled.slice(0, length);

    setCurrentPool(pool);
    setSequence(seq);
    setRecalled([]);
    setRoundResult(null);
    setGamePhase('listen');
    startListenPhase(seq, currentMode);
  }, [startListenPhase]);

  // ── Handle recall tap ──────────────────────────────────────────────────
  const handleRecallTap = (item) => {
    if (recalled.includes(item)) return;
    const newRecalled = [...recalled, item];
    setRecalled(newRecalled);

    // Auto-submit when all slots filled
    if (newRecalled.length === sequence.length) {
      setTimeout(() => checkAnswer(newRecalled), 300);
    }
  };

  const handleUndo = () => {
    setRecalled(prev => prev.slice(0, -1));
  };

  // ── Check answer ───────────────────────────────────────────────────────
  const checkAnswer = useCallback((recalledItems) => {
    const posCorrect = recalledItems.filter((item, i) => item === sequence[i]).length;
    const positionAccuracy = Math.round((posCorrect / sequence.length) * 100);
    const correct = positionAccuracy === 100;

    const result = {
      round:            roundNum + 1,
      sequenceLength:   sequence.length,
      presented:        [...sequence],
      recalled:         [...recalledItems],
      correct,
      positionAccuracy,
    };

    // Update rounds via ref to avoid stale closure in finishGame
    const updatedRounds = [...roundsRef.current, result];
    roundsRef.current = updatedRounds;
    setRounds(updatedRounds);

    if (correct) {
      setScore(s => s + sequence.length * 10);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
      consFailsRef.current = 0;
      setConsecutiveFails(0);
      const next = Math.min(seqLengthRef.current + 1, SEQ_CONFIG[difficulty].max);
      seqLengthRef.current = next;
      setSeqLength(next);
    } else {
      consFailsRef.current += 1;
      setConsecutiveFails(consFailsRef.current);
      if (consFailsRef.current >= 2) {
        const prev = Math.max(seqLengthRef.current - 1, SEQ_CONFIG[difficulty].start);
        seqLengthRef.current = prev;
        setSeqLength(prev);
        consFailsRef.current = 0;
        setConsecutiveFails(0);
      }
    }

    setRoundResult(result);
    setGamePhase('feedback');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, roundNum, difficulty]);

  // ── Proceed after feedback ─────────────────────────────────────────────
  const proceedAfterFeedback = () => {
    const nextRound = roundNum + 1;
    if (nextRound >= ROUNDS_PER_GAME) {
      finishGame();
    } else {
      setRoundNum(nextRound);
      startRound(seqLengthRef.current, mode, difficulty);
    }
  };

  // Auto-advance feedback after 3 s for final session flow
  useEffect(() => {
    if (gamePhase !== 'feedback') return;
    const t = setTimeout(proceedAfterFeedback, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, roundNum]);

  // ── Finish game ────────────────────────────────────────────────────────
  const finishGame = () => {
    playbackRef.current = false;
    const allRounds = roundsRef.current;
    const total = allRounds.length;
    if (total === 0) { setGamePhase('done'); return; }

    const overallAccuracy = Math.round(
      allRounds.reduce((s, r) => s + r.positionAccuracy, 0) / total
    );
    const maxLen = Math.max(...allRounds.map(r => r.sequenceLength));
    const wms    = computeWorkingMemoryScore(maxLen, overallAccuracy);
    const moodAtStart = localStorage.getItem('selectedEmotion') || 'neutral';

    axios.post(`${API_BASE}/api/verbal-memory`, {
      username,
      difficulty,
      mode,
      startTime:          sessionStartRef.current.toISOString(),
      endTime:            new Date().toISOString(),
      rounds:             allRounds,
      maxSequenceLength:  maxLen,
      overallAccuracy,
      workingMemoryScore: wms,
      moodAtStart,
    }).catch(err => console.error('Failed to save verbal memory session:', err));

    endSession();
    setGamePhase('done');
  };

  // Cleanup playback on unmount
  useEffect(() => {
    return () => { playbackRef.current = false; SpeechService.stop(); };
  }, []);

  // Replay sequence button
  const handleReplaySequence = () => {
    if (gamePhase !== 'recall') return;
    startListenPhase(sequence, mode).then(() => {
      // don't reset recalled — just replayed for reference
    });
  };

  // Emotion-adaptive card style
  const getCardStyle = (em) => {
    switch (em) {
      case 'Happy':    return { backgroundColor: '#FFFDE7', color: '#333' };
      case 'Sad':      return { backgroundColor: '#E8F5E9', color: '#3B2F2F' };
      case 'Angry':    return { backgroundColor: '#E0F2F1', color: '#223344' };
      case 'Surprise': return { backgroundColor: '#FFF3E0', color: '#4B0082' };
      default:         return { backgroundColor: '#F0F4FF', color: '#1e1b4b' };
    }
  };
  const cardStyle = getCardStyle(emotion);

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (gamePhase === 'setup') {
    return (
      <GameShell title="Sequence Memory" emotion={emotion} confidence={confidence}>
      <div className="vsm-container">
        <div className="vsm-card vsm-card--setup" style={cardStyle}>
          <h1 className="vsm-title">Verbal Sequence Memory</h1>
          <p className="vsm-intro">
            Listen carefully to the sequence, then tap the items in the <strong>same order</strong>.
          </p>

          <div className="vsm-controls">
            <div className="vsm-select-group">
              <label htmlFor="vsm-mode">Mode:</label>
              <select id="vsm-mode" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="words">🔤 Words</option>
                <option value="letters">🔡 Letters</option>
                <option value="numbers">🔢 Numbers</option>
              </select>
            </div>
            <div className="vsm-select-group">
              <label htmlFor="vsm-diff">Difficulty:</label>
              <select id="vsm-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">🟢 Easy (starts at 3)</option>
                <option value="medium">🟡 Medium (starts at 4)</option>
                <option value="hard">🔴 Hard (starts at 5)</option>
              </select>
            </div>
          </div>

          <div className="vsm-info-row">
            <span>🎧 {ROUNDS_PER_GAME} rounds</span>
            <span>📈 Adaptive length</span>
            <span>🔊 Audio-first</span>
          </div>

          <button className="vsm-btn vsm-btn--start" onClick={() => {
            roundsRef.current  = [];
            seqLengthRef.current = SEQ_CONFIG[difficulty].start;
            consFailsRef.current = 0;
            sessionStartRef.current = new Date();
            setRoundNum(0);
            setSeqLength(SEQ_CONFIG[difficulty].start);
            setConsecutiveFails(0);
            setRounds([]);
            setScore(0);
            startRound(SEQ_CONFIG[difficulty].start, mode, difficulty);
          }}>
            Start
          </button>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── LISTEN ─────────────────────────────────────────────────────────────
  if (gamePhase === 'listen') {
    return (
      <GameShell title="Sequence Memory" emotion={emotion} confidence={confidence}>
      <div className="vsm-container">
        <div className="vsm-card" style={cardStyle}>
          <div className="vsm-round-badge">Round {roundNum + 1} / {ROUNDS_PER_GAME}</div>
          <h2 className="vsm-phase-title">🎧 Listen carefully…</h2>
          <p className="vsm-phase-sub">Sequence length: <strong>{sequence.length}</strong></p>

          <div className="vsm-listen-tiles">
            {sequence.map((item, i) => (
              <div key={i}
                className={`vsm-listen-tile ${
                  i < listenIdx  ? 'vsm-listen-tile--done'
                  : i === listenIdx ? 'vsm-listen-tile--active'
                  : 'vsm-listen-tile--pending'
                }`}>
                {i <= listenIdx ? item : '?'}
              </div>
            ))}
          </div>

          {listenIdx >= 0 && (
            <div className="vsm-speaking-indicator">
              <span className="vsm-wave" />
              <span className="vsm-wave" />
              <span className="vsm-wave" />
            </div>
          )}
          <p className="vsm-listen-hint">
            {listenIdx < 0 ? 'Get ready…' : `Playing item ${listenIdx + 1} of ${sequence.length}`}
          </p>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── RECALL ─────────────────────────────────────────────────────────────
  if (gamePhase === 'recall') {
    return (
      <GameShell title="Sequence Memory" emotion={emotion} confidence={confidence}>
      <div className="vsm-container">
        <div className="vsm-card" style={cardStyle}>
          <div className="vsm-round-badge">Round {roundNum + 1} / {ROUNDS_PER_GAME}</div>
          <h2 className="vsm-phase-title">Recall the sequence</h2>

          <div className="vsm-sequence-bar">
            {sequence.map((_, i) => (
              <div key={i}
                className={`vsm-slot ${i < recalled.length ? 'vsm-slot--filled' : 'vsm-slot--empty'}`}>
                {i < recalled.length ? recalled[i] : i + 1}
              </div>
            ))}
          </div>

          <p className="vsm-recall-prompt">
            Tap items in the order you heard them ({recalled.length}/{sequence.length})
          </p>

          <div className="vsm-pool-grid"
            style={{ '--pool-cols': currentPool.length <= 8 ? 4 : 4 }}>
            {currentPool.map(item => {
              const tapIdx = recalled.indexOf(item);
              const tapped = tapIdx !== -1;
              return (
                <button key={item}
                  className={`vsm-pool-item ${tapped ? 'vsm-pool-item--tapped' : ''}`}
                  onClick={() => handleRecallTap(item)}
                  disabled={tapped || recalled.length >= sequence.length}>
                  {item}
                  {tapped && <span className="vsm-tap-badge">{tapIdx + 1}</span>}
                </button>
              );
            })}
          </div>

          <div className="vsm-recall-actions">
            <button className="vsm-btn vsm-btn--secondary"
              onClick={handleUndo} disabled={recalled.length === 0}>
              ← Undo
            </button>
            <button className="vsm-btn vsm-btn--ghost"
              onClick={handleReplaySequence}>
              🔊 Replay
            </button>
          </div>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── FEEDBACK ───────────────────────────────────────────────────────────
  if (gamePhase === 'feedback' && roundResult) {
    const { correct, positionAccuracy, presented, recalled: rec } = roundResult;
    return (
      <GameShell title="Sequence Memory" emotion={emotion} confidence={confidence}>
      <FeedbackGif result={correct ? 'correct' : 'wrong'} />
      <div className="vsm-container">
        <div className="vsm-card" style={cardStyle}>
          <div className="vsm-round-badge">Round {roundNum + 1} / {ROUNDS_PER_GAME}</div>
          <h2 className={`vsm-phase-title ${correct ? 'vsm-correct-title' : 'vsm-wrong-title'}`}>
            {correct ? '✅ Correct!' : `${positionAccuracy}% accurate`}
          </h2>

          <div className="vsm-comparison">
            {presented.map((item, i) => {
              const match = rec[i] === item;
              return (
                <div key={i} className={`vsm-compare-row ${match ? 'correct' : 'wrong'}`}>
                  <span className="vsm-pos">#{i + 1}</span>
                  <span className="vsm-expected">{item}</span>
                  <span className="vsm-arrow">→</span>
                  <span className="vsm-given">{rec[i] || '—'}</span>
                  <span className="vsm-match-icon">{match ? '✅' : '❌'}</span>
                </div>
              );
            })}
          </div>

          <p className="vsm-feedback-hint">
            {correct
              ? `Great! Next sequence will be ${Math.min(seqLength + 1, SEQ_CONFIG[difficulty].max)} items.`
              : consecutiveFails >= 2
                ? `Sequence length reduced to ${seqLength} — keep practising!`
                : 'Try again — listen extra carefully to the order.'}
          </p>
          <p className="vsm-auto-advance">Auto-advancing in 4s…</p>
          <button className="vsm-btn vsm-btn--primary" onClick={proceedAfterFeedback}>
            {roundNum + 1 >= ROUNDS_PER_GAME ? 'See Results' : 'Next Round →'}
          </button>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── DONE ───────────────────────────────────────────────────────────────
  if (gamePhase === 'done') {
    const total = rounds.length;
    const avgAcc = total
      ? Math.round(rounds.reduce((s, r) => s + r.positionAccuracy, 0) / total)
      : 0;
    const maxLen = total ? Math.max(...rounds.map(r => r.sequenceLength)) : 0;
    const wms    = computeWorkingMemoryScore(maxLen, avgAcc);
    const perfectRounds = rounds.filter(r => r.correct).length;

    return (
      <GameShell title="Sequence Memory" emotion={emotion} confidence={confidence}>
      <div className="vsm-container">
        <div className="vsm-card" style={cardStyle}>
          <h1 className="vsm-title">Verbal Sequence Memory</h1>
          <h2 style={{ textAlign: 'center', margin: '0 0 8px' }}>Session complete! 🎉</h2>

          <div className="vsm-stats-grid">
            <div className="vsm-stat-box vsm-stat--wms">
              <span className="vsm-stat-val">{wms}</span>
              <span className="vsm-stat-lbl">Working Memory Score</span>
            </div>
            <div className="vsm-stat-box">
              <span className="vsm-stat-val">{maxLen}</span>
              <span className="vsm-stat-lbl">Max Sequence Length</span>
            </div>
            <div className="vsm-stat-box">
              <span className="vsm-stat-val"
                style={{ color: avgAcc >= 70 ? '#166534' : '#991b1b' }}>{avgAcc}%</span>
              <span className="vsm-stat-lbl">Overall Accuracy</span>
            </div>
            <div className="vsm-stat-box">
              <span className="vsm-stat-val">{perfectRounds}/{total}</span>
              <span className="vsm-stat-lbl">Perfect Rounds</span>
            </div>
          </div>

          <details className="vsm-details">
            <summary>Round-by-round results</summary>
            <div className="vsm-rounds-list">
              {rounds.map((r, i) => (
                <div key={i} className={`vsm-round-row ${r.correct ? 'correct' : 'wrong'}`}>
                  <span className="vsm-round-num">R{r.round}</span>
                  <span className="vsm-round-len">Len {r.sequenceLength}</span>
                  <span className="vsm-round-seq">{r.presented.join(' → ')}</span>
                  <span className="vsm-round-acc">{r.positionAccuracy}%</span>
                  <span>{r.correct ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
          </details>

          <button className="vsm-btn vsm-btn--start"
            onClick={() => {
              setGamePhase('setup');
              setRounds([]);
              roundsRef.current = [];
              setScore(0);
            }}>
            Play Again
          </button>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  return null;
}
