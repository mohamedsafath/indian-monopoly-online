/**
 * frontend/src/pages/AdminDashboard.jsx
 *
 * Admin Dashboard page for Monopoly India.
 * Restricted to seeded administrator emails (sameer@gmail.com, safath@gmail.com).
 * Theme: Indian Festive Luxury (deep dark-jeweled theme, gold/amber accents).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorFooter from '../components/CreatorFooter';

// ── Decorative Ornamental Border ───────────────────────────────────────────
function OrnamentalBorder({ className = '' }) {
  return (
    <svg viewBox="0 0 400 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="12" x2="400" y2="12" stroke="url(#gl-admin)" strokeWidth="1" />
      <circle cx="200" cy="12" r="6" stroke="#d4af37" strokeWidth="1.5" fill="none" />
      <circle cx="200" cy="12" r="2" fill="#d4af37" />
      <circle cx="180" cy="12" r="3" stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="220" cy="12" r="3" stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="164" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <circle cx="236" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <polygon points="200,4 204,8 200,12 196,8" fill="#d4af37" opacity="0.35" />
      <defs>
        <linearGradient id="gl-admin" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0" />
          <stop offset="30%" stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Tabs: 'metrics' | 'rooms' | 'players' | 'feedback'
  const [activeTab, setActiveTab] = useState('metrics');

  // Metrics states
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState('');

  // Players states
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  // Feedback states
  const [feedbackList, setFeedbackList] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackFilterCategory, setFeedbackFilterCategory] = useState('All');
  const [feedbackFilterRating, setFeedbackFilterRating] = useState('All');

  // Broadcast states
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');

  // Force close state
  const [actionLoading, setActionLoading] = useState(null);

  // Quick broadcasts suggestions
  const QUICK_ALERTS = [
    "Server restarting for system updates in 5 minutes.",
    "Database maintenance completed successfully.",
    "Welcome to Monopoly India! Enjoy the special deals!",
    "⚠️ Network latency observed. Sockets are auto-reconnecting."
  ];

  // Check admin authorization
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mi_google_user');
      if (stored) {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        const email = (user.email || '').trim().toLowerCase();
        const adminEmailsVar = import.meta.env.VITE_ADMIN_EMAILS || "msafath2004@gmail.com,mariannesruthi@gmail.com";
        const adminEmails = adminEmailsVar.split(',').map(e => e.trim().toLowerCase());
        if (adminEmails.includes(email)) {
          setIsAdminUser(true);
        } else {
          navigate('/home');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      navigate('/');
    } finally {
      setLoadingAuth(false);
    }
  }, [navigate]);

  // Fetch server metrics & rooms
  const fetchMetrics = async (showLoader = false) => {
    if (!currentUser) return;
    if (showLoader) setLoadingMetrics(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/admin/metrics`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || 'SafathSruthiAdminSecret2026!'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load metrics');
      setMetrics(data.metrics);
      setMetricsError('');
    } catch (err) {
      setMetricsError(err.message);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Fetch feedback records
  const fetchFeedback = async () => {
    if (!currentUser) return;
    setLoadingFeedback(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/admin/feedback`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || 'SafathSruthiAdminSecret2026!'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load feedback');
      setFeedbackList(data.feedbacks || []);
      setFeedbackError('');
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setLoadingFeedback(false);
    }
  };

  // Fetch players directory
  const fetchPlayers = async () => {
    if (!currentUser) return;
    setLoadingPlayers(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/admin/players`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || 'SafathSruthiAdminSecret2026!'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load players');
      setPlayers(data.players || []);
      setPlayersError('');
    } catch (err) {
      setPlayersError(err.message);
    } finally {
      setLoadingPlayers(false);
    }
  };

  // Poll server metrics
  useEffect(() => {
    if (!isAdminUser || !currentUser) return;
    fetchMetrics(true);
    const interval = setInterval(() => fetchMetrics(false), 5000);
    return () => clearInterval(interval);
  }, [isAdminUser, currentUser]);

  // Load specific tab data on activation
  useEffect(() => {
    if (!isAdminUser || !currentUser) return;
    if (activeTab === 'feedback') {
      fetchFeedback();
    } else if (activeTab === 'players') {
      fetchPlayers();
    }
  }, [activeTab, isAdminUser, currentUser]);

  // Handle global system alert broadcast
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setBroadcastLoading(true);
    setBroadcastSuccess(false);
    setBroadcastError('');
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || 'SafathSruthiAdminSecret2026!'
        },
        body: JSON.stringify({ message: broadcastMessage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to broadcast alert');
      setBroadcastSuccess(true);
      setBroadcastMessage('');
      setTimeout(() => setBroadcastSuccess(false), 4000);
    } catch (err) {
      setBroadcastError(err.message);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Handle force evicting rooms
  const handleForceClose = async (roomCode) => {
    if (!window.confirm(`Are you sure you want to FORCE CLOSE room ${roomCode}? This immediately disconnects all players.`)) {
      return;
    }
    setActionLoading(roomCode);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/admin/force-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || 'SafathSruthiAdminSecret2026!'
        },
        body: JSON.stringify({ roomCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to force close room');
      await fetchMetrics(false);
    } catch (err) {
      alert(`Error closing room: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Format CPU/RAM / Uptime metrics helpers
  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const formatMemory = (bytes) => {
    if (!bytes) return 'N/A';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Feedback analysis and filters
  const feedbackStats = useMemo(() => {
    if (feedbackList.length === 0) return { avg: 0, count: 0, breakdown: {}, counts: {} };
    let sum = 0;
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const counts = {};
    feedbackList.forEach(f => {
      sum += f.rating;
      breakdown[f.rating] = (breakdown[f.rating] || 0) + 1;
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return {
      avg: (sum / feedbackList.length).toFixed(1),
      count: feedbackList.length,
      breakdown,
      counts
    };
  }, [feedbackList]);

  const filteredFeedbacks = useMemo(() => {
    return feedbackList.filter(f => {
      const matchesCat = feedbackFilterCategory === 'All' || f.category === feedbackFilterCategory;
      const matchesRating = feedbackFilterRating === 'All' || f.rating === Number(feedbackFilterRating);
      return matchesCat && matchesRating;
    });
  }, [feedbackList, feedbackFilterCategory, feedbackFilterRating]);

  // Search filtered players registry
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    const query = playerSearch.toLowerCase();
    return players.filter(p => 
      (p.username || '').toLowerCase().includes(query) || 
      (p.email || '').toLowerCase().includes(query) ||
      (p.playerId || '').toLowerCase().includes(query)
    );
  }, [players, playerSearch]);

  if (loadingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#040409',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, animation: 'pulse 1.5s infinite', marginBottom: 16 }}>👑</div>
          <p style={{ color: '#d4af37', fontWeight: 600, letterSpacing: '0.05em' }}>VERIFYING ADMINISTRATOR PRIVILEGES...</p>
        </div>
      </div>
    );
  }

  if (!isAdminUser) return null; // Safe guard

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060e',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.05) 0%, rgba(6, 6, 14, 0) 60%)',
      color: '#cbd5e1',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px 16px 64px 16px',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* ── HEADER ── */}
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>👑</span>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#fde68a',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: 0,
              fontFamily: "'Playfair Display', serif"
            }}>
              MONOPOLY INDIA SYSTEM ADMIN
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px 0' }}>
            Registered Administrator Profile: <strong style={{ color: '#f59e0b' }}>{currentUser?.email}</strong>
          </p>
          <OrnamentalBorder style={{ width: '100%', maxWidth: 360, margin: '0 auto' }} />
        </header>

        {/* ── BACK TO LOBBY BUTTON ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              color: '#fbbf24',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
          >
            🚪 Return to Game Lobby
          </button>
          
          <button
            onClick={() => {
              if (activeTab === 'metrics') fetchMetrics(true);
              else if (activeTab === 'players') fetchPlayers();
              else if (activeTab === 'feedback') fetchFeedback();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
          >
            🔄 Refresh Data
          </button>
        </div>

        {/* ── TABS NAVIGATION ── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          gap: 4,
          marginBottom: 32,
          overflowX: 'auto',
          paddingBottom: 2
        }}>
          {[
            { id: 'metrics', label: '📊 Metrics & Alerts', activeColor: '#fbbf24' },
            { id: 'rooms', label: `🎮 Active Rooms (${metrics?.rooms?.length || 0})`, activeColor: '#10b981' },
            { id: 'players', label: '👥 Player Directory', activeColor: '#6366f1' },
            { id: 'feedback', label: `💬 Feedback & Feed (${feedbackList.length})`, activeColor: '#ec4899' }
          ].map((t) => {
            const isSel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '12px 20px',
                  background: isSel ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  border: 'none',
                  borderBottom: isSel ? `3px solid ${t.activeColor}` : '3px solid transparent',
                  color: isSel ? '#ffffff' : '#94a3b8',
                  fontSize: 13,
                  fontWeight: isSel ? 800 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  borderRadius: '6px 6px 0 0'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ── */}

        {/* 1. METRICS & ALERTS TAB */}
        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Metrics Grid */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                📈 Real-time Server Stats
              </h2>
              {loadingMetrics && !metrics ? (
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Querying server nodes...</p>
              ) : metricsError ? (
                <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                  ⚠️ Error connecting backend: {metricsError}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {/* Connected Sockets */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20,
                    position: 'relative'
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Connected Sockets</span>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: '8px 0' }}>
                      {metrics.socketsCount}
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: '#34d399',
                      fontWeight: 600
                    }}>
                      <span className="blink-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      Active WebSockets
                    </span>
                  </div>

                  {/* Active Rooms */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Active Game Rooms</span>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', margin: '8px 0' }}>
                      {metrics.rooms?.length || 0}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
                      <span>Lobbies: <strong style={{ color: '#fff' }}>{metrics.lobbiesCount}</strong></span>
                      <span>Playing: <strong style={{ color: '#34d399' }}>{metrics.gamesCount}</strong></span>
                    </div>
                  </div>

                  {/* Online Human Players */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Human Players Online</span>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#38bdf8', margin: '8px 0' }}>
                      {metrics.onlinePlayersCount ?? 0}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Total connected players</span>
                  </div>

                  {/* Players in Gameplay */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Players in Gameplay</span>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', margin: '8px 0' }}>
                      {metrics.playingPlayersCount ?? 0}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>In active matches</span>
                  </div>

                  {/* Completed Games */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Finished Games</span>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#ec4899', margin: '8px 0' }}>
                      {metrics.finishedGamesCount ?? 0}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Saved completed matches</span>
                  </div>

                  {/* Uptime */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>NodeJS Uptime</span>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24', margin: '14px 0 12px 0', fontFamily: 'monospace' }}>
                      {formatUptime(metrics.uptime)}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Continuous server runtime</span>
                  </div>

                  {/* DB Connections */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Database Status</span>
                    <div style={{ fontSize: 20, fontWeight: 900, color: metrics.dbStatus === 'connected' ? '#34d399' : '#fbbf24', margin: '16px 0 12px 0', textTransform: 'uppercase' }}>
                      {metrics.dbStatus === 'connected' ? 'MongoDB Active' : 'Memory Fallback'}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {metrics.dbStatus === 'connected' ? 'Cloud persistent collections' : 'Auto JSON serialization'}
                    </span>
                  </div>

                  {/* RAM footprint */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    padding: 20
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Memory footprint</span>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '14px 0 12px 0', fontFamily: 'monospace' }}>
                      {formatMemory(metrics.memoryUsage?.heapUsed)}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Allocated total: {formatMemory(metrics.memoryUsage?.heapTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Broadcast Form */}
            <div style={{
              background: 'rgba(18, 18, 30, 0.6)',
              border: '1.5px solid rgba(212, 175, 55, 0.2)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fde68a', fontFamily: "'Playfair Display', serif", margin: '0 0 6px 0' }}>
                📢 Broadcast Global System Banner
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px 0' }}>
                This broadcasts a real-time, flashing alert message directly into all active game rooms and match lobbies for all connected clients.
              </p>

              <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <textarea
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="Enter announcement text (e.g. Server restarting in 5 minutes for routine patches...)"
                    maxLength={200}
                    rows={3}
                    disabled={broadcastLoading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(212, 175, 55, 0.25)',
                      color: '#fff',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Predefined prompts */}
                <div>
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>
                    Quick presets (Click to load)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {QUICK_ALERTS.map((alertText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setBroadcastMessage(alertText)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 20,
                          padding: '6px 12px',
                          color: '#cbd5e1',
                          fontSize: 11,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(212,175,55,0.3)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
                      >
                        {alertText}
                      </button>
                    ))}
                  </div>
                </div>

                {broadcastError && (
                  <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>⚠️ {broadcastError}</p>
                )}

                {broadcastSuccess && (
                  <p style={{ fontSize: 12, color: '#34d399', margin: 0, fontWeight: 700 }}>✅ Announcement sent successfully to all live user sessions!</p>
                )}

                <button
                  type="submit"
                  disabled={broadcastLoading || !broadcastMessage.trim()}
                  style={{
                    padding: '12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    border: 'none',
                    background: broadcastLoading || !broadcastMessage.trim()
                      ? 'rgba(180,83,9,0.2)'
                      : 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)',
                    color: '#06060e',
                    boxShadow: !broadcastMessage.trim() ? 'none' : '0 4px 15px rgba(245,158,11,0.25)',
                    transition: 'all 0.2s',
                    width: 'fit-content'
                  }}
                >
                  {broadcastLoading ? 'Broadcasting...' : '📢 Send Broadcast Alert'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2. ACTIVE ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
              🎮 Live Match Rooms
            </h2>
            {!metrics?.rooms || metrics.rooms.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'rgba(15, 23, 42, 0.2)',
                border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: 16
              }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>🎲</span>
                <h3 style={{ fontSize: 14, color: '#e2e8f0', margin: '0 0 6px 0' }}>No Live Sessions Running</h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Create a room using a guest or player profile to inspect in real-time.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {metrics.rooms.map((room) => {
                  const isPlaying = room.status === 'playing';
                  return (
                    <div
                      key={room.code}
                      style={{
                        background: 'rgba(18, 18, 30, 0.65)',
                        border: isPlaying ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(212, 175, 55, 0.2)',
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 16
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: '#fff',
                            letterSpacing: '0.05em',
                            fontFamily: 'monospace'
                          }}>{room.code}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '4px 8px',
                            borderRadius: 12,
                            background: isPlaying ? 'rgba(16, 185, 129, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                            color: isPlaying ? '#34d399' : '#fbbf24',
                            border: isPlaying ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(217,119,6,0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {isPlaying && <span className="blink-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />}
                            {room.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Room Host:</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{room.host}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Players Joined:</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{room.playerCount} / 6</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Spectators:</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{room.spectatorCount}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Room Age:</span>
                            <span style={{ color: '#f59e0b', fontWeight: 600, fontFamily: 'monospace' }}>
                              {formatUptime(Math.max(0, Math.floor((Date.now() - room.createdAt) / 1000)))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleForceClose(room.code)}
                          disabled={actionLoading === room.code}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: 8,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { if (actionLoading !== room.code) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                          onMouseLeave={e => { if (actionLoading !== room.code) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                        >
                          {actionLoading === room.code ? 'Evicting...' : '🛑 Force Close'}
                        </button>

                        <button
                          onClick={() => {
                            if (isPlaying) {
                              navigate(`/game/${room.code}?spectate=true`);
                            } else {
                              navigate(`/lobby/${room.code}?spectate=true`);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            color: '#fde68a',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        >
                          👁️ Spectate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. PLAYER REGISTRY TAB */}
        {activeTab === 'players' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', mdDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                👥 Registered Users Registry
              </h2>
              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search registered accounts by username or email..."
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  maxWidth: 320,
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {loadingPlayers && players.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading player directory...</p>
            ) : playersError ? (
              <p style={{ fontSize: 13, color: '#f87171' }}>⚠️ Error: {playersError}</p>
            ) : filteredPlayers.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>No user records match the search query.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700 }}>Profile</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700 }}>Email Address</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Level</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Wins / Games</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>Win Rate</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700 }}>Lifetime NetWorth</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => {
                      const winRate = player.games > 0 ? ((player.wins / player.games) * 100).toFixed(0) : '0';
                      return (
                        <tr key={player.playerId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                              src={player.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${player.username}`}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}
                            />
                            <span style={{ fontWeight: 700, color: '#fff' }}>{player.username}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{player.email}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              background: 'rgba(212,175,55,0.15)',
                              border: '1.5px solid #d4af37',
                              color: '#fbbf24',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 800
                            }}>
                              Lvl {player.level || 1}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#cbd5e1' }}>
                            <strong style={{ color: '#34d399' }}>{player.wins || 0}</strong> / {player.games || 0}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#34d399' }}>
                            {winRate}%
                          </td>
                          <td style={{ padding: '12px 16px', color: '#cbd5e1', fontWeight: 700 }}>
                            ₹{(player.totalNetWorthEarned || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => navigate(`/profile/${player.playerId}`)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#cbd5e1',
                                fontSize: 11,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.border = '1px solid #d4af37'}
                              onMouseLeave={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'}
                            >
                              Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. FEEDBACK FEED TAB */}
        {activeTab === 'feedback' && (
          <div>
            {/* Feedback Stats Dashboard Card */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.25)',
              border: '1px solid rgba(212, 175, 55, 0.15)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 32,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              alignItems: 'center'
            }}>
              {/* Avg Rating Big Card */}
              <div style={{ minWidth: 160, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: 24 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Average Rating
                </span>
                <span style={{ fontSize: 48, fontWeight: 900, color: '#fbbf24', display: 'block', lineHeight: 1 }}>
                  {feedbackStats.avg}
                </span>
                <div style={{ color: '#fbbf24', fontSize: 18, margin: '4px 0' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < Math.round(Number(feedbackStats.avg)) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>based on {feedbackStats.count} reviews</span>
              </div>

              {/* Category Breakdown */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                  Reviews Count by Category
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {['Gameplay Rules', 'AI Bots Balance', 'UI/UX Design', 'Connection & Sockets', 'Other'].map(cat => {
                    const count = feedbackStats.counts[cat] || 0;
                    const pct = feedbackStats.count > 0 ? ((count / feedbackStats.count) * 100).toFixed(0) : '0';
                    return (
                      <div key={cat} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 11, color: '#cbd5e1', display: 'block' }}>{cat}</span>
                          <span style={{ fontSize: 9, color: '#64748b' }}>{pct}% of reviews</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>Filter Reviews:</span>
              
              {/* Category Filter */}
              <select
                value={feedbackFilterCategory}
                onChange={e => setFeedbackFilterCategory(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="All">All Categories</option>
                <option value="Gameplay Rules">Gameplay Rules</option>
                <option value="AI Bots Balance">AI Bots Balance</option>
                <option value="UI/UX Design">UI/UX Design</option>
                <option value="Connection & Sockets">Connection & Sockets</option>
                <option value="Other">Other</option>
              </select>

              {/* Rating Filter */}
              <select
                value={feedbackFilterRating}
                onChange={e => setFeedbackFilterRating(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="All">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            {/* Feedback Feed */}
            {loadingFeedback && feedbackList.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading submitted reviews...</p>
            ) : feedbackError ? (
              <p style={{ fontSize: 13, color: '#f87171' }}>⚠️ Error: {feedbackError}</p>
            ) : filteredFeedbacks.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', background: 'rgba(15, 23, 42, 0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>No reviews matched the current filter conditions.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredFeedbacks.map((f, idx) => (
                  <div
                    key={f.feedbackId || idx}
                    style={{
                      background: 'rgba(15, 23, 42, 0.25)',
                      border: '1.5px solid rgba(212, 175, 55, 0.15)',
                      borderRadius: 14,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Rating Stars */}
                        <div style={{ color: '#fbbf24', fontSize: 14, display: 'flex', gap: 1 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} style={{ color: i < f.rating ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
                          ))}
                        </div>

                        {/* Category Badge */}
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          color: '#818cf8',
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 20
                        }}>
                          {f.category}
                        </span>

                        {/* Room Code Badge */}
                        {f.roomCode && (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontFamily: 'monospace'
                          }}>
                            Room: {f.roomCode}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span style={{ fontSize: 11, color: '#64748b' }}>{formatDate(f.createdAt)}</span>
                    </div>

                    {/* Comment Body */}
                    {f.comment ? (
                      <blockquote style={{
                        margin: 0,
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.015)',
                        borderLeft: '2.5px solid #d4af37',
                        borderRadius: '0 6px 6px 0',
                        fontSize: 13,
                        color: '#f3f4f6',
                        lineHeight: 1.5,
                        fontStyle: 'italic'
                      }}>
                        "{f.comment}"
                      </blockquote>
                    ) : (
                      <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>No comment text provided.</span>
                    )}

                    {/* Author Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: 10 }}>
                      <img
                        src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${f.username}`}
                        alt=""
                        style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>{f.username}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>({f.email || 'No email synced'})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`
        .blink-dot {
          animation: adminBlink 1.5s infinite;
        }
        @keyframes adminBlink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
      <CreatorFooter />
    </div>
  );
}
