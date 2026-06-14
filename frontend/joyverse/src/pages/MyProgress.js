import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { logout } from '../utils/logout';
import './MyProgress.css';

// Tiny inline sparkline — no charting dependency, friendly for small screens.
function Sparkline({ series, color }) {
  if (!series || series.length < 2) return null;
  const vals = series.map(s => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 120, H = 36, pad = 3;
  const pts = series.map((s, i) => {
    const x = pad + (i / (series.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((s.value - min) / range) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="mp-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SKILL_META = {
  phonics:       { title: 'Phonics', icon: '🔤', color: '#6366f1' },
  fluency:       { title: 'Reading Speed', icon: '📖', color: '#10b981' },
  rapidNaming:   { title: 'Quick Naming', icon: '⚡', color: '#f59e0b' },
  workingMemory: { title: 'Memory', icon: '🧠', color: '#ec4899' },
};

function Delta({ deltaPct }) {
  if (deltaPct == null || deltaPct === 0) return <span className="mp-delta mp-delta--flat">—</span>;
  const up = deltaPct > 0;
  return (
    <span className={`mp-delta ${up ? 'mp-delta--up' : 'mp-delta--down'}`}>
      {up ? '▲' : '▼'} {Math.abs(deltaPct)}%
    </span>
  );
}

export default function MyProgress() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | error | empty

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/progress/${encodeURIComponent(username)}`);
        if (!alive) return;
        setData(res.data);
        setState(res.data.summary.totalSessions === 0 ? 'empty' : 'ok');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => { alive = false; };
  }, [username]);

  return (
    <div className="mp-page">
      <div className="mp-topbar">
        <button className="mp-back" onClick={() => navigate('/games')} aria-label="Back to games">
          ← Games
        </button>
        <button className="mp-logout" onClick={logout} aria-label="Log out">🚪 Logout</button>
      </div>

      <h1 className="mp-title">My Progress 🌟</h1>

      {state === 'loading' && (
        <div className="mp-skeleton" aria-label="Loading your progress" aria-busy="true">
          <div className="skeleton mp-skel-streak" />
          <div className="mp-skel-grid">
            <div className="skeleton mp-skel-card" />
            <div className="skeleton mp-skel-card" />
            <div className="skeleton mp-skel-card" />
            <div className="skeleton mp-skel-card" />
          </div>
        </div>
      )}
      {state === 'error' && <p className="mp-msg">Couldn't load your progress right now. Try again soon!</p>}

      {state === 'empty' && (
        <div className="mp-empty">
          <div className="mp-empty-icon">🚀</div>
          <p>Play a few games and your progress will show up right here — watch yourself grow!</p>
          <button className="mp-cta" onClick={() => navigate('/games')}>Start Playing</button>
        </div>
      )}

      {state === 'ok' && data && (
        <>
          {/* Streak + daily goal */}
          <div className="mp-streak-row">
            <div className="mp-streak-card">
              <span className="mp-streak-num">🔥 {data.summary.currentStreak}</span>
              <span className="mp-streak-lbl">day streak</span>
            </div>
            <div className="mp-goal-card">
              <span className="mp-goal-lbl">Today's goal</span>
              <div className="mp-goal-bar">
                <div
                  className="mp-goal-fill"
                  style={{ width: `${Math.min(100, (data.summary.sessionsToday / data.summary.dailyGoal) * 100)}%` }}
                />
              </div>
              <span className="mp-goal-txt">
                {Math.min(data.summary.sessionsToday, data.summary.dailyGoal)} / {data.summary.dailyGoal} games
                {data.summary.sessionsToday >= data.summary.dailyGoal ? ' ✅' : ''}
              </span>
            </div>
          </div>

          {/* Weekly highlights */}
          {data.weekly.highlights.length > 0 && (
            <div className="mp-highlights">
              <h2 className="mp-section-h">This week</h2>
              <div className="mp-chips">
                {data.weekly.highlights.map((h, i) => (
                  <span key={i} className="mp-chip">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Per-skill cards */}
          <h2 className="mp-section-h">My skills</h2>
          <div className="mp-skill-grid">
            {Object.entries(SKILL_META).map(([key, meta]) => {
              const s = data.skills[key];
              const hasData = s && s.count > 0;
              return (
                <div key={key} className="mp-skill-card" style={{ borderTopColor: meta.color }}>
                  <div className="mp-skill-head">
                    <span className="mp-skill-icon">{meta.icon}</span>
                    <span className="mp-skill-title">{meta.title}</span>
                  </div>
                  {hasData ? (
                    <>
                      <div className="mp-skill-val">
                        {s.latest}<span className="mp-skill-unit">{s.unit === '%' ? '%' : ` ${s.unit}`}</span>
                      </div>
                      <Sparkline series={s.series} color={meta.color} />
                      <div className="mp-skill-foot">
                        <Delta deltaPct={s.deltaPct} />
                        <span className="mp-skill-count">{s.count} sessions</span>
                      </div>
                    </>
                  ) : (
                    <p className="mp-skill-empty">Play to see your progress!</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recommended focus */}
          {data.recommendedFocus && (
            <div className="mp-focus">
              <h2 className="mp-section-h">Try next</h2>
              <div className="mp-focus-card">
                <div className="mp-focus-text">
                  <strong>{data.recommendedFocus.label}</strong>
                  <span>{data.recommendedFocus.reason}</span>
                </div>
                <button className="mp-focus-btn" onClick={() => navigate(data.recommendedFocus.route)}>
                  Let's go →
                </button>
              </div>
            </div>
          )}

          <div className="mp-summary-foot">
            {data.summary.totalSessions} games played · {data.summary.totalMinutes} min ·
            {' '}{data.summary.sightWordsMastered} sight words mastered
          </div>
        </>
      )}
    </div>
  );
}
