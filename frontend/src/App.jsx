import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import confetti from 'canvas-confetti';
import { GoogleLogin } from '@react-oauth/google';
import 'katex/dist/katex.min.css';

const API = ''; // Using Vercel/Vite reverse proxy to bypass network blocks

/* ─── Data ──────────────────────────────────────────────────────────── */
const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', cls: 'math', icon: '🔢', desc: 'From counting to complex analysis — master numbers at every level.', topics: ['Arithmetic', 'Algebra', 'Calculus', 'Linear Algebra', 'Topology'] },
  { id: 'science', name: 'Science', cls: 'science', icon: '🔬', desc: 'Explore physics, chemistry, biology and the universe beyond.', topics: ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Quantum'] },
  { id: 'english', name: 'English', cls: 'english', icon: '📖', desc: 'Grammar, literature, creative writing — command the written word.', topics: ['Grammar', 'Literature', 'Essay Writing', 'Poetry', 'Linguistics'] },
  { id: 'general knowledge', name: 'General Knowledge', cls: 'gk', icon: '🌍', desc: 'History, geography, culture and everything that makes our world.', topics: ['History', 'Geography', 'Civics', 'Current Affairs', 'Philosophy'] },
  { id: 'finance', name: 'Finance', cls: 'finance', icon: '💰', desc: 'Accounting, valuation, derivatives and everything for CA & CFA students.', topics: ['Financial Accounting', 'Valuation', 'Derivatives', 'Corporate Finance', 'Risk Management', 'Taxation', 'Auditing', 'IFRS / GAAP'] },
  { id: 'coding', name: 'Coding', cls: 'coding', icon: '💻', desc: 'Python, Web Dev, Algorithms & Data Structures.', topics: ['Python', 'JavaScript', 'Data Structures', 'Algorithms', 'Databases'] },
  { id: 'agriculture', name: 'Agriculture', cls: 'agri', icon: '🌾', desc: 'Farming, soil science, horticulture, and sustainable agriculture.', topics: ['Agronomy', 'Soil Science', 'Horticulture', 'Agribusiness', 'Sustainability'] },
  { id: 'law', name: 'Law', cls: 'law', icon: '⚖️', desc: 'Legal concepts, statutes, constitutional law, and fairness.', topics: ['Constitutional Law', 'Contracts', 'Criminal Law', 'Torts', 'Legal Logic'] },
  { id: 'homework', name: 'Homework Helper', cls: 'homework', icon: '📝', desc: 'Get step-by-step guidance on your homework. (Upload a photo!)', topics: ['Math Problems', 'Science Questions', 'Essay Outlines', 'Reading Comprehension'] },
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

const LEVEL_NAMES = ['', 'Curious Cub 🐣', 'Explorer 🧭', 'Scholar 📚', 'Genius 💡', 'Master 🏆'];
const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200];
const BADGE_META = {
  first_step:    { name: 'First Step 🌱',    desc: 'Ask your first question' },
  ten_questions: { name: 'Ten Questions 🔟',  desc: 'Ask 10 questions total' },
  hot_streak:    { name: 'Hot Streak 🔥',     desc: 'Maintain a 3-day streak' },
  star_student:  { name: 'Star Student 🌟',   desc: 'Reach Scholar level' },
  multi_subject: { name: 'Big Brain 🧠',      desc: 'Ask in 3+ different subjects' },
};

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

