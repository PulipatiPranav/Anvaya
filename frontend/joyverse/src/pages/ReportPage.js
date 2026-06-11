import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ReportPage.css';
import { LoadingState, ErrorBanner } from '../components/LoadingState';
import { API_BASE } from '../config/api';

const MOOD_COLORS = {
  happy:   { bg: '#dcfce7', color: '#166534' },
  smile:   { bg: '#fef9c3', color: '#854d0e' },
  neutral: { bg: '#f3f4f6', color: '#374151' },
  sad:     { bg: '#dbeafe', color: '#1e40af' },
  angry:   { bg: '#fee2e2', color: '#991b1b' },
};

const PAIR_LABELS = { bd: 'b/d', pq: 'p/q', mw: 'm/w', nu: 'n/u' };

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportPage() {
  const { childUsername } = useParams();
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/api/reports/${childUsername}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load report data. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [childUsername]);

  if (loading) return <div className="report-container"><LoadingState label="Loading report…" /></div>;
  if (error)   return <div className="report-container"><ErrorBanner message={error} /></div>;
  if (!data)   return null;

  const { summary, readingProgress, phonemeTrend, ranTrend, pairAccuracy } = data;

  return (
    <div className="report-container">
      {/* Toolbar — hidden during print */}
      <div className="report-toolbar">
        <button className="report-btn--back" onClick={() => navigate(-1)}>Back</button>
        <button className="report-btn--print" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      {/* Header */}
      <div className="report-header">
        <div>
          <h1 className="report-title">JoyVerse Clinical Report</h1>
          <p style={{ margin: '4px 0 0', fontSize: '1rem', color: '#4338ca', fontWeight: 700 }}>
            {childUsername}
          </p>
        </div>
        <div className="report-meta">
          <div>Generated: {fmt(data.generatedAt)}</div>
          <div>Total sessions: {summary.totalSessions}</div>
        </div>
      </div>

      {/* Summary */}
      <section className="report-section">
        <h2 className="report-section-title">Performance Summary</h2>
        <div className="report-summary-grid">
          <div className="report-stat-card">
            <div className="report-stat-val">
              {summary.phonemeAvgAccuracy != null ? `${summary.phonemeAvgAccuracy}%` : '—'}
            </div>
            <div className="report-stat-lbl">Phoneme Avg Accuracy</div>
          </div>
          <div className="report-stat-card">
            <div className="report-stat-val">
              {summary.letterSoundAvgAccuracy != null ? `${summary.letterSoundAvgAccuracy}%` : '—'}
            </div>
            <div className="report-stat-lbl">Letter Sound Avg Accuracy</div>
          </div>
          <div className="report-stat-card">
            <div className="report-stat-val">
              {summary.latestRANItemsPerMin != null ? summary.latestRANItemsPerMin : '—'}
            </div>
            <div className="report-stat-lbl">Latest RAN (items/min)</div>
          </div>
          <div className="report-stat-card">
            <div className="report-stat-val">
              {summary.latestWMScore != null ? summary.latestWMScore : '—'}
            </div>
            <div className="report-stat-lbl">Latest WM Score</div>
          </div>
          <div className="report-stat-card" style={{ gridColumn: 'span 2' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9rem', color: '#374151' }}>Mood Distribution</div>
            <div className="report-mood-row" style={{ justifyContent: 'center' }}>
              {Object.entries(summary.moodCounts || {}).map(([mood, count]) => (
                <span
                  key={mood}
                  className="report-mood-chip"
                  style={{ background: (MOOD_COLORS[mood] || { bg: '#f3f4f6' }).bg, color: (MOOD_COLORS[mood] || { color: '#374151' }).color }}
                >
                  {mood}: {count}
                </span>
              ))}
              {!Object.keys(summary.moodCounts || {}).length && <span style={{ opacity: 0.5 }}>No mood data</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Reading Progression */}
      <section className="report-section">
        <h2 className="report-section-title">Reading Level Progression</h2>
        <div className="report-level-badge">{readingProgress.currentLevel}</div>
        {readingProgress.therapistOverride && (
          <p style={{ fontSize: '0.85rem', color: '#7c3aed', background: '#ede9fe', borderRadius: 8, padding: '4px 12px', display: 'inline-block', marginLeft: 10 }}>
            Therapist Override Active
          </p>
        )}
        {readingProgress.levelHistory && readingProgress.levelHistory.length > 0 && (
          <div className="report-level-history">
            {readingProgress.levelHistory.map((h, i) => (
              <div key={i} className="report-level-history-row">
                <span style={{ fontWeight: 700 }}>{h.fromLevel} → {h.toLevel}</span>
                <span style={{ color: '#6b7280' }}>{fmt(h.advancedAt)}</span>
                <span style={{ background: h.advancedBy === 'therapist' ? '#fef3c7' : '#d1fae5', borderRadius: 6, padding: '1px 8px', fontSize: '0.8rem' }}>
                  {h.advancedBy}
                </span>
                {h.note && <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>{h.note}</span>}
              </div>
            ))}
          </div>
        )}
        {(!readingProgress.levelHistory || !readingProgress.levelHistory.length) && (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 8 }}>No level changes yet.</p>
        )}
      </section>

      {/* Phoneme Accuracy Trend */}
      {phonemeTrend && phonemeTrend.length > 0 && (
        <section className="report-section">
          <h2 className="report-section-title">Phoneme Accuracy Trend (last 10 sessions)</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Game</th>
                <th>Level</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {phonemeTrend.map((pt, i) => (
                <tr key={i}>
                  <td>{fmt(pt.date)}</td>
                  <td>{pt.game === 'phonemetap' ? 'Phoneme Tap' : 'Letter Sound'}</td>
                  <td>{pt.level || '—'}</td>
                  <td style={{ fontWeight: 700, color: pt.accuracy >= 70 ? '#166534' : '#991b1b' }}>{pt.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* RAN Trend */}
      {ranTrend && ranTrend.length > 0 && (
        <section className="report-section">
          <h2 className="report-section-title">Rapid Automatized Naming Trend</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Items / min</th>
              </tr>
            </thead>
            <tbody>
              {ranTrend.map((rt, i) => (
                <tr key={i}>
                  <td>{fmt(rt.date)}</td>
                  <td>{rt.category}</td>
                  <td style={{ fontWeight: 700, color: '#065f46' }}>{rt.itemsPerMinute ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Confusable Letter Pair Accuracy */}
      {pairAccuracy && (
        <section className="report-section">
          <h2 className="report-section-title">Letter Confusion Profile (latest session)</h2>
          <div className="report-pair-row">
            {Object.entries(pairAccuracy).map(([pair, pct]) => (
              <span
                key={pair}
                className="report-pair-chip"
                style={{
                  background: pct >= 80 ? '#dcfce7' : '#fee2e2',
                  borderColor: pct >= 80 ? '#22c55e' : '#ef4444',
                  color: pct >= 80 ? '#166534' : '#991b1b',
                }}
              >
                {PAIR_LABELS[pair] || pair}: {pct}%
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
        JoyVerse Dyslexia Intervention Platform &mdash; Confidential Clinical Report
      </div>
    </div>
  );
}
