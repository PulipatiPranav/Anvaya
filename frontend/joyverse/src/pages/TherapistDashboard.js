import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';
import './TherapistDashboard.css';
import EmotionBarChart from '../components/EmotionBarChart';
import EmotionPercentageList from '../components/EmotionPercentageList';
import { LoadingState, ErrorBanner, EmptyState } from '../components/LoadingState';
import { API_BASE } from '../config/api';

const READING_LEVELS = ['pre-reader', 'CVC', 'Blends', 'Digraphs', 'VowelPatterns'];
const ASSIGNABLE_GAMES = [
  { key: 'phonemetap',       label: 'Phoneme Tap' },
  { key: 'lettersound',      label: 'Letter Sound Match' },
  { key: 'confusableletter', label: 'Letter Trainer' },
  { key: 'ran',              label: 'Rapid Naming' },
  { key: 'verbalmemory',     label: 'Sequence Memory' },
];


const EmotionTimelineChart = ({ expressions }) => {
  const series = expressions.map((exp, idx) => ({
    x: exp.expression,
    y: [
      new Date(exp.timestamp).getTime(),
      new Date(exp.timestamp).getTime() + 1000 // 1 second duration
    ]
  }));

  const options = {
    chart: {
      type: 'rangeBar',
      height: 150,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '60%'
      }
    },
    xaxis: {
      type: 'datetime',
      labels: { datetimeFormatter: { second: 'HH:mm:ss' } }
    },
    title: {
      text: 'Emotion Timeline',
      align: 'left',
      style: { fontSize: '14px' }
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <ReactApexChart options={options} series={[{ data: series }]} type="rangeBar" height={150} />
    </div>
  );
};

