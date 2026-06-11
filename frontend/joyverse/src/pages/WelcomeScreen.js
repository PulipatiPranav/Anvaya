import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import TTSButton from "../components/TTSButton";
import "./WelcomeScreen.css";
import { API_BASE } from "../config/api";

/**
 * Mood definitions — each card shows an image, a label, a background colour,
 * and a supportive message that appears after selection.
 */
const MOODS = [
  {
    key:     "happy",
    label:   "Happy",
    icon:    "/images/happy.png",
    color:   "#afe9b8",
    message: "Yay! You're feeling great! Keep smiling! 😄",
  },
  {
    key:     "smile",
    label:   "Smiley",
    icon:    "/images/smile.png",
    color:   "#f9d2af",
    message: "Nice! A smile makes everything better 😊",
  },
  {
    key:     "neutral",
    label:   "Okay",
    icon:    "/images/neutral.png",
    color:   "#f8f09f",
    message: "That's okay! Let's make your day better 🙂",
  },
  {
    key:     "sad",
    label:   "Sad",
    icon:    "/images/sad.png",
    color:   "#7981fa",
    message: "Oh no! Big hugs coming your way 🤗",
  },
  {
    key:     "angry",
    label:   "Angry",
    icon:    "/images/angry.png",
    color:   "#f7a0a0",
    message: "It's okay to feel angry. Take deep breaths 🌈",
  },
];

const WELCOME_TEXT = (name) =>
  `Welcome to JoyVerse, ${name}! Let's play and learn together.`;
const HOW_ARE_YOU = "How are you feeling today?";

export default function WelcomeScreen() {
  const [username,      setUsername]      = useState("");
  const [selectedMood,  setSelectedMood]  = useState(null);
  const [message,       setMessage]       = useState("");
  const [todaySession,  setTodaySession]  = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUsername = localStorage.getItem("username") || "Guest";
    setUsername(storedUsername);
    // Pre-select any previously saved mood
    const saved = localStorage.getItem("selectedEmotion");
    if (saved) {
      const found = MOODS.find((m) => m.key === saved);
      if (found) {
        setSelectedMood(found.key);
        setMessage(found.message);
      }
    }
    // Fetch today's assigned session
    if (storedUsername && storedUsername !== "Guest") {
      const today = new Date().toISOString().slice(0, 10);
      axios.get(`${API_BASE}/api/assigned-sessions?childUsername=${storedUsername}&date=${today}`)
        .then(r => { if (r.data && r.data.length > 0) setTodaySession(r.data[0]); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "hidden"; };
  }, []);

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood.key);
    setMessage(mood.message);
    localStorage.setItem("selectedEmotion", mood.key);
  };

  const handleStartPlaying = () => {
    if (!selectedMood) return;
    navigate("/games");
  };

  const welcomeStr = WELCOME_TEXT(username);

  return (
    <div className="welcomescreen">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="header">
        <div className="welcometext">
          <h3 className="welcome-to-joyverse-container">
            <p className="welcome-to-joyverse">{welcomeStr}</p>
          </h3>
          <div className="lets-play-and tts-inline">
            Let's play and learn together :)
            <TTSButton text={welcomeStr} size="sm" label="Read welcome message aloud" />
          </div>
        </div>
      </section>

      {/* ── Mood check-in ──────────────────────────────────────────────────── */}
      <section className="emojiselectorcontainer">
        <div className="emojiselector">
          <div className="how-are-you tts-inline">
            <h2 className="how-are-you-text">{HOW_ARE_YOU}</h2>
            <TTSButton text={HOW_ARE_YOU} size="sm" label="Read question aloud" />
          </div>

          <div className="emojibuttons">
            {MOODS.map((mood) => (
              <button
                key={mood.key}
                className={`mood-card ${selectedMood === mood.key ? "mood-card--selected" : ""}`}
                style={{ "--mood-color": mood.color }}
                onClick={() => handleMoodSelect(mood)}
                aria-pressed={selectedMood === mood.key}
                aria-label={`I'm feeling ${mood.label}`}
              >
                <img
                  className="mood-icon"
                  alt={mood.label}
                  src={mood.icon}
                />
                <span className="mood-label">{mood.label}</span>
                {selectedMood === mood.key && (
                  <span className="mood-check" aria-hidden="true">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mood message ───────────────────────────────────────────────────── */}
      {message && (
        <div className="welcome-message-box tts-inline">
          <span>{message}</span>
          <TTSButton text={message} size="sm" label="Read message aloud" />
        </div>
      )}

      {/* ── Today's Session ────────────────────────────────────────────────── */}
      {todaySession && (
        <section className="todays-session-panel" aria-label="Today's assigned session">
          <h3>Today's Session</h3>
          {todaySession.instructions && (
            <p className="session-instructions">{todaySession.instructions}</p>
          )}
          <ol>
            {todaySession.games
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((g, i) => (
                <li key={i}>
                  {g.gameKey}
                  <span className="game-meta">{g.difficulty} · {g.durationMin} min</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* ── Start button ───────────────────────────────────────────────────── */}
      <button
        className={`startplayingbutton ${!selectedMood ? "startplayingbutton--disabled" : ""}`}
        onClick={handleStartPlaying}
        disabled={!selectedMood}
        aria-disabled={!selectedMood}
      >
        <div className="startplayingtext">
          <div className="start-playing">
            {selectedMood ? "Start Playing" : "Pick a mood first!"}
          </div>
        </div>
      </button>
    </div>
  );
}
