import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameShell from '../components/GameShell';
import useEmotionDetection from '../hooks/useEmotionDetection';
import { getCardStyle } from '../utils/EmotionThemeMap';
import SpeechService from '../services/SpeechService';
import { API_BASE } from '../config/api';
import axios from 'axios';
import './ReadingFluency.css';

const PASSAGES = [
  { id:'p1', title:'The Brave Dog', level:'Beginner', wordCount:42, wpm_target:40,
    text:'Max is a brave dog. He loves to run and play in the park. One day Max saw a small cat sitting in a tree. The cat was scared and could not come down. Max barked to call for help. A kind boy came and helped the cat. Max was happy. He is a good dog.' },
  { id:'p2', title:'The Magic Garden', level:'Beginner', wordCount:48, wpm_target:45,
    text:'Sara found a magic garden behind her house. The flowers were red and blue and yellow. She saw a tiny bird singing in a tall tree. Sara sat down in the soft green grass. She closed her eyes and listened to the bird sing. The garden made her feel calm and happy.' },
  { id:'p3', title:'A Big Storm', level:'Elementary', wordCount:55, wpm_target:55,
    text:'The sky turned dark and the wind began to blow. Tom and his sister ran inside the house. Their mom closed all the windows tight. Outside, rain fell hard on the roof. Lightning flashed and thunder boomed. Tom held his cat close. Soon the storm moved away. The sun came out and a rainbow appeared in the sky.' },
  { id:'p4', title:'The School Trip', level:'Elementary', wordCount:60, wpm_target:60,
    text:'Our class went on a trip to the science museum. We saw rocks from space called meteorites. My friend Jake touched a rock that was a million years old. We watched a film about planets and stars. The best part was seeing a real rocket in the big hall. I want to be an astronaut when I grow up.' },
  { id:'p5', title:'Learning to Swim', level:'Intermediate', wordCount:70, wpm_target:70,
    text:'Learning to swim was hard for Mia at first. She was afraid of the water and did not want to put her face in. Her coach was patient and kind. Every week they practised a little bit more. After a month Mia could float on her back. After two months she swam the whole length of the pool. She felt so proud. Now she loves swimming more than anything.' },
];

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^a-z']/g, '');
}

function getEncouragementMessage(wpm, target) {
  if (wpm >= target) return 'Outstanding! 🏆 You\'re reading brilliantly!';
  if (wpm >= target * 0.8) return 'Great work! 🌟 Keep practising!';
  return 'Good effort! 💪 Every practice makes you better!';
}