const TherapistDashboard = () => {
  const [children, setChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddChildForm, setShowAddChildForm] = useState(false);
  const [child, setChild] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedChildSessions, setSelectedChildSessions] = useState([]);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [phonemeTapSessions,     setPhonemeTapSessions]     = useState([]);
  const [letterSoundSessions,    setLetterSoundSessions]    = useState([]);
  const [confusableSessions,     setConfusableSessions]     = useState([]);
  const [ranSessions,            setRANSessions]            = useState([]);
  const [verbalMemorySessions,   setVerbalMemorySessions]   = useState([]);
  const [selectedUsername,       setSelectedUsername]       = useState('');
  const [analyticsData,          setAnalyticsData]          = useState(null);
  const [readingProgress,        setReadingProgress]        = useState(null);
  const [adaptationLogs,         setAdaptationLogs]         = useState([]);
  const [assignSessionChild,     setAssignSessionChild]     = useState(null);
  const [assignForm,             setAssignForm]             = useState({
    date: new Date().toISOString().slice(0, 10),
    selectedGames: [],
    instructions: '',
  });
  const [assignError,   setAssignError]   = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [overrideLevel, setOverrideLevel] = useState('');
  const [overrideNote,  setOverrideNote]  = useState('');
  const [overrideMsg,   setOverrideMsg]   = useState('');

  const therapistId = localStorage.getItem("therapistId");
  const navigate = useNavigate();
 useEffect(() => {
    // Enable scrolling when this page is open
    document.body.style.overflow = "auto";
  
    // When leaving this page, disable scrolling again
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, []);
  useEffect(() => {
    const fetchChildren = async () => {
      if (!therapistId) {
        setError('Therapist ID is missing. Please log in again.');
        setChildrenLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${API_BASE}/api/children`, {
          headers: { 'therapist-id': therapistId }
        });
        setChildren(response.data);
      } catch (err) {
        setError('Failed to fetch patient list. Please refresh the page.');
      } finally {
        setChildrenLoading(false);
      }
    };

    fetchChildren();
  }, [therapistId]);

  const handleViewDetails = async (username) => {
    setSelectedUsername(username);
    setShowSessionDetails(true);
    setSessionError('');
    try {
      const [sessionsRes, ptRes, lsRes, clRes, ranRes, vmRes] = await Promise.all([
        axios.get(`${API_BASE}/api/sessions?username=${username}`),
        axios.get(`/api/phoneme-tap?username=${username}`),
        axios.get(`/api/letter-sound?username=${username}`),
        axios.get(`/api/confusable-letter?username=${username}`),
        axios.get(`/api/ran?username=${username}`),
        axios.get(`/api/verbal-memory?username=${username}`),
      ]);
      setSelectedChildSessions(sessionsRes.data);
      setPhonemeTapSessions(ptRes.data);
      setLetterSoundSessions(lsRes.data);
      setConfusableSessions(clRes.data);
      setRANSessions(ranRes.data);
      setVerbalMemorySessions(vmRes.data);

      // Additional analytics + progression + adaptation
      try {
        const [analyticsRes, rpRes, alRes] = await Promise.all([
          axios.get(`/api/analytics/${username}`),
          axios.get(`/api/reading-progress/${username}`),
          axios.get(`/api/adaptation-log?username=${username}&limit=20`),
        ]);
        setAnalyticsData(analyticsRes.data);
        setReadingProgress(rpRes.data);
        setAdaptationLogs(alRes.data);
        setOverrideLevel(rpRes.data?.currentLevel || '');
      } catch {
        // non-critical — continue showing what we have
      }
    } catch (err) {
      setSessionError('Failed to fetch game sessions');
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage(""); // Reset success message

    if (!child.name || !child.username || !child.password) {
      setError("All fields are required.");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/api/children`, {
        ...child,
        therapistId,
      });

      setChildren(prev => [...prev, response.data]);

      setChild({ name: "", username: "", password: "" });
      setShowAddChildForm(false);
      setSuccessMessage("Child added successfully!"); // Show success message

      // Hide success message after 3 seconds
      setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  } catch (err) {
    setError(err.response?.data?.message || "Failed to add child.");
  }
  };

  const handleAssignSession = async (e) => {
    e.preventDefault();
    setAssignError('');
    setAssignSuccess('');
    if (!assignForm.selectedGames.length) {
      setAssignError('Select at least one game.');
      return;
    }
    try {
      const games = assignForm.selectedGames.map((key, idx) => ({
        gameKey: key, order: idx + 1, difficulty: assignForm[`diff_${key}`] || 'medium',
        durationMin: parseInt(assignForm[`dur_${key}`] || '10', 10),
      }));
      await axios.post('/api/assigned-sessions', {
        therapistId,
        childUsername: assignSessionChild,
        date: assignForm.date,
        games,
        instructions: assignForm.instructions,
      });
      setAssignSuccess('Session assigned successfully!');
      setTimeout(() => { setAssignSessionChild(null); setAssignSuccess(''); }, 2500);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign session.');
    }
  };

  const handleOverrideLevel = async (childUsername) => {
    setOverrideMsg('');
    if (!overrideLevel) return;
    try {
      await axios.patch(`/api/reading-progress/${childUsername}/override`, {
        level: overrideLevel, therapistId, note: overrideNote,
      });
      const rpRes = await axios.get(`/api/reading-progress/${childUsername}`);
      setReadingProgress(rpRes.data);
      setOverrideMsg('Level updated.');
    } catch (err) {
      setOverrideMsg(err.response?.data?.message || 'Override failed.');
    }
  };

  const handleCheckAdvancement = async (childUsername) => {
    setOverrideMsg('');
    try {
      const res = await axios.post(`/api/reading-progress/${childUsername}/check`);
      if (res.data.advanced) {
        setOverrideMsg(`Advanced to ${res.data.newLevel}! (avg accuracy ${res.data.avgAccuracy}%)`);
        const rpRes = await axios.get(`/api/reading-progress/${childUsername}`);
        setReadingProgress(rpRes.data);
      } else {
        const reasons = {
          insufficient_data: `Not enough data (${res.data.sessionsFound || 0} sessions found; need 3+)`,
          below_threshold: `Below threshold — avg accuracy ${res.data.avgAccuracy}% (need 85%)`,
          max_level: 'Already at highest level.',
          therapist_override: 'Auto-advancement locked by therapist override.',
        };
        setOverrideMsg(reasons[res.data.reason] || 'No change.');
      }
    } catch (err) {
      setOverrideMsg('Check failed.');
    }
  };

  const filteredChildren = children.filter(child =>
    (child.username && child.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (child.name && child.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  return (
    <div className="dashboard-container">
      <h2 className="welcome-therapist">Welcome back, Therapist!</h2>
      <h2 className="dashboard-title">Logged-in Children</h2>

      <input
        type="text"
        placeholder="Search by name or username…"
        className="search-bar"
        aria-label="Search patients by name or username"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <button
        onClick={() => setShowAddChildForm(!showAddChildForm)}
        className="add-child-btn"
      >
        {showAddChildForm ? 'Cancel' : 'Add Child'}
      </button>

      {showAddChildForm && (
        <div className="add-child-form-container">
          <h3 id="add-child-heading">Add Patient</h3>
          <form className="add-child-form" onSubmit={handleAddChild} aria-labelledby="add-child-heading">
            <label htmlFor="child-name" className="form-label">Full name</label>
            <input
              id="child-name"
              type="text"
              name="name"
              placeholder="e.g. Alex Johnson"
              className="form-input"
              value={child.name}
              onChange={(e) => setChild({ ...child, name: e.target.value })}
              required
              aria-required="true"
            />
            <label htmlFor="child-username" className="form-label">Username</label>
            <input
              id="child-username"
              type="text"
              name="username"
              placeholder="e.g. alex123"
              className="form-input"
              value={child.username}
              onChange={(e) => setChild({ ...child, username: e.target.value })}
              required
              aria-required="true"
              autoComplete="off"
            />
            <label htmlFor="child-password" className="form-label">Password</label>
            <input
              id="child-password"
              type="password"
              name="password"
              placeholder="Set a password"
              className="form-input"
              value={child.password}
              onChange={(e) => setChild({ ...child, password: e.target.value })}
              required
              aria-required="true"
              autoComplete="new-password"
            />
            <button type="submit" className="submit-btn">Add Patient</button>
          </form>
          {error && <p className="error-msg">{error}</p>}
          {successMessage && <p className="success-msg">{successMessage}</p>}
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {childrenLoading ? (
        <LoadingState label="Loading patients…" />
      ) : (
        <>
          {filteredChildren.length === 0 ? (
            searchTerm ? (
              <EmptyState icon="🔍" title="No results" description={`No patients match "${searchTerm}"`} />
            ) : (
              <EmptyState
                icon="👶"
                title="No patients yet"
                description="Add your first patient using the button above."
              />
            )
          ) : (
            <table className="custom-table" aria-label="Patient list">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Name</th>
                  <th scope="col">Username</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChildren.map((child, index) => (
                  <tr key={child._id}>
                    <td>{index + 1}</td>
                    <td>{child.name}</td>
                    <td>{child.username}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 6px' }}>
                      <button className="action-btn" onClick={() => handleViewDetails(child.username)}>
                        View Details
                      </button>
                      <button
                        className="action-btn"
                        style={{ background: '#6366f1', color: '#fff' }}
                        onClick={() => { setAssignSessionChild(child.username); setAssignError(''); setAssignSuccess(''); setAssignForm({ date: new Date().toISOString().slice(0,10), selectedGames: [], instructions: '' }); }}
                      >
                        Assign
                      </button>
                      <button
                        className="action-btn"
                        style={{ background: '#0f766e', color: '#fff' }}
                        onClick={() => navigate(`/report/${child.username}`)}
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ── Assign Session Panel ─────────────────────────────────────────── */}
      {assignSessionChild && (
        <div style={{ background: '#f0f4ff', border: '2px solid #6366f1', borderRadius: 18, padding: '24px 28px', margin: '20px 0', maxWidth: 680 }}>
          <h3 style={{ margin: '0 0 16px', color: '#312e81', fontSize: '1.1rem', fontWeight: 800 }}>
            Assign Session — {assignSessionChild}
          </h3>
          <form onSubmit={handleAssignSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Date:</label>
              <input
                type="date"
                value={assignForm.date}
                onChange={e => setAssignForm(f => ({ ...f, date: e.target.value }))}
                className="form-input"
                style={{ width: 'auto' }}
              />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 8px' }}>Games to include:</p>
              {ASSIGNABLE_GAMES.map(g => (
                <div key={g.key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 180, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={assignForm.selectedGames.includes(g.key)}
                      onChange={e => setAssignForm(f => ({
                        ...f,
                        selectedGames: e.target.checked
                          ? [...f.selectedGames, g.key]
                          : f.selectedGames.filter(k => k !== g.key),
                      }))}
                    />
                    <span style={{ fontWeight: 600 }}>{g.label}</span>
                  </label>
                  {assignForm.selectedGames.includes(g.key) && (
                    <>
                      <select
                        value={assignForm[`diff_${g.key}`] || 'medium'}
                        onChange={e => setAssignForm(f => ({ ...f, [`diff_${g.key}`]: e.target.value }))}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #c7d2fe', fontSize: '0.85rem' }}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <input
                        type="number"
                        min={1} max={60}
                        value={assignForm[`dur_${g.key}`] || '10'}
                        onChange={e => setAssignForm(f => ({ ...f, [`dur_${g.key}`]: e.target.value }))}
                        placeholder="min"
                        style={{ width: 60, padding: '3px 6px', borderRadius: 6, border: '1px solid #c7d2fe', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>min</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>Instructions (optional):</label>
              <textarea
                value={assignForm.instructions}
                onChange={e => setAssignForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder="e.g. Focus on b/d confusion today"
                rows={2}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #c7d2fe', fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            {assignError && <p style={{ color: '#991b1b', margin: 0, fontSize: '0.9rem' }}>{assignError}</p>}
            {assignSuccess && <p style={{ color: '#166534', margin: 0, fontSize: '0.9rem' }}>{assignSuccess}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="submit-btn">Assign Session</button>
              <button type="button" className="submit-btn" style={{ background: '#e5e7eb', color: '#374151' }} onClick={() => setAssignSessionChild(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showSessionDetails && (
        <div className="session-details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Game Sessions for {filteredChildren.find(c => c.username === selectedUsername)?.name}</h3>
            <button
              className="action-btn"
              style={{ background: '#0f766e', color: '#fff' }}
              onClick={() => navigate(`/report/${selectedUsername}`)}
            >
              Generate Report
            </button>
          </div>
          {sessionError && <p className="error-msg">{sessionError}</p>}

          {selectedChildSessions.map((session, index) => (
            <div key={session._id} className="session-block">
              <h3>Session {index + 1}: {session.gameName} ({session.difficulty})</h3>
              <p><strong>Start:</strong> {new Date(session.startTime).toLocaleString()}</p>
              <p><strong>End:</strong> {new Date(session.endTime).toLocaleString()}</p>
              <p><strong>Score:</strong> {session.score}</p>
              {session.moodAtStart && (
                <p>
                  <strong>Mood at start:</strong>{' '}
                  <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                    {session.moodAtStart}
                  </span>
                </p>
              )}
              {session.phonicsLevel && (
                <p>
                  <strong>Phonics level:</strong>{' '}
                  <span style={{ fontWeight: 600, color: '#1a4731', background: '#d1fae5', borderRadius: '8px', padding: '2px 10px' }}>
                    {session.phonicsLevel}
                  </span>
                </p>
              )}
              <EmotionTimelineChart expressions={session.expressions} />
              <EmotionBarChart expressions={session.expressions} />
              <EmotionPercentageList expressions={session.expressions} />
            </div>
          ))}

          {/* ── Phoneme Tap Analytics ─────────────────────────────── */}
          {phonemeTapSessions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#3730a3', borderBottom: '2px solid #e0e7ff', paddingBottom: '6px' }}>
                👂 Phoneme Tap Sessions ({phonemeTapSessions.length})
              </h3>
              {phonemeTapSessions.map((pt, i) => (
                <div key={pt._id} className="session-block" style={{ borderLeft: '4px solid #6366f1' }}>
                  <h4 style={{ margin: '0 0 8px' }}>Phoneme Tap #{i + 1} — {pt.phonicsLevel} / {pt.difficulty}</h4>
                  <p><strong>Date:</strong> {new Date(pt.createdAt || pt.startTime).toLocaleString()}</p>
                  <p><strong>Score:</strong> {pt.score} &nbsp;|&nbsp; <strong>Accuracy:</strong>{' '}
                    <span style={{ fontWeight: 700, color: pt.overallAccuracy >= 70 ? '#166534' : '#991b1b' }}>
                      {pt.overallAccuracy}%
                    </span>
                  </p>
                  {pt.moodAtStart && (
                    <p><strong>Mood at start:</strong>{' '}
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                        {pt.moodAtStart}
                      </span>
                    </p>
                  )}
                  {pt.wordResults && pt.wordResults.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Word-by-word results</summary>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: '#e0e7ff' }}>
                            <th style={{ padding: '4px 10px', textAlign: 'left' }}>Word</th>
                            <th style={{ padding: '4px 10px' }}>Expected</th>
                            <th style={{ padding: '4px 10px' }}>Taps</th>
                            <th style={{ padding: '4px 10px' }}>Accuracy</th>
                            <th style={{ padding: '4px 10px' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pt.wordResults.map((wr, j) => (
                            <tr key={j} style={{ background: wr.correct ? '#dcfce7' : '#fee2e2' }}>
                              <td style={{ padding: '4px 10px', fontWeight: 600 }}>{wr.word}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{wr.expectedPhonemes}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{wr.actualTaps}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{wr.accuracy}%</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{wr.correct ? '✅' : '❌'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Letter Sound Analytics ────────────────────────────── */}
          {letterSoundSessions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#065f46', borderBottom: '2px solid #d1fae5', paddingBottom: '6px' }}>
                🔤 Letter Sound Sessions ({letterSoundSessions.length})
              </h3>
              {letterSoundSessions.map((ls, i) => (
                <div key={ls._id} className="session-block" style={{ borderLeft: '4px solid #10b981' }}>
                  <h4 style={{ margin: '0 0 8px' }}>Letter Sound #{i + 1} — {ls.phonicsLevel} / {ls.difficulty}</h4>
                  <p><strong>Date:</strong> {new Date(ls.createdAt || ls.startTime).toLocaleString()}</p>
                  <p>
                    <strong>Score:</strong> {ls.score} &nbsp;|&nbsp;
                    <strong>Accuracy:</strong>{' '}
                    <span style={{ fontWeight: 700, color: ls.overallAccuracy >= 70 ? '#166534' : '#991b1b' }}>
                      {ls.overallAccuracy}%
                    </span>
                    &nbsp;|&nbsp;
                    <strong>Avg reaction:</strong> {ls.avgReactionTimeMs ? `${(ls.avgReactionTimeMs / 1000).toFixed(1)}s` : '—'}
                  </p>
                  {ls.moodAtStart && (
                    <p><strong>Mood at start:</strong>{' '}
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                        {ls.moodAtStart}
                      </span>
                    </p>
                  )}
                  {ls.questionResults && ls.questionResults.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Question-by-question results</summary>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: '#d1fae5' }}>
                            <th style={{ padding: '4px 10px', textAlign: 'left' }}>Letter/Pattern</th>
                            <th style={{ padding: '4px 10px' }}>Selected</th>
                            <th style={{ padding: '4px 10px' }}>Reaction</th>
                            <th style={{ padding: '4px 10px' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ls.questionResults.map((qr, j) => (
                            <tr key={j} style={{ background: qr.correct ? '#dcfce7' : '#fee2e2' }}>
                              <td style={{ padding: '4px 10px', fontWeight: 700, fontSize: '1.1rem' }}>{qr.letter}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{qr.selectedOption}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                                {qr.reactionTimeMs ? `${(qr.reactionTimeMs / 1000).toFixed(1)}s` : '—'}
                              </td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{qr.correct ? '✅' : '❌'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Confusable Letter Analytics ───────────────────── */}
          {confusableSessions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#3730a3', borderBottom: '2px solid #e0e7ff', paddingBottom: '6px' }}>
                🔡 Letter Trainer Sessions ({confusableSessions.length})
              </h3>
              {confusableSessions.map((cs, i) => {
                const pairAcc = cs.pairAccuracy
                  ? (cs.pairAccuracy instanceof Map
                      ? Object.fromEntries(cs.pairAccuracy)
                      : cs.pairAccuracy)
                  : {};
                const PAIR_LABELS = { bd: 'b/d', pq: 'p/q', mw: 'm/w', nu: 'n/u' };
                const PAIR_COLORS = { bd: '#e0e7ff', pq: '#fce7f3', mw: '#d1fae5', nu: '#fef3c7' };
                const worstPair = Object.entries(pairAcc).sort((a, b) => a[1] - b[1])[0];
                return (
                  <div key={cs._id} className="session-block" style={{ borderLeft: '4px solid #6366f1' }}>
                    <h4 style={{ margin: '0 0 8px' }}>
                      Letter Trainer #{i + 1} — {cs.difficulty}
                      {cs.focusPairs && cs.focusPairs.length < 4 && (
                        <span style={{ marginLeft: 8, fontSize: '0.85rem', fontWeight: 400 }}>
                          Pairs: {cs.focusPairs.map(p => PAIR_LABELS[p]).join(', ')}
                        </span>
                      )}
                    </h4>
                    <p><strong>Date:</strong> {new Date(cs.createdAt || cs.startTime).toLocaleString()}</p>
                    <p>
                      <strong>Score:</strong> {cs.score} &nbsp;|&nbsp;
                      <strong>Accuracy:</strong>{' '}
                      <span style={{ fontWeight: 700, color: cs.overallAccuracy >= 70 ? '#166534' : '#991b1b' }}>
                        {cs.overallAccuracy}%
                      </span>
                    </p>
                    {Object.keys(pairAcc).length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                        {Object.entries(pairAcc).map(([pair, pct]) => (
                          <span key={pair} style={{
                            background: PAIR_COLORS[pair] || '#eee',
                            border: `2px solid ${pct < 70 ? '#ef4444' : '#22c55e'}`,
                            borderRadius: 10,
                            padding: '3px 12px',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}>
                            {PAIR_LABELS[pair]}: <span style={{ color: pct < 70 ? '#991b1b' : '#166534' }}>{pct}%</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {worstPair && worstPair[1] < 80 && (
                      <p style={{ fontSize: '0.85rem', color: '#7c3aed', background: '#ede9fe', borderRadius: 8, padding: '4px 12px', display: 'inline-block' }}>
                        Needs practice: {PAIR_LABELS[worstPair[0]]} ({worstPair[1]}%)
                      </p>
                    )}
                    {cs.moodAtStart && (
                      <p><strong>Mood at start:</strong>{' '}
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                          {cs.moodAtStart}
                        </span>
                      </p>
                    )}
                    {cs.events && cs.events.length > 0 && (
                      <details style={{ marginTop: '8px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Question-by-question results ({cs.events.length})</summary>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#e0e7ff' }}>
                              <th style={{ padding: '4px 10px', textAlign: 'left' }}>Question</th>
                              <th style={{ padding: '4px 10px' }}>Pair</th>
                              <th style={{ padding: '4px 10px' }}>Selected</th>
                              <th style={{ padding: '4px 10px' }}>Reaction</th>
                              <th style={{ padding: '4px 10px' }}>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cs.events.map((ev, j) => (
                              <tr key={j} style={{ background: ev.correct ? '#dcfce7' : '#fee2e2' }}>
                                <td style={{ padding: '4px 10px', fontWeight: 700, fontSize: '1.1rem' }}>{ev.question}</td>
                                <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                                  <span style={{ background: PAIR_COLORS[ev.pair] || '#eee', borderRadius: 6, padding: '1px 8px', fontSize: '0.8rem' }}>
                                    {PAIR_LABELS[ev.pair] || ev.pair}
                                  </span>
                                </td>
                                <td style={{ padding: '4px 10px', textAlign: 'center', fontWeight: 700 }}>{ev.selected}</td>
                                <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                                  {ev.reactionTimeMs ? `${(ev.reactionTimeMs / 1000).toFixed(1)}s` : '—'}
                                </td>
                                <td style={{ padding: '4px 10px', textAlign: 'center' }}>{ev.correct ? '✅' : '❌'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RAN Analytics ─────────────────────────────────── */}
          {ranSessions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#065f46', borderBottom: '2px solid #a7f3d0', paddingBottom: '6px' }}>
                ⚡ Rapid Naming Sessions ({ranSessions.length})
              </h3>
              {ranSessions.map((rs, i) => (
                <div key={rs._id} className="session-block" style={{ borderLeft: '4px solid #10b981' }}>
                  <h4 style={{ margin: '0 0 8px' }}>
                    RAN #{i + 1} — {rs.category} / {rs.difficulty}
                  </h4>
                  <p><strong>Date:</strong> {new Date(rs.createdAt || rs.startTime).toLocaleString()}</p>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0' }}>
                    <span><strong>Time:</strong> {rs.totalTimeMs ? `${(rs.totalTimeMs / 1000).toFixed(1)}s` : '—'}</span>
                    <span><strong>Items/min:</strong>{' '}
                      <span style={{ fontWeight: 700, color: '#065f46' }}>{rs.itemsPerMinute ?? '—'}</span>
                    </span>
                    <span><strong>Accuracy:</strong>{' '}
                      <span style={{ fontWeight: 700, color: (rs.accuracy ?? 0) >= 70 ? '#166534' : '#991b1b' }}>
                        {rs.accuracy ?? 0}%
                      </span>
                    </span>
                    <span><strong>Score:</strong> {rs.score ?? rs.correctItems * 10}</span>
                  </div>
                  {rs.moodAtStart && (
                    <p><strong>Mood at start:</strong>{' '}
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                        {rs.moodAtStart}
                      </span>
                    </p>
                  )}
                  {rs.items && rs.items.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Item-by-item results ({rs.items.length})</summary>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ background: '#a7f3d0' }}>
                            <th style={{ padding: '4px 10px', textAlign: 'left' }}>Item</th>
                            <th style={{ padding: '4px 10px' }}>Selected</th>
                            <th style={{ padding: '4px 10px' }}>Time</th>
                            <th style={{ padding: '4px 10px' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rs.items.map((it, j) => (
                            <tr key={j} style={{ background: it.correct ? '#dcfce7' : '#fee2e2' }}>
                              <td style={{ padding: '4px 10px', fontWeight: 800, fontSize: '1.1rem' }}>{it.item}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{it.selected}</td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                                {it.timeMs ? `${(it.timeMs / 1000).toFixed(2)}s` : '—'}
                              </td>
                              <td style={{ padding: '4px 10px', textAlign: 'center' }}>{it.correct ? '✅' : '❌'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Verbal Memory Analytics ────────────────────────── */}
          {verbalMemorySessions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#312e81', borderBottom: '2px solid #c7d2fe', paddingBottom: '6px' }}>
                🧠 Verbal Sequence Memory Sessions ({verbalMemorySessions.length})
              </h3>
              {verbalMemorySessions.map((vm, i) => (
                <div key={vm._id} className="session-block" style={{ borderLeft: '4px solid #6366f1' }}>
                  <h4 style={{ margin: '0 0 8px' }}>
                    Sequence Memory #{i + 1} — {vm.mode} / {vm.difficulty}
                  </h4>
                  <p><strong>Date:</strong> {new Date(vm.createdAt || vm.startTime).toLocaleString()}</p>

                  {/* Key metrics row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0', alignItems: 'stretch' }}>
                    <div style={{ background: 'linear-gradient(135deg,#e0e7ff,#ede9fe)', borderRadius: 12, padding: '10px 18px', border: '2px solid #6366f1', textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4338ca', lineHeight: 1 }}>
                        {vm.workingMemoryScore ?? '—'}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 3 }}>WM Score</div>
                    </div>
                    <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '10px 14px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#312e81' }}>{vm.maxSequenceLength ?? '—'}</div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 3 }}>Max Length</div>
                    </div>
                    <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '10px 14px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (vm.overallAccuracy ?? 0) >= 70 ? '#166534' : '#991b1b' }}>
                        {vm.overallAccuracy ?? 0}%
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 3 }}>Accuracy</div>
                    </div>
                    <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '10px 14px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#312e81' }}>
                        {vm.rounds ? vm.rounds.filter(r => r.correct).length : '—'}/{vm.rounds ? vm.rounds.length : '—'}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 3 }}>Perfect Rounds</div>
                    </div>
                  </div>

                  {vm.moodAtStart && (
                    <p><strong>Mood at start:</strong>{' '}
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#4a5568', background: '#eef0ff', borderRadius: '8px', padding: '2px 10px' }}>
                        {vm.moodAtStart}
                      </span>
                    </p>
                  )}

                  {vm.rounds && vm.rounds.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Round-by-round results ({vm.rounds.length} rounds)
                      </summary>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.87rem' }}>
                        <thead>
                          <tr style={{ background: '#e0e7ff' }}>
                            <th style={{ padding: '4px 8px' }}>Round</th>
                            <th style={{ padding: '4px 8px' }}>Length</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Presented</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Recalled</th>
                            <th style={{ padding: '4px 8px' }}>Accuracy</th>
                            <th style={{ padding: '4px 8px' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vm.rounds.map((r, j) => (
                            <tr key={j} style={{ background: r.correct ? '#dcfce7' : '#fee2e2' }}>
                              <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>#{r.round}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.sequenceLength}</td>
                              <td style={{ padding: '4px 8px', fontStyle: 'italic' }}>
                                {r.presented ? r.presented.join(' → ') : '—'}
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                {r.recalled ? r.recalled.map((item, k) => (
                                  <span key={k} style={{
                                    color: r.presented && r.presented[k] === item ? '#166534' : '#991b1b',
                                    fontWeight: 700,
                                    marginRight: 4,
                                  }}>{item}</span>
                                )) : '—'}
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>
                                {r.positionAccuracy}%
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.correct ? '✅' : '❌'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Reading Level Progression ─────────────────────── */}
          {readingProgress && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#065f46', borderBottom: '2px solid #a7f3d0', paddingBottom: '6px' }}>
                📚 Reading Level Progression
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 800, fontSize: '1.05rem', padding: '4px 16px', borderRadius: 20, border: '2px solid #10b981' }}>
                  Current: {readingProgress.currentLevel}
                </span>
                {readingProgress.therapistOverride && (
                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.82rem', padding: '3px 10px', borderRadius: 12, border: '1px solid #f59e0b' }}>
                    Therapist Override Active
                  </span>
                )}
              </div>
              {readingProgress.levelHistory && readingProgress.levelHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                  {readingProgress.levelHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.88rem', alignItems: 'center', color: '#374151' }}>
                      <span style={{ fontWeight: 700 }}>{h.fromLevel} → {h.toLevel}</span>
                      <span style={{ color: '#6b7280' }}>{new Date(h.advancedAt).toLocaleDateString()}</span>
                      <span style={{ background: h.advancedBy === 'therapist' ? '#fef3c7' : '#d1fae5', borderRadius: 6, padding: '1px 8px', fontSize: '0.8rem' }}>{h.advancedBy}</span>
                      {h.note && <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>{h.note}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '0.9rem', color: '#065f46' }}>Check / Override Level</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={overrideLevel}
                    onChange={e => setOverrideLevel(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #a7f3d0', fontFamily: 'inherit' }}
                  >
                    {READING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={overrideNote}
                    onChange={e => setOverrideNote(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #a7f3d0', fontFamily: 'inherit', fontSize: '0.88rem' }}
                  />
                  <button className="action-btn" style={{ background: '#0f766e', color: '#fff' }}
                    onClick={() => handleOverrideLevel(selectedUsername)}>
                    Set Level
                  </button>
                  <button className="action-btn"
                    onClick={() => handleCheckAdvancement(selectedUsername)}>
                    Check Auto-Advance
                  </button>
                </div>
                {overrideMsg && <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#065f46', fontWeight: 600 }}>{overrideMsg}</p>}
              </div>
            </div>
          )}

          {/* ── Analytics Charts ──────────────────────────────── */}
          {analyticsData && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#1e40af', borderBottom: '2px solid #bfdbfe', paddingBottom: '6px' }}>
                📊 Analytics Trends
              </h3>
              {analyticsData.phonemeAccuracy && analyticsData.phonemeAccuracy.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <ReactApexChart
                    type="line"
                    height={220}
                    options={{
                      chart: { toolbar: { show: false }, id: 'phoneme-trend' },
                      title: { text: 'Phoneme Accuracy Over Time', style: { fontSize: '13px' } },
                      xaxis: { categories: analyticsData.phonemeAccuracy.map(p => new Date(p.date).toLocaleDateString()), labels: { rotate: -30 } },
                      yaxis: { min: 0, max: 100, labels: { formatter: v => `${v}%` } },
                      colors: ['#6366f1'],
                      markers: { size: 4 },
                      stroke: { curve: 'smooth', width: 2 },
                      tooltip: { y: { formatter: v => `${v}%` } },
                    }}
                    series={[{ name: 'Accuracy', data: analyticsData.phonemeAccuracy.map(p => p.accuracy) }]}
                  />
                </div>
              )}
              {analyticsData.ranSpeed && analyticsData.ranSpeed.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <ReactApexChart
                    type="line"
                    height={220}
                    options={{
                      chart: { toolbar: { show: false }, id: 'ran-trend' },
                      title: { text: 'RAN Speed (items/min) Over Time', style: { fontSize: '13px' } },
                      xaxis: { categories: analyticsData.ranSpeed.map(r => new Date(r.date).toLocaleDateString()), labels: { rotate: -30 } },
                      yaxis: { min: 0, labels: { formatter: v => `${v}` } },
                      colors: ['#10b981'],
                      markers: { size: 4 },
                      stroke: { curve: 'smooth', width: 2 },
                    }}
                    series={[{ name: 'Items/min', data: analyticsData.ranSpeed.map(r => r.itemsPerMinute) }]}
                  />
                </div>
              )}
              {analyticsData.workingMemory && analyticsData.workingMemory.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <ReactApexChart
                    type="line"
                    height={220}
                    options={{
                      chart: { toolbar: { show: false }, id: 'wm-trend' },
                      title: { text: 'Working Memory Score Over Time', style: { fontSize: '13px' } },
                      xaxis: { categories: analyticsData.workingMemory.map(w => new Date(w.date).toLocaleDateString()), labels: { rotate: -30 } },
                      yaxis: { min: 0 },
                      colors: ['#7c3aed'],
                      markers: { size: 4 },
                      stroke: { curve: 'smooth', width: 2 },
                    }}
                    series={[{ name: 'WM Score', data: analyticsData.workingMemory.map(w => w.wms) }]}
                  />
                </div>
              )}
              {analyticsData.moodDistribution && Object.keys(analyticsData.moodDistribution).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <ReactApexChart
                    type="bar"
                    height={180}
                    options={{
                      chart: { toolbar: { show: false }, id: 'mood-dist' },
                      title: { text: 'Mood Distribution', style: { fontSize: '13px' } },
                      xaxis: { categories: Object.keys(analyticsData.moodDistribution) },
                      colors: ['#f59e0b'],
                      plotOptions: { bar: { borderRadius: 6, distributed: true } },
                      legend: { show: false },
                    }}
                    series={[{ name: 'Sessions', data: Object.values(analyticsData.moodDistribution) }]}
                  />
                </div>
              )}
              {analyticsData.frustrationTrend && analyticsData.frustrationTrend.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <ReactApexChart
                    type="line"
                    height={200}
                    options={{
                      chart: { toolbar: { show: false }, id: 'frustration-trend' },
                      title: { text: 'Frustration Trend (Angry + Sad %)', style: { fontSize: '13px' } },
                      xaxis: { categories: analyticsData.frustrationTrend.map(f => new Date(f.date).toLocaleDateString()), labels: { rotate: -30 } },
                      yaxis: { min: 0, max: 100, labels: { formatter: v => `${v}%` } },
                      colors: ['#ef4444', '#3b82f6'],
                      markers: { size: 4 },
                      stroke: { curve: 'smooth', width: 2 },
                    }}
                    series={[
                      { name: 'Angry %', data: analyticsData.frustrationTrend.map(f => f.angryPct) },
                      { name: 'Sad %',   data: analyticsData.frustrationTrend.map(f => f.sadPct)   },
                    ]}
                  />
                </div>
              )}
              {analyticsData.phonemeAccuracy.length <= 1 &&
               analyticsData.ranSpeed.length <= 1 &&
               analyticsData.workingMemory.length <= 1 && (
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Not enough data for trend charts yet (need 2+ sessions per metric).</p>
              )}
            </div>
          )}

          {/* ── AI Adaptation Log ─────────────────────────────── */}
          {adaptationLogs.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#6d28d9', borderBottom: '2px solid #ede9fe', paddingBottom: '6px' }}>
                🤖 AI Adaptation Log ({adaptationLogs.length} events)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#ede9fe' }}>
                    <th style={{ padding: '5px 10px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '5px 10px' }}>Game</th>
                    <th style={{ padding: '5px 10px' }}>Emotion</th>
                    <th style={{ padding: '5px 10px' }}>Difficulty</th>
                    <th style={{ padding: '5px 10px' }}>Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {adaptationLogs.map((log, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#faf5ff', borderBottom: '1px solid #ede9fe' }}>
                      <td style={{ padding: '5px 10px', color: '#6b7280' }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 600 }}>{log.gameKey}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center' }}>{log.emotionDetected || '—'}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', fontSize: '0.82rem' }}>
                        {log.previousDifficulty && log.newDifficulty
                          ? <span>{log.previousDifficulty} → <strong>{log.newDifficulty}</strong></span>
                          : '—'}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                        <span style={{ background: '#ede9fe', borderRadius: 8, padding: '1px 8px', fontSize: '0.8rem' }}>{log.triggerType}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>

  );
};

export default TherapistDashboard;