/* ─── Badge Unlock Popup ─────────────────────────────────────────────── */
function BadgePopup({ badges, onClose }) {
  useEffect(() => {
    if (badges.length === 0) return;
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#fbbf24','#f59e0b','#a78bfa','#22d3ee','#ec4899'] });
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [badges]);
  if (badges.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {badges.map(id => (
        <div key={id} onClick={onClose} style={{ background: 'linear-gradient(135deg, #fbbf2422, #f59e0b22)', border: '1px solid #fbbf2466', borderRadius: '12px', padding: '1rem 1.5rem', backdropFilter: 'blur(12px)', cursor: 'pointer', animation: 'fadeInDown 0.4s ease' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>🏅 Badge Unlocked!</div>
          <div style={{ color: '#fbbf24', fontWeight: 600 }}>{BADGE_META[id]?.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{BADGE_META[id]?.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────── */
function Nav({ view, subject, level, onLogoClick, onStats, onAdmin, onLogout, user, profile }) {
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
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {profile && profile.streak_count > 0 && (
          <div style={{ background: '#ef444422', border: '1px solid #ef444444', borderRadius: '8px', padding: '4px 10px', fontSize: '0.85rem', color: '#fca5a5', fontWeight: 600 }}>
            🔥 {profile.streak_count}d
          </div>
        )}
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
        formData.append('username', email.trim().toLowerCase());
        formData.append('password', password);
        
        const res = await axios.post(`${API}/api/auth/login`, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        localStorage.setItem('token', res.data.access_token);
        onAuthSuccess(res.data.access_token);
      } else {
        await axios.post(`${API}/api/auth/signup`, { email: email.trim().toLowerCase(), password });
        setIsLogin(true); // Switch to login after successful signup
        setError('Signup successful! Please login.');
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Network error. If you are on a school/work network, the server might be blocked. Try disabling your VPN, adblocker, or use a different network.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/google`, {
        token: credentialResponse.credential
      });
      localStorage.setItem('token', res.data.access_token);
      onAuthSuccess(res.data.access_token);
    } catch (err) {
      setError('Google Login failed. Please try again.');
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

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login failed.')}
              theme="filled_black"
              shape="pill"
            />
          </div>
        </div>
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

/* ─── Screen 1.5: Flashcards Dashboard & Study Mode ────────────────────── */
function FlashcardsDashboard({ token, onBack, onGoToChat }) {
  const [decks, setDecks] = useState([]);
  const [studyDeck, setStudyDeck] = useState(null);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/flashcards`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDecks(res.data)).catch(console.error);
  }, [token]);

  const deleteDeck = async (id) => {
    await axios.delete(`${API}/api/flashcards/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    setDecks(decks.filter(d => d.id !== id));
  };

  if (studyDeck) {
    const card = studyDeck.cards[currentCardIdx];
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ alignSelf: 'flex-start', margin: '1rem' }}>
          <button className="back-btn" onClick={() => setStudyDeck(null)}>← Back to Decks</button>
        </div>
        <h2 style={{ marginBottom: '2rem' }}>{studyDeck.subject} - {studyDeck.topic}</h2>
        <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Card {currentCardIdx + 1} of {studyDeck.cards.length}</div>
        
        <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
          <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
            <div className="flashcard-face flashcard-front">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Question</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{card.front}</div>
            </div>
            <div className="flashcard-face flashcard-back">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Answer</span>
              <div style={{ fontSize: '1.2rem' }}>{card.back}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="back-btn" onClick={() => { setIsFlipped(false); setCurrentCardIdx(Math.max(0, currentCardIdx - 1)); }} disabled={currentCardIdx === 0}>Previous</button>
          <button className="back-btn" onClick={() => { setIsFlipped(false); setCurrentCardIdx(Math.min(studyDeck.cards.length - 1, currentCardIdx + 1)); }} disabled={currentCardIdx === studyDeck.cards.length - 1}>Next</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem' }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>📇 My Flashcard Decks</h2>
        <div style={{ width: '80px' }}></div>
      </div>
      
      {decks.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
          <span style={{ fontSize: '3rem' }}>📇</span>
          <p>No flashcards yet. Ask the AI a question and click "Export -&gt; Generate Flashcards"!</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {decks.map(d => (
            <div key={d.id} className="subject-card" style={{ background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => onGoToChat(d.subject, d.topic)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="topic-tag">{d.subject}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteDeck(d.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
              </div>
              <h3 style={{ margin: '1rem 0' }}>{d.topic}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{d.cards.length} cards · {new Date(d.timestamp).toLocaleDateString()}</p>
              <button className="back-btn" style={{ width: '100%', marginTop: '1rem', background: 'rgba(139,92,246,0.2)' }} onClick={(e) => { e.stopPropagation(); setStudyDeck(d); setCurrentCardIdx(0); setIsFlipped(false); }}>
                Study Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Screen 1: Dashboard ────────────────────────────────────────────── */
function Dashboard({ onSelect, onViewFlashcards }) {
  return (
    <div className="page" style={{ position: 'relative' }}>
      <button onClick={onViewFlashcards} className="back-btn" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.4)' }}>
        📇 My Flashcards
      </button>
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

/* ─── Shared Components ────────────────────────────────────────────────── */
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="copy-btn" onClick={handleCopy} title="Copy" style={{
      background: 'transparent', border: 'none', color: copied ? '#34d399' : 'rgba(255,255,255,0.4)',
      cursor: 'pointer', padding: '4px', fontSize: '1.2rem', transition: 'all 0.2s', float: 'right'
    }}>
      {copied ? '✅' : '📋'}
    </button>
  );
};

/* ─── Screen 3: Chat ─────────────────────────────────────────────────── */
function Chat({ subject, level, token, onBack, onLogout, onBadgesUnlocked, onQuiz }) {
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState('idle');
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState(null);
  const [showTrophies, setShowTrophies] = useState(false);
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const isYoung = YOUNG_LEVELS.includes(level.level);
  const chatEndRef = useRef(null);
  const shouldScrollRef = useRef(true); // default true for initial load
  const fileInputRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setQuestion(prev => (prev + ' ' + finalTranscript).trim());
        }
      };
      recognitionRef.current.onerror = (e) => { console.error(e); setIsRecording(false); };
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) return alert("Speech Recognition not supported in this browser.");
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const generateFlashcards = async () => {
    setShowExportMenu(false);
    setStatus('processing');
    try {
      const context = history.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
      await axios.post(`${API}/api/flashcards/generate`, {
        subject: subject.name,
        topic: level.name,
        history_context: context
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Flashcards generated! Check your dashboard.");
      setStatus('idle');
    } catch (err) {
      alert("Failed to generate flashcards.");
      setStatus('idle');
    }
  };

  const exportPDF = () => {
    setShowExportMenu(false);
    window.print();
  };

  const exportWord = () => {
    setShowExportMenu(false);
    const historyHTML = history.map(msg => 
      `<p><strong>${msg.role === 'user' ? 'You' : 'OmniTutor'}:</strong><br/>${msg.content.replace(/\n/g, '<br/>')}</p>`
    ).join('<hr/>');
    const exportHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>OmniTutor Export</title></head><body><h1>OmniTutor Study Notes - ${subject.name}</h1>${historyHTML}</body></html>`;
    const blob = new Blob(['\ufeff', exportHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `OmniTutor-Notes-${subject.name}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const exportMarkdown = () => {
    setShowExportMenu(false);
    const mdText = history.map(msg => `### ${msg.role === 'user' ? 'You' : 'OmniTutor'}\n${msg.content}\n`).join('\n---\n\n');
    const blob = new Blob([`# OmniTutor Study Notes - ${subject.name}\n\n${mdText}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `OmniTutor-Notes-${subject.name}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/api/profile`, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(res.data);
    } catch {}
  };

  // Load chat history and profile on mount
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
    if (isYoung) fetchProfile();
  }, [subject.name, token, onLogout]);

  useEffect(() => {
    if (shouldScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollRef.current = false;
    }
  }, [history, status]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setImageBase64(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() && !imageBase64) return;
    
    const userQ = question || (imageBase64 ? 'Please scan this image and explain.' : '');
    setQuestion('');
    setStatus('processing');
    setErrorMsg('');
    
    // Create optimistic history entry — store image separately so it renders correctly
    const tempHistory = [...history, { 
      role: 'user', 
      content: userQ, 
      imagePreview: imageBase64 ? imagePreview : null,
      timestamp: new Date().toISOString() 
    }];
    shouldScrollRef.current = true;
    setHistory(tempHistory);
    
    const payloadImage = imageBase64;
    removeImage(); // clear image immediately from input

    
    try {
      const res = await axios.post(`${API}/api/query`, 
        { question: userQ, level: level.level, subject: subject.name, image_base64: payloadImage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.status === 'completed') {
        setStatus('idle');
        setHistory([...tempHistory, { 
          role: 'assistant', 
          content: res.data.answer, 
          model_used: res.data.model_used,
          timestamp: new Date().toISOString() 
        }]);
        if (isYoung) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#a78bfa','#ec4899','#fbbf24','#34d399'] });
          // Update profile optimistically
          if (res.data.xp_earned > 0) {
            setProfile(p => p ? { ...p, xp: res.data.new_xp, level: res.data.new_level, streak_count: res.data.streak_count } : p);
          }
          // Surface new badges
          if (res.data.new_badges?.length > 0) {
            onBadgesUnlocked(res.data.new_badges);
            fetchProfile(); // refresh full profile
          }
        }
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

  // XP bar for young levels
  const xpForCurrentLevel = profile ? (LEVEL_THRESHOLDS[profile.level - 1] || 0) : 0;
  const xpForNextLevel = profile ? (LEVEL_THRESHOLDS[profile.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) : 50;
  const xpProgress = profile ? Math.min(100, ((profile.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100) : 0;

  return (
    <div className="chat-page page">
      <div className="chat-header-card">
        <span className="chat-header-icon">{subject.icon}</span>
        <div className="chat-header-text"><h2>{subject.name}</h2><p>{level.name} · {level.desc}</p></div>
        {isYoung && profile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: 'auto', marginRight: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{LEVEL_NAMES[profile.level]}</span>
              <span style={{ color: 'var(--text-muted)' }}>{profile.xp} XP</span>
            </div>
            <div style={{ width: '140px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${xpProgress}%`, height: '100%', background: 'linear-gradient(90deg, #a78bfa, #ec4899)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
            </div>
            <button onClick={() => setShowTrophies(v => !v)} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>
              🏆 {profile.badges?.length || 0} Trophies
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: isYoung && profile ? '0.5rem' : 'auto', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button
              className="back-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }}
            >
              📥 Export
            </button>
            {showExportMenu && (
              <div className="export-dropdown glass-panel" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', padding: '0.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.25rem', zIndex: 100, minWidth: '160px'
              }}>
                <button onClick={exportPDF} style={{ background:'transparent', border:'none', color:'var(--text-main)', textAlign:'left', padding:'0.6rem 0.8rem', borderRadius:'6px', cursor:'pointer', fontWeight: 500 }} onMouseOver={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.target.style.background='transparent'}>📄 Save as PDF</button>
                <button onClick={exportWord} style={{ background:'transparent', border:'none', color:'var(--text-main)', textAlign:'left', padding:'0.6rem 0.8rem', borderRadius:'6px', cursor:'pointer', fontWeight: 500 }} onMouseOver={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.target.style.background='transparent'}>📝 Word (.doc)</button>
                <button onClick={exportMarkdown} style={{ background:'transparent', border:'none', color:'var(--text-main)', textAlign:'left', padding:'0.6rem 0.8rem', borderRadius:'6px', cursor:'pointer', fontWeight: 500 }} onMouseOver={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.target.style.background='transparent'}>⬇️ Markdown (.md)</button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }}></div>
                <button onClick={generateFlashcards} style={{ background:'transparent', border:'none', color:'#a78bfa', textAlign:'left', padding:'0.6rem 0.8rem', borderRadius:'6px', cursor:'pointer', fontWeight: 600 }} onMouseOver={e=>e.target.style.background='rgba(167,139,250,0.1)'} onMouseOut={e=>e.target.style.background='transparent'}>📇 Gen Flashcards</button>
              </div>
            )}
          </div>
          <button
            className="back-btn"
            onClick={onQuiz}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderColor: 'transparent', color: '#fff' }}
          >
            📝 Test
          </button>
          <button className="back-btn" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* Trophies Panel */}
      {showTrophies && isYoung && profile && (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ width: '100%', fontWeight: 700, marginBottom: '0.25rem' }}>🏆 My Trophies</div>
          {Object.entries(BADGE_META).map(([id, b]) => {
            const earned = profile.badges?.some(bk => bk.id === id);
            return (
              <div key={id} style={{ background: earned ? '#fbbf2422' : 'rgba(255,255,255,0.03)', border: `1px solid ${earned ? '#fbbf2466' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', padding: '0.6rem 1rem', opacity: earned ? 1 : 0.4 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{b.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="chat-container glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
        
        <div className="chat-history" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {history.length === 0 && status === 'idle' && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
              <span style={{ fontSize: '3rem', opacity: 0.5 }}>{subject.icon}</span>
              <p>No questions asked yet. Start the conversation!</p>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className="message" style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'rgba(34, 211, 238, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: msg.role === 'user' ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1rem',
              borderRadius: '12px',
              maxWidth: '85%',
              width: msg.role === 'assistant' ? '100%' : 'auto',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {msg.role === 'user' ? 'You' : 'OmniTutor'}
                {msg.role === 'assistant' && msg.model_used && (
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '1px 7px',
                    borderRadius: '99px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    background: msg.model_used.includes('mini') ? 'rgba(52, 211, 153, 0.15)' 
                              : msg.model_used.includes('gpt-4o') ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(251, 191, 36, 0.15)',
                    color: msg.model_used.includes('mini') ? '#34d399'
                         : msg.model_used.includes('gpt-4o') ? '#818cf8'
                         : '#fbbf24',
                    border: `1px solid ${msg.model_used.includes('mini') ? '#34d39933' : msg.model_used.includes('gpt-4o') ? '#818cf833' : '#fbbf2433'}`,
                    textTransform: 'none',
                  }}>
                    {msg.model_used.includes('mini') ? '⚡ Fast' 
                   : msg.model_used.includes('gpt-4o') ? '👁️ Vision'
                   : '🧠 Power'}
                  </span>
                )}
                {msg.role === 'assistant' && <CopyButton text={msg.content} />}
              </div>
              {/* Show uploaded image if present */}
              {msg.imagePreview && (
                <img 
                  src={msg.imagePreview} 
                  alt="Uploaded question" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '300px', 
                    borderRadius: '8px', 
                    marginBottom: msg.content ? '0.75rem' : 0,
                    display: 'block',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }} 
                />
              )}
              {msg.content && (
                <div className="markdown-body" style={{ margin: 0 }}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                </div>
              )}
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
          {imagePreview && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.5rem' }}>
              <img src={imagePreview} alt="Upload preview" style={{ height: '80px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <button type="button" onClick={removeImage} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0.5rem', position: 'relative' }}>
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
            <button type="button" className={`mic-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording} style={{
              position: 'absolute', right: '1.5rem', bottom: '1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              width: '40px', height: '40px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', zIndex: 10
            }}>
              🎙️
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} id="image-upload" />
              <label htmlFor="image-upload" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                📎 Attach Image
              </label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Press Enter to send, Shift+Enter for new line</span>
            </div>
            <button className="btn-submit" disabled={status === 'processing' || (!question.trim() && !imageBase64)} style={{ margin: 0, padding: '0.8rem 2rem', width: 'auto' }}>
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
    { label: 'Finance',     icon: '💰', color: '#34d399', value: stats.questions.finance },
    { label: 'Coding',      icon: '💻', color: '#ec4899', value: stats.questions.coding || 0 },
    { label: 'Agriculture', icon: '🌾', color: '#bef264', value: stats.questions.agriculture || 0 },
    { label: 'Law',         icon: '⚖️', color: '#f87171', value: stats.questions.law || 0 },
    { label: 'Homework',    icon: '📝', color: '#fb923c', value: stats.questions.homework || 0 },
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
              <div className="kpi-value">8</div>
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
/* ─── Quiz Component ─────────────────────────────────────────────── */
const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUIZ_TYPES = [
  { id: 'mcq',        label: 'Multiple Choice', icon: '🔘' },
  { id: 'true_false', label: 'True / False',    icon: '✅' },
  { id: 'fill_blank', label: 'Fill in Blank',   icon: '✏️' },
  { id: 'mixed',      label: 'Mixed',           icon: '🌀' },
];
const QUIZ_COUNTS = [5, 10, 15, 20];

function Quiz({ subject, level, token, onBack, onBadgesUnlocked }) {
  const [phase, setPhase] = useState('setup');   // setup | loading | question | results
  const [topic, setTopic] = useState('');
  const [quizType, setQuizType] = useState('mcq');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);     // user's answers array
  const [selected, setSelected]   = useState(null);
  const [fillInput, setFillInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [timer, setTimer] = useState(30);
  const [results, setResults] = useState(null);
  const [loadErr, setLoadErr] = useState('');

  // Timer logic
  useEffect(() => {
    if (phase !== 'question' || showFeedback) return;
    if (timer <= 0) { handleAnswer(null); return; }
    const t = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, phase, showFeedback]);

  const startQuiz = async () => {
    if (!topic.trim()) return;
    setPhase('loading');
    setLoadErr('');
    try {
      const res = await axios.post(`${API}/api/quiz/generate`, {
        subject: subject.name, topic, quiz_type: quizType, count, difficulty, level: level.level
      }, { headers: { Authorization: `Bearer ${token}` } });
      setQuestions(res.data.questions);
      setAnswers([]);
      setCurrentIdx(0);
      setSelected(null);
      setFillInput('');
      setShowFeedback(false);
      setTimer(30);
      setPhase('question');
    } catch (e) {
      setLoadErr('Failed to generate quiz. Please try again.');
      setPhase('setup');
    }
  };

  const handleAnswer = (ans) => {
    if (showFeedback) return;
    const finalAns = ans !== undefined ? ans : selected;
    setAnswers(prev => [...prev, finalAns]);
    setShowFeedback(true);
  };

  const isCorrect = (q, ans) => {
    if (ans === null || ans === undefined) return false;
    if (q.type === 'fill_blank') return String(ans).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
    if (q.type === 'true_false') return String(ans).toLowerCase() === String(q.correct).toLowerCase();
    return String(ans) === String(q.correct);
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= questions.length) {
      submitQuiz([...answers]);
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setFillInput('');
      setShowFeedback(false);
      setTimer(30);
    }
  };

  const submitQuiz = async (finalAnswers) => {
    try {
      const res = await axios.post(`${API}/api/quiz/submit`, {
        subject: subject.name, topic, quiz_type: quizType, difficulty,
        questions, answers: finalAnswers
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResults(res.data);
      setPhase('results');
      if (res.data.new_badges?.length > 0) onBadgesUnlocked(res.data.new_badges);
      if (res.data.percentage >= 80) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#fbbf24','#34d399','#a78bfa','#ec4899'] });
      }
    } catch { setResults({ score: 0, total: questions.length, percentage: 0, xp_earned: 0 }); setPhase('results'); }
  };

  const resetQuiz = () => { setPhase('setup'); setResults(null); setQuestions([]); setAnswers([]); };

  const q = questions[currentIdx];
  const getRank = (pct) => pct >= 90 ? { label: 'Excellent!', icon: '🥇', color: '#fbbf24' } : pct >= 70 ? { label: 'Good Job!', icon: '🥈', color: '#d1d5db' } : { label: 'Keep Going!', icon: '🥉', color: '#cd7c32' };

  return (
    <div className="chat-page page">
      {/* Header */}
      <div className="chat-header-card">
        <span className="chat-header-icon">📝</span>
        <div className="chat-header-text"><h2>Test Mode</h2><p>{subject.name} · {level.name}</p></div>
        <button className="back-btn" onClick={onBack} style={{ marginLeft: 'auto' }}>← Back to Chat</button>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto', width: '100%' }}>

        {/* ── SETUP ── */}
        {phase === 'setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>🏆</div>
              <h2 style={{ margin: '0.5rem 0 0.25rem' }}>Create Your Quiz</h2>
              <p style={{ color: 'var(--text-muted)' }}>Choose a topic and customise your test</p>
            </div>

            {loadErr && <div style={{ background: '#ef444433', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px' }}>{loadErr}</div>}

            <div className="form-group">
              <label>Topic / Chapter</label>
              <input className="input-field" placeholder={`e.g. Algebra, Photosynthesis, IFRS 16…`}
                value={topic} onChange={e => setTopic(e.target.value)}
                style={{ minHeight: '40px', padding: '0.8rem' }} />
            </div>

            <div className="form-group">
              <label>Question Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
                {QUIZ_TYPES.map(t => (
                  <button key={t.id} onClick={() => setQuizType(t.id)} style={{
                    padding: '0.75rem', borderRadius: '10px', cursor: 'pointer', border: '1px solid',
                    borderColor: quizType === t.id ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                    background: quizType === t.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                    color: quizType === t.id ? '#a78bfa' : 'var(--text-muted)', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}>{t.icon} {t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Number of Questions</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {QUIZ_COUNTS.map(n => (
                    <button key={n} onClick={() => setCount(n)} style={{
                      padding: '0.4rem 1rem', borderRadius: '99px', cursor: 'pointer', border: '1px solid',
                      borderColor: count === n ? '#22d3ee' : 'rgba(255,255,255,0.1)',
                      background: count === n ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)',
                      color: count === n ? '#22d3ee' : 'var(--text-muted)', fontWeight: 600,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {QUIZ_DIFFICULTIES.map(d => {
                    const col = d === 'easy' ? '#34d399' : d === 'medium' ? '#fbbf24' : '#f87171';
                    return (
                      <button key={d} onClick={() => setDifficulty(d)} style={{
                        padding: '0.4rem 0.85rem', borderRadius: '99px', cursor: 'pointer', border: '1px solid', textTransform: 'capitalize',
                        borderColor: difficulty === d ? col : 'rgba(255,255,255,0.1)',
                        background: difficulty === d ? `${col}22` : 'rgba(255,255,255,0.03)',
                        color: difficulty === d ? col : 'var(--text-muted)', fontWeight: 600,
                      }}>{d}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button className="btn-submit" onClick={startQuiz} disabled={!topic.trim()}
              style={{ marginTop: '0.5rem', opacity: !topic.trim() ? 0.5 : 1 }}>
              🚀 Start Quiz
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="loader"><div className="spinner-ring" style={{ width: '48px', height: '48px', borderWidth: '3px' }} /></div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Generating your {count} questions on <strong>{topic}</strong>…</p>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === 'question' && q && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Progress + Timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Question {currentIdx + 1} of {questions.length}</span>
              <span style={{
                fontSize: '1.1rem', fontWeight: 700,
                color: timer <= 10 ? '#f87171' : timer <= 20 ? '#fbbf24' : '#34d399',
                transition: 'color 0.3s'
              }}>⏱ {timer}s</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${((currentIdx) / questions.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#a78bfa,#ec4899)', transition: 'width 0.4s' }} />
            </div>

            {/* Question */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.25rem' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{q.question}</p>
            </div>

            {/* MCQ options */}
            {(q.type === 'mcq') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {q.options.map((opt, i) => {
                  let bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.1)', color = 'inherit';
                  if (showFeedback) {
                    if (i === q.correct) { bg = 'rgba(52,211,153,0.15)'; border = '#34d399'; color = '#34d399'; }
                    else if (i === selected && i !== q.correct) { bg = 'rgba(248,113,113,0.15)'; border = '#f87171'; color = '#f87171'; }
                  } else if (selected === i) { bg = 'rgba(167,139,250,0.15)'; border = '#a78bfa'; color = '#a78bfa'; }
                  return (
                    <button key={i} onClick={() => !showFeedback && setSelected(i)} style={{
                      padding: '0.85rem 1rem', borderRadius: '10px', border: `1px solid ${border}`, background: bg, color,
                      textAlign: 'left', cursor: showFeedback ? 'default' : 'pointer', fontWeight: 500, transition: 'all 0.2s',
                    }}>
                      <span style={{ fontWeight: 700, marginRight: '0.6rem' }}>{['A','B','C','D'][i]}.</span>{opt}
                      {showFeedback && i === q.correct && <span style={{ float: 'right' }}>✅</span>}
                      {showFeedback && i === selected && i !== q.correct && <span style={{ float: 'right' }}>❌</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* True / False */}
            {q.type === 'true_false' && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                {['true','false'].map(val => {
                  const isCorrectVal = String(q.correct).toLowerCase() === val;
                  let bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.1)', color = 'inherit';
                  if (showFeedback) {
                    if (isCorrectVal) { bg = 'rgba(52,211,153,0.15)'; border = '#34d399'; color = '#34d399'; }
                    else if (selected === val && !isCorrectVal) { bg = 'rgba(248,113,113,0.15)'; border = '#f87171'; color = '#f87171'; }
                  } else if (selected === val) { bg = 'rgba(167,139,250,0.15)'; border = '#a78bfa'; color = '#a78bfa'; }
                  return (
                    <button key={val} onClick={() => !showFeedback && setSelected(val)} style={{
                      flex: 1, padding: '1rem', borderRadius: '10px', border: `1px solid ${border}`, background: bg,
                      color, fontWeight: 700, fontSize: '1.1rem', cursor: showFeedback ? 'default' : 'pointer', transition: 'all 0.2s',
                    }}>
                      {val === 'true' ? '✅ True' : '❌ False'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Fill in blank */}
            {q.type === 'fill_blank' && (
              <div>
                <input className="input-field" placeholder="Type your answer…"
                  value={fillInput} onChange={e => setFillInput(e.target.value)}
                  disabled={showFeedback}
                  style={{ minHeight: '44px', padding: '0.8rem',
                    borderColor: showFeedback ? (isCorrect(q, fillInput) ? '#34d399' : '#f87171') : undefined }}
                />
                {showFeedback && (
                  <p style={{ marginTop: '0.5rem', color: isCorrect(q, fillInput) ? '#34d399' : '#f87171', fontWeight: 600 }}>
                    {isCorrect(q, fillInput) ? '✅ Correct!' : `❌ Correct answer: "${q.correct}"`}
                  </p>
                )}
              </div>
            )}

            {/* Explanation (shown after answering) */}
            {showFeedback && (
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '1rem' }}>
                <p style={{ margin: 0, color: '#a5b4fc' }}><strong>💡 Explanation:</strong> {q.explanation}</p>
              </div>
            )}

            {/* Action buttons */}
            {!showFeedback ? (
              <button className="btn-submit" onClick={() => handleAnswer(q.type === 'fill_blank' ? fillInput : selected)}
                disabled={selected === null && !fillInput.trim()}>
                Submit Answer
              </button>
            ) : (
              <button className="btn-submit" onClick={nextQuestion}>
                {currentIdx + 1 >= questions.length ? '📊 View Results' : 'Next Question →'}
              </button>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && results && (() => {
          const rank = getRank(results.percentage);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '4rem' }}>{rank.icon}</div>
                <h2 style={{ color: rank.color, margin: '0.5rem 0 0.25rem' }}>{rank.label}</h2>
                <p style={{ color: 'var(--text-muted)' }}>{topic} · {difficulty}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                {[
                  { label: 'Score', value: `${results.score}/${results.total}`, color: rank.color },
                  { label: 'Accuracy', value: `${results.percentage}%`, color: results.percentage >= 80 ? '#34d399' : '#fbbf24' },
                  { label: 'XP Earned', value: `+${results.xp_earned}`, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Per-question review */}
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {questions.map((q, i) => {
                  const correct = isCorrect(q, answers[i]);
                  return (
                    <div key={i} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid',
                      borderColor: correct ? '#34d39933' : '#f8717133',
                      background: correct ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <span>{correct ? '✅' : '❌'}</span>
                        <span style={{ fontSize: '0.9rem' }}>{q.question}</span>
                      </div>
                      {!correct && <p style={{ margin: '0.4rem 0 0 1.6rem', fontSize: '0.8rem', color: '#34d399' }}>Correct: {Array.isArray(q.options) ? q.options[q.correct] : String(q.correct)}</p>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-submit" onClick={resetQuiz} style={{ flex: 1 }}>🔄 New Quiz</button>
                <button className="btn-submit" onClick={onBack}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  ← Back to Chat
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // gamification profile
  const [badgePopup, setBadgePopup] = useState([]); // badges to show in popup
  const [view, setView] = useState('dashboard');
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);

  // Fetch gamification profile whenever token changes
  const fetchGameProfile = async (tkn) => {
    try {
      const res = await axios.get(`${API}/api/profile`, { headers: { Authorization: `Bearer ${tkn}` } });
      setProfile(res.data);
    } catch {}
  };

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
      fetchGameProfile(token);
    } else {
      setUser(null);
      setProfile(null);
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

  const goHome       = () => navigate(token ? 'dashboard' : 'auth');
  const pickSubject  = (s) => navigate('classSelector', s, null);
  const pickLevel    = (l) => navigate('chat', subject, l);
  const backToClasses = () => navigate('classSelector', subject, null);
  const goToQuiz     = () => navigate('quiz', subject, level);
  const backToChat   = () => navigate('chat', subject, level);
  const openStats    = () => navigate(view === 'stats' ? (token ? 'dashboard' : 'auth') : 'stats', subject, level);
  const openAdmin    = () => navigate(view === 'admin' ? 'dashboard' : 'admin', subject, level);
  const openFlashcards = () => navigate('flashcards', subject, level);
  
  const navigateToChat = (subjectName, levelName) => {
    const s = SUBJECTS.find(sub => sub.name === subjectName);
    if (!s) return;
    let foundLevel = null;
    for (const tier of TIERS) {
      const l = tier.classes.find(c => c.name === levelName);
      if (l) { foundLevel = l; break; }
    }
    if (foundLevel) {
      navigate('chat', s, foundLevel);
    }
  };
  
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
      <BadgePopup badges={badgePopup} onClose={() => setBadgePopup([])} />
      <div className="app">
        <Nav view={view} subject={subject} level={level} onLogoClick={goHome} onStats={openStats} onAdmin={openAdmin} onLogout={handleLogout} user={user} profile={profile} />
        
        {view === 'auth' && !token && <Auth onAuthSuccess={handleAuthSuccess} />}
        
        {view === 'dashboard'     && token && <Dashboard onSelect={pickSubject} onViewFlashcards={openFlashcards} />}
        {view === 'flashcards'    && token && <FlashcardsDashboard token={token} onBack={goHome} onGoToChat={navigateToChat} />}
        {view === 'classSelector' && token && subject && <ClassSelector subject={subject} onSelect={pickLevel} onBack={goHome} />}
        {view === 'chat'          && token && subject && level && <Chat subject={subject} level={level} token={token} onBack={backToClasses} onLogout={handleLogout} onBadgesUnlocked={setBadgePopup} onQuiz={goToQuiz} onViewFlashcards={openFlashcards} />}
        {view === 'quiz'          && token && subject && level && <Quiz subject={subject} level={level} token={token} onBack={backToChat} onBadgesUnlocked={setBadgePopup} />}
        
        {view === 'stats'         && <StatsDashboard onBack={goHome} />}
        {view === 'admin'         && token && user?.is_admin && <AdminDashboard onBack={goHome} token={token} />}
      </div>
    </>
  );
}
