import React, { useState, useEffect, useCallback } from 'react';
import GameShell from '../components/GameShell';
import useEmotionDetection from '../hooks/useEmotionDetection';
import { getCardStyle } from '../utils/EmotionThemeMap';
import SpeechService from '../services/SpeechService';
import { API_BASE } from '../config/api';
import axios from 'axios';
import confetti from 'canvas-confetti';
import './SightWordDrill.css';

const DOLCH_WORDS = {
  'pre-primer': ['a','and','away','big','blue','can','come','down','find','for','funny','go','help','here','I','in','is','it','jump','little','look','make','me','my','not','one','play','red','run','said','see','the','three','to','two','up','we','where','yellow','you'],
  'primer': ['all','am','are','at','ate','be','black','brown','but','came','did','do','eat','four','get','good','have','he','into','like','must','new','no','now','on','our','out','please','pretty','ran','ride','saw','say','she','so','soon','that','there','they','this','too','under','want','was','well','went','what','white','who','will','with','yes'],
  'grade1': ['after','again','an','any','as','ask','by','could','every','fly','from','give','giving','had','has','her','him','his','how','just','know','let','live','may','of','old','once','open','over','put','round','some','stop','take','thank','them','think','walk','were','when'],
  'grade2': ['always','around','because','been','before','best','both','buy','call','cold','does',"don't",'fast','first','five','found','gave','goes','green','its','made','many','off','or','pull','read','right','sing','sit','sleep','tell','their','these','those','upon','us','use','very','wash','which','why','wish','work','would','write','your'],
  'grade3': ['about','better','bring','carry','clean','cut','done','draw','drink','eight','fall','far','full','got','grow','hold','hot','hurt','if','keep','kind','laugh','light','long','much','myself','never','only','own','pick','seven','shall','show','six','small','start','ten','today','together','try','warm'],
};

const WORDS_PER_SESSION = 15;

function applySM2(quality, easeFactor, interval, repetitions) {
  let newEF = easeFactor;
  let newInterval = interval;
  let newRep = repetitions;
  if (quality < 3) {
    newRep = 0; newInterval = 1;
  } else {
    newRep += 1;
    if (newRep === 1) newInterval = 1;
    else if (newRep === 2) newInterval = 6;
    else newInterval = Math.round(interval * easeFactor);
    newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;
  }
  return { easeFactor: newEF, interval: newInterval, repetitions: newRep };
}

function pickWords(level) {
  const pool = [...(DOLCH_WORDS[level] || [])];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, WORDS_PER_SESSION);
}

