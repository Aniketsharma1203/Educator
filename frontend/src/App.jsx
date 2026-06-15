import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import confetti from 'canvas-confetti';
import 'katex/dist/katex.min.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Data ──────────────────────────────────────────────────────────── */
const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', cls: 'math', icon: '🔢', desc: 'From counting to complex analysis — master numbers at every level.', topics: ['Arithmetic', 'Algebra', 'Calculus', 'Linear Algebra', 'Topology'] },
  { id: 'science', name: 'Science', cls: 'science', icon: '🔬', desc: 'Explore physics, chemistry, biology and the universe beyond.', topics: ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Quantum'] },
  { id: 'english', name: 'English', cls: 'english', icon: '📖', desc: 'Grammar, literature, creative writing — command the written word.', topics: ['Grammar', 'Literature', 'Essay Writing', 'Poetry', 'Linguistics'] },
  { id: 'general knowledge', name: 'General Knowledge', cls: 'gk', icon: '🌍', desc: 'History, geography, culture and everything that makes our world.', topics: ['History', 'Geography', 'Civics', 'Current Affairs', 'Philosophy'] },
];

const TIERS = [
  { label: '🏫 Primary School', color: '#22d3ee', classes: [
    { name: 'Class 1 – 2', icon: '🌱', desc: 'Foundations & basics', level: 'Primary (Class 1-5)' },
    { name: 'Class 3 – 4', icon: '🌿', desc: 'Building knowledge', level: 'Primary (Class 1-5)' },
    { name: 'Class 5', icon: '🌳', desc: 'Consolidating skills', level: 'Primary (Class 1-5)' },
  ]},
  { label: '🏫 Middle School', color: '#a78bfa', classes: [
    { name: 'Class 6 – 7', icon: '📐', desc: 'Broadening horizons', level: 'Middle School (Class 6-10)' },
    { name: 'Class 8 – 9', icon: '📏', desc: 'Deepening concepts', level: 'Middle School (Class 6-10)' },
    { name: 'Class 10', icon: '🏆', desc: 'Board exam ready', level: 'Middle School (Class 6-10)' },
  ]},
  { label: '🎓 High School', color: '#f59e0b', classes: [
    { name: 'Class 11', icon: '🔭', desc: 'Specialisation begins', level: 'High School' },
    { name: 'Class 12', icon: '🚀', desc: 'Pre-university level', level: 'High School' },
  ]},
  { label: '🏛️ University & Beyond', color: '#ec4899', classes: [
    { name: 'Undergraduate', icon: '🎓', desc: "Bachelor's degree level", level: 'Undergraduate' },
    { name: 'Graduate', icon: '🏛️', desc: "Master's degree level", level: 'Graduate' },
    { name: 'PhD', icon: '🔬', desc: 'Doctoral & research level', level: 'PhD' },
  ]},
];

const YOUNG_LEVELS = ['Primary (Class 1-5)', 'Middle School (Class 6-10)'];

/* ─── Animated Counter ──────────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 1400 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

/* ─── Stars ─────────────────────────────────────────────────────────── */
function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
    size: Math.random() * 2.5 + 0.5, d: `${Math.random() * 5 + 2}s`,
    delay: `${Math.random() * 5}s`, op: Math.random() * 0.5 + 0.2,
  }));
  return (
    <div className="stars" aria-hidden>
      {stars.map(s => (
        <div key={s.id} className="star" style={{ top: s.top, left: s.left, width: s.size, height: s.size, '--d': s.d, '--op': s.op, animationDelay: s.delay }} />
      ))}
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────── */
function Nav({ view, subject, level, onLogoClick, onStats }) {
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={onLogoClick}>✦ OmniTutor</div>
      {view !== 'dashboard' && view !== 'stats' && (
        <div className="breadcrumb">
          <span onClick={onLogoClick} style={{ cursor: 'pointer', opacity: 0.6 }}>Home</span>
          {subject && <><span className="sep">›</span><span>{subject.name}</span></>}
          {level && view === 'chat' && <><span className="sep">›</span><span>{level.name}</span></>}
        </div>
      )}
      <button className={`stats-nav-btn ${view === 'stats' ? 'active' : ''}`} onClick={onStats} title="Analytics Dashboard">
        📊 Stats
      </button>
    </nav>
  );
}

