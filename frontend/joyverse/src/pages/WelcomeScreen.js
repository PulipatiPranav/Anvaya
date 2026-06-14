import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import TTSButton from "../components/TTSButton";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import "./WelcomeScreen.css";
import { API_BASE } from "../config/api";

const MOODS = [
  { key: "happy",   label: "Happy",   icon: "/images/happy.png",   color: "#afe9b8", message: "Yay! You're feeling great! Keep smiling!",              emotion: "Happy"   },
  { key: "smile",   label: "Smiley",  icon: "/images/smile.png",   color: "#f9d2af", message: "Nice! A smile makes everything better.",                   emotion: "Happy"   },
  { key: "neutral", label: "Okay",    icon: "/images/neutral.png", color: "#f8f09f", message: "That's okay! Let's make your day better.",                 emotion: "Neutral" },
  { key: "sad",     label: "Sad",     icon: "/images/sad.png",     color: "#7981fa", message: "Oh no! Big hugs coming your way.",                         emotion: "Sad"     },
  { key: "angry",   label: "Angry",   icon: "/images/angry.png",   color: "#f7a0a0", message: "It's okay to feel angry. Take deep breaths.",              emotion: "Angry"   },
];

const HOW_ARE_YOU = "How are you feeling today?";

export default function WelcomeScreen() {
  const [username,     setUsername]     = useState("");
  const [selectedMood, setSelectedMood] = useState(null);
  const [message,      setMessage]      = useState("");
  const [todaySession, setTodaySession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username") || "Guest";
    setUsername(storedUsername);

    // Restore previously chosen mood and apply its background
    const saved = localStorage.getItem("selectedEmotion");
    if (saved) {
      const found = MOODS.find(m => m.key === saved);
      if (found) {
        setSelectedMood(found.key);
        setMessage(found.message);
        applyEmotionTheme(found.emotion);
      }
    } else {
      applyEmotionTheme("Neutral");
    }

    // Fetch today's assigned session (non-blocking)
    if (storedUsername && storedUsername !== "Guest") {
      const today = new Date().toISOString().slice(0, 10);
      axios
        .get(`${API_BASE}/api/assigned-sessions?childUsername=${storedUsername}&date=${today}`)
        .then(r => { if (r.data?.length > 0) setTodaySession(r.data[0]); })
        .catch(() => {});
    }
  }, []);

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood.key);
    setMessage(mood.message);
    localStorage.setItem("selectedEmotion", mood.key);
    applyEmotionTheme(mood.emotion);
  };

  const welcomeStr = `Welcome back, ${username}!`;

  return (
    <div className="welcomescreen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="header">
        <div className="welcometext">
          <h1 className="welcome-to-joyverse-container">
            <span className="welcome-to-joyverse">{welcomeStr}</span>
          </h1>
          <div className="lets-play-and">
            <span>Let's play and learn together!</span>
            <TTSButton text={`${welcomeStr} Let's play and learn together!`} size="sm" label="Read welcome aloud" />
          </div>
        </div>
      </section>

      {/* ── Mood check-in ──────────────────────────────────────────────────── */}
      <section className="emojiselectorcontainer">
        <div className="emojiselector">
          <div className="how-are-you">
            <h2 className="how-are-you-text">{HOW_ARE_YOU}</h2>
            <TTSButton text={HOW_ARE_YOU} size="sm" label="Read question aloud" />
          </div>

          <div className="emojibuttons">
            {MOODS.map(mood => (
              <button
                key={mood.key}
                className={`mood-card ${selectedMood === mood.key ? "mood-card--selected" : ""}`}
                style={{ "--mood-color": mood.color }}
                onClick={() => handleMoodSelect(mood)}
                aria-pressed={selectedMood === mood.key}
                aria-label={`I'm feeling ${mood.label}`}
              >
                <img className="mood-icon" alt={mood.label} src={mood.icon} />
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
        <div className="welcome-message-box">
          <span>{message}</span>
          <TTSButton text={message} size="sm" label="Read message aloud" />
        </div>
      )}

      {/* ── Today's Session panel ──────────────────────────────────────────── */}
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
        onClick={() => selectedMood && navigate("/games")}
        disabled={!selectedMood}
        aria-disabled={!selectedMood}
      >
        <div className="startplayingtext">
          <div className="start-playing">
            {selectedMood ? "🎮 Start Playing!" : "Pick a mood first"}
          </div>
        </div>
      </button>

      {/* ── Achievements link ───────────────────────────────────────────────── */}
      <button
        className="welcome-achievements-btn"
        onClick={() => navigate("/achievements")}
        aria-label="View my achievements and badges"
      >
        🏆 My Achievements
      </button>

    </div>
  );
}