export default function SightWordDrill() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const username = localStorage.getItem('username');

  const [phase, setPhase] = useState('setup'); // setup | drill | done
  const [level, setLevel] = useState('pre-primer');
  const [wordQueue, setWordQueue] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState([]); // { word, quality, correct }
  const [wordVisible, setWordVisible] = useState(true);

  const cardStyle = getCardStyle(emotion);

  // Speak word when it changes during drill
  useEffect(() => {
    if (phase !== 'drill' || !wordQueue[currentIdx]) return;
    const t = setTimeout(() => {
      SpeechService.speak(wordQueue[currentIdx], { rate: 0.8 });
    }, 100);
    return () => clearTimeout(t);
  }, [currentIdx, wordQueue, phase]);

  const startDrill = useCallback(() => {
    const words = pickWords(level);
    setWordQueue(words);
    setCurrentIdx(0);
    setResults([]);
    setWordVisible(true);
    setPhase('drill');
  }, [level]);

  const handleResponse = useCallback((quality) => {
    const word = wordQueue[currentIdx];
    const correct = quality >= 4;
    const result = { word, quality, correct };

    // Fire-and-forget to backend
    axios.post(`${API_BASE}/api/sight-words/response`, {
      word,
      list: 'dolch',
      level,
      quality,
      username,
    }).catch(() => {});

    const sm2 = applySM2(quality, 2.5, 1, 0);
    void sm2; // SM-2 computed; could be persisted with more backend support

    const newResults = [...results, result];

    if (currentIdx + 1 >= wordQueue.length) {
      // Done with session
      setResults(newResults);
      setPhase('done');
      confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
    } else {
      // Fade out, advance, fade in
      setWordVisible(false);
      setTimeout(() => {
        setResults(newResults);
        setCurrentIdx(i => i + 1);
        setWordVisible(true);
      }, 300);
    }
  }, [currentIdx, wordQueue, results, level, username]);

  const replayWord = useCallback(() => {
    if (wordQueue[currentIdx]) {
      SpeechService.speak(wordQueue[currentIdx], { rate: 0.8 });
    }
  }, [currentIdx, wordQueue]);

  // ── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <GameShell title="Sight Word Drill" emotion={emotion} confidence={confidence}>
        <div className="swd-container">
          <div className="gs-card" style={cardStyle}>
            <h1 className="gs-card__title">Sight Word Drill 📚</h1>
            <p className="swd-instruction">
              Practice high-frequency words to boost your reading speed!
            </p>
            <div className="swd-setup-row">
              <label htmlFor="swd-level" className="swd-label">Choose level:</label>
              <select
                id="swd-level"
                className="swd-select"
                value={level}
                onChange={e => setLevel(e.target.value)}
                aria-label="Select Dolch word level"
              >
                {Object.keys(DOLCH_WORDS).map(l => (
                  <option key={l} value={l}>
                    {l.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <p className="swd-wordcount">
              {DOLCH_WORDS[level].length} words in this list — you'll practice {WORDS_PER_SESSION}
            </p>
            <button
              className="gs-btn gs-btn--primary"
              onClick={startDrill}
              aria-label="Start sight word practice"
            >
              Start Practice ▶
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
    const correctCount = results.filter(r => r.correct).length;
    const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
    const needMore = results.filter(r => !r.correct).map(r => r.word);

    return (
      <GameShell title="Sight Word Drill" emotion={emotion} confidence={confidence}>
        <div className="swd-container">
          <div className="gs-card" style={cardStyle}>
            <div className="gs-complete">
              <span className="gs-complete__trophy">🎉</span>
              <h2 className="gs-complete__heading">Great practice!</h2>
              <p className="gs-complete__score">Words practiced: <strong>{results.length}</strong></p>
              <p className="gs-complete__score">Got it: <strong>{correctCount}</strong></p>
              <p className="gs-complete__score">Accuracy: <strong>{accuracy}%</strong></p>
              {needMore.length > 0 && (
                <div className="swd-need-more">
                  <p className="swd-need-more__title">Keep practicing these words:</p>
                  <div className="swd-need-more__words">
                    {needMore.map(w => (
                      <span key={w} className="swd-chip">{w}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="swd-action-row">
                <button
                  className="gs-btn gs-btn--primary"
                  onClick={startDrill}
                  aria-label="Practice this level again"
                >
                  Practice Again
                </button>
                <button
                  className="gs-btn gs-btn--ghost"
                  onClick={() => setPhase('setup')}
                  aria-label="Change level"
                >
                  Change Level
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

  // ── Drill phase ─────────────────────────────────────────────────────────────
  const currentWord = wordQueue[currentIdx];
  return (
    <GameShell title="Sight Word Drill" emotion={emotion} confidence={confidence}>
      <div className="swd-container">
        <div className="gs-card" style={cardStyle}>
          <p className="swd-progress">
            Word {currentIdx + 1} of {wordQueue.length}
          </p>
          <div className="swd-word-area">
            <span
              className="swd-word"
              style={{ opacity: wordVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}
            >
              {currentWord}
            </span>
            <button
              className="gs-btn gs-btn--ghost swd-replay-btn"
              onClick={replayWord}
              aria-label="Replay the word aloud"
              title="Hear the word again"
            >
              🔊
            </button>
          </div>
          <div className="swd-action-row">
            <button
              className="gs-btn gs-btn--success"
              onClick={() => handleResponse(5)}
              aria-label="I know this word"
            >
              ✅ Got it!
            </button>
            <button
              className="gs-btn gs-btn--warning"
              onClick={() => handleResponse(3)}
              aria-label="I almost knew this word"
            >
              🤔 Almost
            </button>
            <button
              className="gs-btn gs-btn--ghost"
              onClick={() => handleResponse(1)}
              aria-label="I need more practice with this word"
            >
              ❌ Need more
            </button>
          </div>
        </div>
      </div>
      <video ref={videoRef} autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </GameShell>
  );
}