/* ─── Screen 1: Dashboard ────────────────────────────────────────────── */
function Dashboard({ onSelect }) {
  return (
    <div className="page">
      <div className="hero">
        <span className="hero-mascot">🎓</span>
        <h1>Learn Anything.<br />At Any Level.</h1>
        <p>Choose a subject below and tell us your grade — OmniTutor adapts to you.</p>
        <div className="hero-badge"><span>⚡</span><span>Powered by DeepSeek-R1 · 671B parameters</span></div>
      </div>
      <div className="stats-bar">
        {[['4','Subjects'],['10+','Grade Levels'],['671B','AI Parameters'],['∞','Questions']].map(([v,l]) => (
          <div key={l} className="stat-item"><div className="stat-value">{v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>
      <div className="section-title">Choose a Subject</div>
      <div className="subjects-grid">
        {SUBJECTS.map(s => (
          <div key={s.id} className={`subject-card ${s.cls}`} onClick={() => onSelect(s)}>
            <div className="card-glow" />
            <span className="subject-icon">{s.icon}</span>
            <h2>{s.name}</h2>
            <p>{s.desc}</p>
            <div className="card-topics">{s.topics.map(t => <span key={t} className="topic-tag">{t}</span>)}</div>
            <span className="card-arrow">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Screen 2: Class Selector ───────────────────────────────────────── */
function ClassSelector({ subject, onSelect, onBack }) {
  return (
    <div className="class-page page">
      <div className="class-page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span style={{ fontSize: '1.5rem' }}>{subject.icon}</span>
        <div><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{subject.name}</div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select your class or level</div></div>
      </div>
      {TIERS.map(tier => (
        <div key={tier.label} className="tier-section">
          <div className="tier-label" style={{ color: tier.color }}>{tier.label}</div>
          <div className="classes-grid">
            {tier.classes.map((cls, i) => (
              <div key={cls.name} className="class-card" style={{ '--hover-color': `${tier.color}66`, animationDelay: `${i * 0.06}s` }} onClick={() => onSelect(cls)}>
                <span className="class-card-icon">{cls.icon}</span>
                <div className="class-card-name">{cls.name}</div>
                <div className="class-card-desc">{cls.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Screen 3: Chat ─────────────────────────────────────────────────── */
function Chat({ subject, level, onBack }) {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('idle');
  const [answer, setAnswer] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pollRef = useRef(null);
  const isYoung = YOUNG_LEVELS.includes(level.level);

  useEffect(() => {
    if (taskId && status === 'processing') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/api/status/${taskId}`);
          if (res.data.status === 'completed') { finalize(res.data.answer); clearInterval(pollRef.current); }
        } catch { setStatus('error'); setAnswer('Error while checking status.'); clearInterval(pollRef.current); }
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [taskId, status]);

  const finalize = (text) => {
    setAnswer(text); setStatus('completed');
    if (isYoung) confetti({ particleCount: 180, spread: 90, origin: { y: 0.55 }, colors: ['#a78bfa','#ec4899','#fbbf24','#34d399'] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setStatus('processing'); setAnswer(''); setTaskId(null);
    window.speechSynthesis?.cancel(); setIsSpeaking(false);
    try {
      const res = await axios.post(`${API}/api/query`, { question, level: level.level, subject: subject.name });
      if (res.data.status === 'completed') finalize(res.data.answer);
      else if (res.data.task_id) setTaskId(res.data.task_id);
    } catch { setStatus('error'); setAnswer('Failed to reach the backend. Make sure Docker containers are running.'); }
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(mainAnswer.replace(/[*_#`~$\\]/g, ''));
    utt.rate = isYoung ? 0.85 : 1.0;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  let thinkContent = '', mainAnswer = answer;
  const thinkMatch = answer.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) { thinkContent = thinkMatch[1].trim(); mainAnswer = answer.replace(/<think>[\s\S]*?<\/think>/, '').trim(); }

  return (
    <div className="chat-page page">
      <div className="chat-header-card">
        <span className="chat-header-icon">{subject.icon}</span>
        <div className="chat-header-text"><h2>{subject.name}</h2><p>{level.name} · {level.desc}</p></div>
        <span className="chat-header-badge">{level.icon} {level.name}</span>
        <button className="back-btn" onClick={onBack} style={{ marginLeft: '1rem' }}>← Back</button>
      </div>
      <div className="glass-panel">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Question</label>
            <textarea className="input-field" placeholder={`Ask anything about ${subject.name}…`} value={question} onChange={e => setQuestion(e.target.value)} disabled={status === 'processing'} />
          </div>
          <button className="btn-submit" disabled={status === 'processing' || !question.trim()}>
            {status === 'processing' ? '⏳ Thinking…' : `Ask OmniTutor ${subject.icon}`}
          </button>
        </form>
        {status === 'processing' && (
          <div className="loader">
            <div className="spinner-ring" />
            <p>{isYoung ? '✨ Cooking up a fun explanation…' : '🧠 Running deep mathematical reasoning'}<span className="loader-dots" /></p>
          </div>
        )}
        {status === 'error' && (
          <div className="result-container">
            <h2 className="result-header" style={{ color: '#ef4444' }}>Error</h2>
            <div className="markdown-body"><p>{mainAnswer || answer}</p></div>
          </div>
        )}
        {status === 'completed' && answer && (
          <div className="result-container">
            {thinkContent && (
              <details className="think-accordion">
                <summary>🧠 View AI Thought Process</summary>
                <div className="think-content markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{thinkContent}</ReactMarkdown>
                </div>
              </details>
            )}
            <div className="answer-header">
              <h2 className="result-header">Explanation</h2>
              {isYoung && (
                <button className={`tts-button ${isSpeaking ? 'speaking' : ''}`} onClick={handleSpeak}>
                  {isSpeaking ? '🔊 Playing…' : '🔈 Read Aloud'}
                </button>
              )}
            </div>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{mainAnswer}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Screen 4: Analytics Dashboard ─────────────────────────────────── */
function StatsDashboard({ onBack }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/api/stats`);
        setStats(res.data);
      } catch { setError(true); }
      finally { setLoading(false); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const subjectData = stats ? [
    { label: 'Mathematics', icon: '🔢', color: '#a78bfa', value: stats.questions.math },
    { label: 'Science',     icon: '🔬', color: '#22d3ee', value: stats.questions.science },
    { label: 'English',     icon: '📖', color: '#fbbf24', value: stats.questions.english },
    { label: 'Gen. Knowledge', icon: '🌍', color: '#60a5fa', value: stats.questions.gk },
  ] : [];

  const tierData = stats ? [
    { label: 'Primary School',  icon: '🌱', color: '#22d3ee', value: stats.tiers.school },
    { label: 'High School',     icon: '🎓', color: '#f59e0b', value: stats.tiers.highschool },
    { label: 'University',      icon: '🏛️', color: '#a78bfa', value: stats.tiers.university },
    { label: 'PhD / Research',  icon: '🔬', color: '#ec4899', value: stats.tiers.phd },
  ] : [];

  const maxSubject = Math.max(1, ...subjectData.map(d => d.value));
  const maxTier = Math.max(1, ...tierData.map(d => d.value));

  return (
    <div className="stats-page page">
      <div className="stats-page-header">
        <button className="back-btn" onClick={onBack}>← Back to Home</button>
        <div>
          <h1 className="stats-page-title">📊 Live Analytics</h1>
          <p className="stats-page-sub">Auto-refreshes every 15 seconds</p>
        </div>
        <div className="live-indicator"><span className="live-dot" />LIVE</div>
      </div>

      {loading && (
        <div className="loader" style={{ marginTop: '4rem' }}>
          <div className="spinner-ring" /><p>Loading analytics…</p>
        </div>
      )}

      {error && !loading && (
        <div className="stats-error">
          <p>⚠️ Could not reach the backend. Make sure Docker is running.</p>
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Top KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-visits">
              <div className="kpi-icon">👁️</div>
              <div className="kpi-value"><AnimatedNumber value={stats.visits} /></div>
              <div className="kpi-label">Total Visits</div>
            </div>
            <div className="kpi-card kpi-questions">
              <div className="kpi-icon">❓</div>
              <div className="kpi-value"><AnimatedNumber value={stats.questions.total} /></div>
              <div className="kpi-label">Questions Asked</div>
            </div>
            <div className="kpi-card kpi-subjects">
              <div className="kpi-icon">📚</div>
              <div className="kpi-value">4</div>
              <div className="kpi-label">Active Subjects</div>
            </div>
            <div className="kpi-card kpi-model">
              <div className="kpi-icon">🤖</div>
              <div className="kpi-value" style={{ fontSize: '1.2rem' }}>R1-0528</div>
              <div className="kpi-label">DeepSeek Model</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            {/* Questions by Subject */}
            <div className="chart-card">
              <h3 className="chart-title">Questions by Subject</h3>
              <div className="bar-chart">
                {subjectData.map(d => (
                  <div key={d.label} className="bar-row">
                    <div className="bar-label">{d.icon} {d.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(d.value / maxSubject) * 100}%`, background: `linear-gradient(90deg, ${d.color}88, ${d.color})` }} />
                    </div>
                    <div className="bar-val" style={{ color: d.color }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions by Tier */}
            <div className="chart-card">
              <h3 className="chart-title">Questions by Level</h3>
              <div className="bar-chart">
                {tierData.map(d => (
                  <div key={d.label} className="bar-row">
                    <div className="bar-label">{d.icon} {d.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(d.value / maxTier) * 100}%`, background: `linear-gradient(90deg, ${d.color}88, ${d.color})` }} />
                    </div>
                    <div className="bar-val" style={{ color: d.color }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subject Donut-style rings */}
          <div className="chart-card" style={{ marginTop: '1.5rem' }}>
            <h3 className="chart-title">Subject Breakdown</h3>
            <div className="subject-rings">
              {subjectData.map(d => {
                const pct = stats.questions.total > 0 ? Math.round((d.value / stats.questions.total) * 100) : 0;
                return (
                  <div key={d.label} className="ring-item">
                    <div className="ring-circle" style={{ '--pct': pct, '--color': d.color }}>
                      <span className="ring-icon">{d.icon}</span>
                      <span className="ring-pct">{pct}%</span>
                    </div>
                    <div className="ring-label">{d.label}</div>
                    <div className="ring-count" style={{ color: d.color }}>{d.value} Qs</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── App Root ───────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView] = useState('dashboard');
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);

  const goHome = () => { setView('dashboard'); setSubject(null); setLevel(null); };
  const pickSubject = (s) => { setSubject(s); setView('classSelector'); };
  const pickLevel  = (l) => { setLevel(l); setView('chat'); };
  const backToClasses = () => setView('classSelector');
  const openStats = () => setView(v => v === 'stats' ? 'dashboard' : 'stats');

  return (
    <>
      <Stars />
      <div className="app">
        <Nav view={view} subject={subject} level={level} onLogoClick={goHome} onStats={openStats} />
        {view === 'dashboard'     && <Dashboard onSelect={pickSubject} />}
        {view === 'classSelector' && subject && <ClassSelector subject={subject} onSelect={pickLevel} onBack={goHome} />}
        {view === 'chat'          && subject && level && <Chat subject={subject} level={level} onBack={backToClasses} />}
        {view === 'stats'         && <StatsDashboard onBack={goHome} />}
      </div>
    </>
  );
}