export default function ReadingFluency() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const username = localStorage.getItem('username');

  const [phase, setPhase] = useState('setup'); // setup | listen | reading | results
  const [selectedPassage, setSelectedPassage] = useState(PASSAGES[0]);

  // Listen mode state
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [listenDone, setListenDone] = useState(false);

  // Reading mode state
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedWords, setRecognizedWords] = useState(new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recognizedCount, setRecognizedCount] = useState(0);
  const [srSupported, setSrSupported] = useState(true);
  const timerRef = useRef(null);
  const timerStartRef = useRef(null);
  const recognitionRef = useRef(null);
  const passageWordsRef = useRef([]);

  // Results state
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [missedWordSet, setMissedWordSet] = useState(new Set());

  const cardStyle = getCardStyle(emotion);

  useEffect(() => {
    const hasSR = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    setSrSupported(hasSR);
  }, []);

  // Cancel TTS on unmount or passage change
  useEffect(() => {
    return () => { SpeechService.stop(); };
  }, [selectedPassage]);

  const passageWords = selectedPassage.text.split(/\s+/);

  // ── Listen mode: start TTS with synchronized word highlighting ─────────────
  const startListening = useCallback(() => {
    SpeechService.stop();
    setCurrentWordIdx(-1);
    setListenDone(false);

    SpeechService.speak(selectedPassage.text, {
      rate: 0.85,
      onWord: (idx) => setCurrentWordIdx(idx),
      onEnd: () => {
        setCurrentWordIdx(-1);
        setListenDone(true);
      },
    });
  }, [selectedPassage]);

  const stopListening = useCallback(() => {
    SpeechService.stop();
    setCurrentWordIdx(-1);
  }, []);

  // ── Reading mode: speech recognition ──────────────────────────────────────
  const startReading = useCallback(() => {
    if (!srSupported) return;

    passageWordsRef.current = passageWords.map(normalizeWord);
    setRecognizedWords(new Set());
    setRecognizedCount(0);
    setElapsedSeconds(0);
    timerStartRef.current = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      if (!timerStartRef.current) {
        timerStartRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsedSeconds(Math.round((Date.now() - timerStartRef.current) / 1000));
        }, 500);
      }

      let allTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        allTranscript += ' ' + event.results[i][0].transcript;
      }

      const spokenWords = allTranscript.trim().toLowerCase().split(/\s+/);
      const passageNorm = passageWordsRef.current;

      const matched = new Set();
      const usedSpoken = new Set();

      passageNorm.forEach((pw, pi) => {
        if (!pw) return;
        for (let si = 0; si < spokenWords.length; si++) {
          if (usedSpoken.has(si)) continue;
          const sw = normalizeWord(spokenWords[si]);
          if (sw === pw) {
            matched.add(pi);
            usedSpoken.add(si);
            break;
          }
        }
      });

      setRecognizedWords(matched);
      setRecognizedCount(matched.size);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('[ReadingFluency] SR error:', e.error);
      }
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [srSupported, passageWords]);

  const stopReading = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    // Compute results
    const elapsed = timerStartRef.current
      ? (Date.now() - timerStartRef.current) / 1000
      : elapsedSeconds || 1;

    const pWords = passageWords.map(normalizeWord);
    const totalWords = pWords.filter(Boolean).length;

    // Use the latest recognizedWords from ref via closure — capture via state setter
    setRecognizedWords(prev => {
      const matchedCount = prev.size;
      const calcWpm = elapsed > 0 ? Math.round((matchedCount / elapsed) * 60) : 0;
      const calcAcc = totalWords > 0 ? Math.round((matchedCount / totalWords) * 100) : 0;
      const missed = new Set(
        pWords.map((w, i) => (!w || prev.has(i)) ? null : i).filter(i => i !== null)
      );

      setWpm(calcWpm);
      setAccuracy(calcAcc);
      setMissedWordSet(missed);

      // Save to backend (fire and forget)
      axios.post(`${API_BASE}/api/fluency`, {
        username,
        passageId: selectedPassage.id,
        passageTitle: selectedPassage.title,
        wpm: calcWpm,
        accuracy: calcAcc,
        targetWpm: selectedPassage.wpm_target,
        mode: 'reading',
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      return prev;
    });

    setPhase('results');
  }, [elapsedSeconds, passageWords, username, selectedPassage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      SpeechService.stop();
    };
  }, []);

  // ── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <GameShell title="Reading Fluency" emotion={emotion} confidence={confidence}>
        <div className="rf-container">
          <div className="gs-card" style={cardStyle}>
            <h1 className="gs-card__title">Reading Fluency 📖</h1>
            <p className="rf-setup-intro">Choose a passage and a practice mode:</p>
            <div className="rf-passage-cards">
              {PASSAGES.map(p => (
                <div
                  key={p.id}
                  className={`rf-passage-card${selectedPassage.id === p.id ? ' rf-passage-card--selected' : ''}`}
                  onClick={() => setSelectedPassage(p)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select passage: ${p.title}`}
                  onKeyDown={e => e.key === 'Enter' && setSelectedPassage(p)}
                >
                  <span className="rf-pc-title">{p.title}</span>
                  <span className="rf-pc-level">{p.level}</span>
                  <span className="rf-pc-meta">{p.wordCount} words · Target: {p.wpm_target} WPM</span>
                </div>
              ))}
            </div>
            <div className="rf-mode-row">
              <button
                className="gs-btn gs-btn--primary"
                onClick={() => { setPhase('listen'); setListenDone(false); setCurrentWordIdx(-1); }}
                aria-label="Listen and follow along mode"
              >
                🎧 Listen &amp; Follow
              </button>
              <button
                className="gs-btn gs-btn--success"
                onClick={() => { setPhase('reading'); setRecognizedWords(new Set()); setRecognizedCount(0); }}
                aria-label="Read aloud with speech recognition mode"
              >
                🎤 Read Aloud
              </button>
            </div>
          </div>
        </div>
        <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── Listen mode ─────────────────────────────────────────────────────────────
  if (phase === 'listen') {
    return (
      <GameShell title="Reading Fluency" emotion={emotion} confidence={confidence}>
        <div className="rf-container">
          <div className="gs-card rf-listen-card" style={cardStyle}>
            <h2 className="rf-passage-heading">{selectedPassage.title}</h2>
            <div className="rf-passage">
              {passageWords.map((word, idx) => {
                let cls = 'rf-word';
                if (idx === currentWordIdx) cls += ' rf-word--active';
                else if (idx < currentWordIdx) cls += ' rf-word--done';
                return (
                  <span key={idx} className={cls}>{word} </span>
                );
              })}
            </div>
            <div className="rf-listen-controls">
              {!listenDone ? (
                <>
                  <button
                    className="gs-btn gs-btn--primary"
                    onClick={startListening}
                    aria-label="Play TTS reading of the passage"
                  >
                    ▶ Play
                  </button>
                  <button
                    className="gs-btn gs-btn--ghost"
                    onClick={stopListening}
                    aria-label="Stop TTS"
                  >
                    ⏹ Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="gs-btn gs-btn--ghost"
                    onClick={startListening}
                    aria-label="Replay passage"
                  >
                    🔁 Replay
                  </button>
                  <button
                    className="gs-btn gs-btn--success"
                    onClick={() => { stopListening(); setPhase('reading'); setRecognizedWords(new Set()); setRecognizedCount(0); }}
                    aria-label="Try reading the passage yourself"
                  >
                    Try Reading It →
                  </button>
                </>
              )}
              <button
                className="gs-btn gs-btn--ghost"
                onClick={() => { stopListening(); setPhase('setup'); }}
                aria-label="Back to passage selection"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
        <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── Reading mode ─────────────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <GameShell title="Reading Fluency" emotion={emotion} confidence={confidence}>
        <div className="rf-container">
          <div className="gs-card rf-listen-card" style={cardStyle}>
            <h2 className="rf-passage-heading">{selectedPassage.title}</h2>
            {!srSupported ? (
              <div className="rf-no-sr">
                <p>Speech recognition is not supported in your browser.</p>
                <p>You can still read the passage and use the timer to track your speed.</p>
              </div>
            ) : (
              <p className="rf-sr-hint">
                {isRecording ? '🔴 Recording... Read the passage aloud' : 'Press Start Reading when ready'}
              </p>
            )}
            {isRecording && (
              <div className="rf-timer-bar">
                <span className="rf-timer">⏱ {elapsedSeconds}s</span>
                <span className="rf-recog-count">{recognizedCount} words matched</span>
              </div>
            )}
            <div className="rf-passage">
              {passageWords.map((word, idx) => {
                let cls = 'rf-word';
                if (recognizedWords.has(idx)) cls += ' rf-word--correct';
                return (
                  <span key={idx} className={cls}>{word} </span>
                );
              })}
            </div>
            <div className="rf-listen-controls">
              {srSupported && !isRecording && (
                <button
                  className="gs-btn gs-btn--success"
                  onClick={startReading}
                  aria-label="Start reading aloud"
                >
                  🎤 Start Reading
                </button>
              )}
              {isRecording && (
                <button
                  className="gs-btn gs-btn--warning"
                  onClick={stopReading}
                  aria-label="Finish reading and see results"
                >
                  ⏹ Done
                </button>
              )}
              {!isRecording && (
                <button
                  className="gs-btn gs-btn--ghost"
                  onClick={() => setPhase('setup')}
                  aria-label="Back to passage selection"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
        </div>
        <video ref={videoRef} autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  // ── Results phase ─────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const msg = getEncouragementMessage(wpm, selectedPassage.wpm_target);
    return (
      <GameShell title="Reading Fluency" emotion={emotion} confidence={confidence}>
        <div className="rf-container">
          <div className="gs-card" style={cardStyle}>
            <div className="gs-complete">
              <div className="rf-results-stats">
                <div className="rf-stat-box">
                  <span className="rf-wpm-display">{wpm}</span>
                  <span className="rf-stat-label">Words Per Minute</span>
                </div>
                <div className="rf-stat-box">
                  <span className="rf-accuracy-display">{accuracy}%</span>
                  <span className="rf-stat-label">Accuracy</span>
                </div>
              </div>
              <p className="rf-encouragement">{msg}</p>
              <p className="rf-target-note">Target: {selectedPassage.wpm_target} WPM</p>

              {missedWordSet.size > 0 && (
                <div className="rf-missed-section">
                  <p className="rf-missed-label">Words to keep practicing:</p>
                  <div className="rf-passage rf-passage--review">
                    {passageWords.map((word, idx) => {
                      const norm = normalizeWord(word);
                      const missed = norm && missedWordSet.has(idx);
                      return (
                        <span key={idx} className={`rf-word${missed ? ' rf-word--missed' : ''}`}>
                          {word}{' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="swd-action-row">
                <button
                  className="gs-btn gs-btn--primary"
                  onClick={() => { setPhase('reading'); setRecognizedWords(new Set()); setRecognizedCount(0); setElapsedSeconds(0); }}
                  aria-label="Try reading again"
                >
                  Try Again
                </button>
                <button
                  className="gs-btn gs-btn--ghost"
                  onClick={() => setPhase('setup')}
                  aria-label="Choose a different passage"
                >
                  Choose Another
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

  return null;
}
