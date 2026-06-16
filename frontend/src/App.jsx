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
    if (value == null) return;
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
function Nav({ view, subject, level, onLogoClick, onStats, onAdmin, onLogout, user }) {
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={onLogoClick}>✦ OmniTutor</div>
      {view !== 'dashboard' && view !== 'stats' && view !== 'auth' && view !== 'admin' && (
        <div className="breadcrumb">
          <span onClick={onLogoClick} style={{ cursor: 'pointer', opacity: 0.6 }}>Home</span>
          {subject && <><span className="sep">›</span><span>{subject.name}</span></>}
          {level && view === 'chat' && <><span className="sep">›</span><span>{level.name}</span></>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {user?.is_admin && (
          <button className={`stats-nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={onAdmin} style={{ background: '#8b5cf633', color: '#c4b5fd' }}>
            🛡️ Admin
          </button>
        )}
        <button className={`stats-nav-btn ${view === 'stats' ? 'active' : ''}`} onClick={onStats} title="Analytics Dashboard">
          📊 Stats
        </button>
        {view !== 'auth' && (
          <button className="stats-nav-btn" onClick={onLogout} style={{ background: '#ef444433', color: '#fca5a5' }}>
            🚪 Logout
          </button>
        )}
      </div>
    </nav>
  );
}

/* ─── Auth Component ─────────────────────────────────────────────────── */
function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        
        const res = await axios.post(`${API}/api/auth/login`, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        localStorage.setItem('token', res.data.access_token);
        onAuthSuccess(res.data.access_token);
      } else {
        await axios.post(`${API}/api/auth/signup`, { email, password });
        setIsLogin(true); // Switch to login after successful signup
        setError('Signup successful! Please login.');
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🎓</span>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{isLogin ? 'Login to continue your learning journey' : 'Sign up to start asking questions'}</p>
        </div>

        {error && <div style={{ background: '#ef444433', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #ef444466' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ minHeight: '40px', padding: '0.8rem' }}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ minHeight: '40px', padding: '0.8rem' }}
            />
          </div>
          <button className="btn-submit" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? '⏳ Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            style={{ color: '#22d3ee', cursor: 'pointer', fontWeight: 600 }}
          >
            {isLogin ? 'Sign up' : 'Login'}
          </span>
        </div>
      </div>
    </div>
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
        <div className="hero-badge"><span>⚡</span><span>Powered by Llama-3.3-70B</span></div>
      </div>
      <div className="stats-bar">
        {[['4','Subjects'],['10+','Grade Levels'],['70B','AI Parameters'],['∞','Questions']].map(([v,l]) => (
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
function Chat({ subject, level, token, onBack, onLogout }) {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('idle');
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const isYoung = YOUNG_LEVELS.includes(level.level);
  const chatEndRef = useRef(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/api/history?subject=${encodeURIComponent(subject.name)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistory(res.data);
      } catch (err) {
        if (err.response?.status === 401) onLogout();
      }
    };
    fetchHistory();
  }, [subject.name, token, onLogout]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    const userQ = question;
    setQuestion('');
    setStatus('processing');
    setErrorMsg('');
    
    const tempHistory = [...history, { role: 'user', content: userQ, timestamp: new Date().toISOString() }];
    setHistory(tempHistory);
    
    try {
      const res = await axios.post(`${API}/api/query`, 
        { question: userQ, level: level.level, subject: subject.name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.status === 'completed') {
        setStatus('idle');
        setHistory([...tempHistory, { role: 'assistant', content: res.data.answer, timestamp: new Date().toISOString() }]);
        if (isYoung) confetti({ particleCount: 180, spread: 90, origin: { y: 0.55 }, colors: ['#a78bfa','#ec4899','#fbbf24','#34d399'] });
      }
    } catch (err) {
      setStatus('idle');
      if (err.response?.status === 401) {
        onLogout();
      } else if (err.response?.status === 429) {
        setErrorMsg('⏳ Rate limit exceeded! You can only ask 3 questions per minute. Please wait a moment.');
        setHistory(history);
        setQuestion(userQ);
      } else {
        setErrorMsg('❌ Failed to reach the backend. Make sure the server is running.');
        setHistory(history);
        setQuestion(userQ);
      }
    }
  };

  return (
    <div className="chat-page page">
      <div className="chat-header-card">
        <span className="chat-header-icon">{subject.icon}</span>
        <div className="chat-header-text"><h2>{subject.name}</h2><p>{level.name} · {level.desc}</p></div>
        <span className="chat-header-badge">{level.icon} {level.name}</span>
        <button className="back-btn" onClick={onBack} style={{ marginLeft: '1rem' }}>← Back</button>
      </div>

      <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
        
        <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {history.length === 0 && status === 'idle' && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
              <span style={{ fontSize: '3rem', opacity: 0.5 }}>{subject.icon}</span>
              <p>No questions asked yet. Start the conversation!</p>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'rgba(34, 211, 238, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: msg.role === 'user' ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1rem',
              borderRadius: '12px',
              maxWidth: '85%',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {msg.role === 'user' ? 'You' : 'OmniTutor'}
              </div>
              <div className="markdown-body" style={{ margin: 0 }}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}

          {status === 'processing' && (
            <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem', borderRadius: '12px', maxWidth: '85%' }}>
              <div className="loader" style={{ padding: '0.5rem', marginTop: 0 }}>
                <div className="spinner-ring" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
                <p style={{ margin: 0 }}>{isYoung ? '✨ Cooking up a fun explanation…' : '🧠 Thinking deeply'}<span className="loader-dots" /></p>
              </div>
            </div>
          )}
          
          {errorMsg && (
            <div style={{ alignSelf: 'center', background: '#ef444433', border: '1px solid #ef444466', color: '#fca5a5', padding: '1rem', borderRadius: '8px', maxWidth: '85%', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <textarea 
              className="input-field" 
              placeholder={`Ask anything about ${subject.name}…`} 
              value={question} 
              onChange={e => setQuestion(e.target.value)} 
              disabled={status === 'processing'} 
              style={{ minHeight: '60px', padding: '1rem' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Press Enter to send, Shift+Enter for new line</span>
            <button className="btn-submit" disabled={status === 'processing' || !question.trim()} style={{ margin: 0, padding: '0.8rem 2rem', width: 'auto' }}>
              Send
            </button>
          </div>
        </form>
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
    const interval = setInterval(fetchStats, 15000);
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
        <button className="back-btn" onClick={onBack}>← Back</button>
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
              <div className="kpi-value" style={{ fontSize: '1.2rem' }}>Llama-3.3-70B</div>
              <div className="kpi-label">Meta Model</div>
            </div>
          </div>

          <div className="charts-row">
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
        </>
      )}
    </div>
  );
}

/* ─── Screen 5: Admin Dashboard ─────────────────────────────────────── */
function AdminDashboard({ onBack, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const res = await axios.get(`${API}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.users);
      } catch { setError(true); }
      finally { setLoading(false); }
    };
    fetchAdminStats();
  }, [token]);

  return (
    <div className="page">
      <div className="stats-page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <h1 className="stats-page-title">🛡️ Admin Panel</h1>
          <p className="stats-page-sub">View registered users and activity</p>
        </div>
      </div>

      {loading && (
        <div className="loader" style={{ marginTop: '4rem' }}>
          <div className="spinner-ring" /><p>Loading admin data…</p>
        </div>
      )}

      {error && !loading && (
        <div className="stats-error">
          <p>⚠️ Failed to load admin stats. You might not have permission.</p>
        </div>
      )}

      {!loading && !error && (
        <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>User Statistics</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem 0' }}>ID</th>
                <th style={{ padding: '1rem 0' }}>Email</th>
                <th style={{ padding: '1rem 0' }}>Questions Asked</th>
                <th style={{ padding: '1rem 0' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>#{u.id}</td>
                  <td style={{ padding: '1rem 0', fontWeight: 600 }}>{u.email}</td>
                  <td style={{ padding: '1rem 0' }}><span className="topic-tag">{u.questions_asked}</span></td>
                  <td style={{ padding: '1rem 0' }}>
                    {u.is_admin ? <span style={{ color: '#c4b5fd', background: '#8b5cf633', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Admin</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>User</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── App Root ───────────────────────────────────────────────────────── */
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);

  // Fetch user profile if token exists
  useEffect(() => {
    if (token) {
      axios.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, [token]);

  // Routing Logic
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    if (!token && view !== 'stats') {
      setView('auth');
    } else if (token && view === 'auth') {
      setView('dashboard');
    }
  }, [token, view]);

  // Back button handling
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.view) {
        setView(e.state.view);
        setSubject(e.state.subject);
        setLevel(e.state.level);
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ view, subject, level }, '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (newView, newSubject = null, newLevel = null) => {
    setView(newView);
    setSubject(newSubject);
    setLevel(newLevel);
    window.history.pushState({ view: newView, subject: newSubject, level: newLevel }, '');
  };

  const goHome = () => navigate(token ? 'dashboard' : 'auth');
  const pickSubject = (s) => navigate('classSelector', s, null);
  const pickLevel  = (l) => navigate('chat', subject, l);
  const backToClasses = () => navigate('classSelector', subject, null);
  const openStats = () => navigate(view === 'stats' ? (token ? 'dashboard' : 'auth') : 'stats', subject, level);
  const openAdmin = () => navigate(view === 'admin' ? 'dashboard' : 'admin', subject, level);
  
  const handleAuthSuccess = (newToken) => {
    setToken(newToken);
    navigate('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('auth');
  };

  return (
    <>
      <Stars />
      <div className="app">
        <Nav view={view} subject={subject} level={level} onLogoClick={goHome} onStats={openStats} onAdmin={openAdmin} onLogout={handleLogout} user={user} />
        
        {view === 'auth' && !token && <Auth onAuthSuccess={handleAuthSuccess} />}
        
        {view === 'dashboard'     && token && <Dashboard onSelect={pickSubject} />}
        {view === 'classSelector' && token && subject && <ClassSelector subject={subject} onSelect={pickLevel} onBack={goHome} />}
        {view === 'chat'          && token && subject && level && <Chat subject={subject} level={level} token={token} onBack={backToClasses} onLogout={handleLogout} />}
        
        {view === 'stats'         && <StatsDashboard onBack={goHome} />}
        {view === 'admin'         && token && user?.is_admin && <AdminDashboard onBack={goHome} token={token} />}
      </div>
    </>
  );
}
