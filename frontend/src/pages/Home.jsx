/**
 * frontend/src/pages/Home.jsx
 *
 * Monopoly India Room Management page.
 * Aesthetic: Indian festive luxury — deep jewel tones, gold ornamental motifs,
 * bold serif typography, saffron + emerald + crimson palette.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '@/services/socketService';
import RuleBookModal from '@/components/RuleBookModal';
import CreatorFooter from '@/components/CreatorFooter';

// ── Decorative SVG border motif (rangoli-inspired geometric) ────────────────
function OrnamentialBorder({ className = '' }) {
  return (
    <svg viewBox="0 0 400 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="12" x2="400" y2="12" stroke="url(#gl)" strokeWidth="1" />
      <circle cx="200" cy="12" r="6"  stroke="#d4af37" strokeWidth="1.5" fill="none" />
      <circle cx="200" cy="12" r="2"  fill="#d4af37" />
      <circle cx="180" cy="12" r="3"  stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="220" cy="12" r="3"  stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="164" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <circle cx="236" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <polygon points="200,4 204,8 200,12 196,8" fill="#d4af37" opacity="0.35" />
      <defs>
        <linearGradient id="gl" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0" />
          <stop offset="30%"  stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="70%"  stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── City marquee strip ───────────────────────────────────────────────────────
const CITIES = ['Mumbai','Delhi','Bengaluru','Chennai','Kolkata','Hyderabad',
                 'Jaipur','Ahmedabad','Pune','Lucknow','Surat','Kochi'];

function CityStrip() {
  const repeated = [...CITIES, ...CITIES];
  return (
    <div className="overflow-hidden w-full py-2" style={{ borderTop:'1px solid rgba(212,175,55,0.12)',
      borderBottom:'1px solid rgba(212,175,55,0.12)', background:'rgba(0,0,0,0.25)' }}>
      <div className="flex gap-8 city-scroll whitespace-nowrap">
        {repeated.map((c, i) => (
          <span key={i} className="text-xs uppercase tracking-[0.25em] font-medium flex-shrink-0"
                style={{ color:'rgba(212,175,55,0.55)', fontFamily:"'DM Sans',sans-serif" }}>
            {c} <span style={{ color:'rgba(212,175,55,0.25)' }}>✦</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes scrollLeft { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        .city-scroll { animation: scrollLeft 28s linear infinite; }
      `}</style>
    </div>
  );
}

// ── Input component ──────────────────────────────────────────────────────────
function GoldInput({ placeholder, value, onChange, maxLength = 20, type = 'text', disabled = false }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      disabled={disabled}
      autoComplete="off"
      className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 disabled:opacity-50"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(212,175,55,0.25)',
        color: '#f3f4f6',
        fontFamily: "'DM Sans', sans-serif",
        caretColor: '#f59e0b',
      }}
      onFocus={e => { e.target.style.border = '1px solid rgba(212,175,55,0.65)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.1)'; }}
      onBlur={e =>  { e.target.style.border = '1px solid rgba(212,175,55,0.25)';
                      e.target.style.boxShadow = 'none'; }}
    />
  );
}

// ── Gold button ──────────────────────────────────────────────────────────────
function GoldButton({ children, onClick, disabled = false, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest
                 transition-all duration-200 cursor-pointer disabled:opacity-40
                 disabled:cursor-not-allowed"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: isPrimary
          ? disabled ? 'rgba(180,83,9,0.3)'
          : 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)'
          : 'rgba(212,175,55,0.1)',
        color: isPrimary ? '#0a0805' : '#f59e0b',
        border: isPrimary ? 'none' : '1px solid rgba(212,175,55,0.35)',
        boxShadow: isPrimary && !disabled ? '0 4px 20px rgba(245,158,11,0.35)' : 'none',
      }}
      onMouseEnter={e => { if (!disabled && isPrimary) e.currentTarget.style.boxShadow = '0 6px 28px rgba(245,158,11,0.55)'; }}
      onMouseLeave={e => { if (!disabled && isPrimary) e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.35)'; }}
    >
      {children}
    </button>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, title }) {
  return (
    <div className="p-6 rounded-2xl flex flex-col gap-4"
         style={{ background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.15)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
      <h3 className="text-sm font-bold uppercase tracking-widest"
          style={{ color:'rgba(212,175,55,0.7)', fontFamily:"'DM Sans',sans-serif" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const [showRuleBook, setShowRuleBook] = useState(false);

  // Authenticated User profile from local session
  const [googleUser, setGoogleUser] = useState(() => {
    try {
      const stored = localStorage.getItem('mi_google_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Create room state (pre-filled and locked)
  const [createUsername, setCreateUsername] = useState(googleUser ? googleUser.username : '');
  const [createLoading,  setCreateLoading]  = useState(false);
  const [createError,    setCreateError]    = useState('');

  // Join room state (pre-filled and locked)
  const [joinUsername, setJoinUsername] = useState(googleUser ? googleUser.username : '');
  const [joinCode,     setJoinCode]     = useState('');
  const [joinLoading,  setJoinLoading]  = useState(false);
  const [joinError,    setJoinError]    = useState('');
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);

  // Update room states if googleUser updates (run on mount, but avoid overwriting active typing)
  useEffect(() => {
    if (googleUser && !createUsername && !joinUsername) {
      setCreateUsername(googleUser.username);
      setJoinUsername(googleUser.username);
    }
  }, [googleUser]);

  const handleNameChange = (newName) => {
    const trimmed = newName.slice(0, 20);
    setCreateUsername(trimmed);
    setJoinUsername(trimmed);

    if (googleUser && googleUser.isGuest) {
      const updatedUser = { ...googleUser, username: trimmed };
      localStorage.setItem('mi_google_user', JSON.stringify(updatedUser));
      setGoogleUser(updatedUser);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('mi_google_user');
    setGoogleUser(null);
    setCreateUsername('');
    setJoinUsername('');
    navigate('/');
  };

  // ── Create room ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = createUsername.trim();
    if (!name) return setCreateError('Please enter your name');
    setCreateError('');
    setCreateLoading(true);
    try {
      const pId = googleUser ? googleUser.playerId : undefined;
      const { room, playerId } = await socketService.createRoom(name, pId);
      // Persist identity for reconnect
      sessionStorage.setItem('mi_playerId',  playerId);
      sessionStorage.setItem('mi_roomCode',  room.code);
      sessionStorage.setItem('mi_username',  name);
      sessionStorage.setItem('mi_isSpectator', 'false');
      navigate(`/lobby/${room.code}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Join room ──────────────────────────────────────────────────────────────
  const handleJoinCodeChange = (val) => {
    let processed = val.trim();
    // If it looks like a URL/link, parse it
    if (processed.includes('/') || processed.includes(':') || processed.length > 6) {
      const match = processed.match(/\/(?:lobby|game|results)\/([A-Za-z0-9]{6})/i);
      if (match) {
        processed = match[1];
      } else {
        const parts = processed.split('/');
        const lastPart = parts[parts.length - 1].split('?')[0].split('#')[0];
        if (lastPart.length === 6 && /^[A-Za-z0-9]+$/.test(lastPart)) {
          processed = lastPart;
        }
      }
    }
    // Limit to 6 characters if not a URL / after extraction
    if (!processed.includes('/') && !processed.includes(':')) {
      processed = processed.slice(0, 6);
    }
    setJoinCode(processed.toUpperCase());
    setJoinError('');
  };

  const handleJoin = async () => {
    const name = joinUsername.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) return setJoinError('Please enter your name');
    if (!code || code.length !== 6) return setJoinError('Enter a valid 6-character room code');
    setJoinError('');
    setJoinLoading(true);
    try {
      const pId = googleUser ? googleUser.playerId : undefined;
      const { room, playerId, isSpectator } = await socketService.joinRoom(code, name, pId, joinAsSpectator);
      sessionStorage.setItem('mi_playerId', playerId);
      sessionStorage.setItem('mi_roomCode', room.code);
      sessionStorage.setItem('mi_username', name);
      sessionStorage.setItem('mi_isSpectator', String(Boolean(isSpectator || joinAsSpectator)));
      
      if (room.status === 'playing') {
        navigate(`/game/${room.code}`);
      } else {
        navigate(`/lobby/${room.code}`);
      }
    } catch (err) {
      setJoinError(err.message || 'Failed to join room');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: 'radial-gradient(ellipse at 20% 0%, #1c0f00 0%, #0a0805 60%, #050302 100%)' }}>

      {/* Google fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        ::placeholder { color: rgba(156,163,175,0.45) !important; }
      `}</style>

      {/* Ambient glow spots */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'50vw', height:'50vw',
                      borderRadius:'50%', background:'radial-gradient(circle, rgba(180,83,9,0.12) 0%, transparent 70%)',
                      filter:'blur(40px)' }} />
        <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:'55vw', height:'55vw',
                      borderRadius:'50%', background:'radial-gradient(circle, rgba(4,120,87,0.08) 0%, transparent 70%)',
                      filter:'blur(60px)' }} />
      </div>

      {/* City strip at very top */}
      <CityStrip />

      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-8 md:py-16 relative">

        {/* Brand */}
        <div className="text-center mb-3">
          <div className="text-5xl mb-4" style={{ filter:'drop-shadow(0 0 20px rgba(245,158,11,0.5))' }}>
            🎲
          </div>
          <h1 className="font-black leading-none mb-1"
              style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(2.8rem,8vw,5rem)',
                       background:'linear-gradient(135deg,#d4af37 0%,#fde68a 40%,#f59e0b 70%,#d4af37 100%)',
                       WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Monopoly
          </h1>
          <h2 className="font-bold italic leading-none"
              style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(1.6rem,5vw,3rem)',
                       color:'#f97316', letterSpacing:'0.04em' }}>
            India
          </h2>
        </div>

        <OrnamentialBorder className="w-72 mb-6 opacity-70" />

        <p className="text-center text-sm mb-10 max-w-sm"
           style={{ color:'rgba(209,213,219,0.55)', fontFamily:"'DM Sans',sans-serif",
                    lineHeight:'1.7', letterSpacing:'0.02em' }}>
          Buy properties across India's greatest cities.<br />
          Build empires. Bankrupt your friends.
        </p>

        {/* Verified User profile card (Always authenticated due to AuthGuard) */}
        {googleUser && (
          <div className="w-full max-w-lg mb-6 p-5 rounded-2xl flex items-center justify-between gap-4"
               style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1.5px solid rgba(212,175,55,0.4)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
            <div className="flex items-center gap-4">
              <img
                src={googleUser.avatar}
                alt={googleUser.username}
                className="w-14 h-14 rounded-full border border-yellow-500/50 bg-black/30"
              />
              <div className="flex flex-col gap-1">
                <span className="font-bold flex items-center gap-1.5" style={{ color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>
                  👤 {googleUser.username}
                  <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', color: '#fde68a', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>
                    Lv {googleUser.level}
                  </span>
                </span>
                <span className="text-[10px]" style={{ color: 'rgba(156,163,175,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
                  {googleUser.isGuest ? '👤 Transient Guest Session' : googleUser.email}
                </span>
                <div className="flex gap-3 text-[10px] mt-1 text-yellow-500/80 font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <span>🏆 Wins: {googleUser.wins}</span>
                  <span>🎲 Games: {googleUser.games}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/profile/${googleUser.playerId}`)}
                className="px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-yellow-500 bg-yellow-500/5 border border-yellow-500/25 hover:bg-yellow-500/10"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                👁️ View Profile
              </button>
              <button
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Room Management Container */}
        <div className="w-full max-w-lg flex flex-col gap-5">

          {/* ── Create Room ─────────────────────────────────── */}
          <Card title="✦ Create a New Room">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider">
                {googleUser?.isGuest ? '👤 Host Identity (Guest - Editable)' : '🏆 Host Identity (Verified)'}
              </span>
              <GoldInput
                placeholder="Your name"
                value={createUsername}
                onChange={handleNameChange}
                maxLength={20}
                disabled={!googleUser?.isGuest}
              />
            </div>
            {createError && (
              <p className="text-xs text-red-400" style={{ fontFamily:"'DM Sans',sans-serif" }}>
                {createError}
              </p>
            )}
            <GoldButton onClick={handleCreate} disabled={createLoading}>
              {createLoading ? 'Creating…' : '🏠 Create Room'}
            </GoldButton>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background:'rgba(212,175,55,0.12)' }} />
            <span className="text-xs font-semibold tracking-widest"
                  style={{ color:'rgba(212,175,55,0.35)', fontFamily:"'DM Sans',sans-serif" }}>
              OR
            </span>
            <div className="flex-1 h-px" style={{ background:'rgba(212,175,55,0.12)' }} />
          </div>

          {/* ── Join Room ────────────────────────────────────── */}
          <Card title="✦ Join with a Code">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider">
                {googleUser?.isGuest ? '👤 Player Identity (Guest - Editable)' : '🏆 Player Identity (Verified)'}
              </span>
              <GoldInput
                placeholder="Your name"
                value={joinUsername}
                onChange={handleNameChange}
                maxLength={20}
                disabled={!googleUser?.isGuest}
              />
            </div>
            <GoldInput
              placeholder="Enter Room Code or Invite Link"
              value={joinCode}
              onChange={handleJoinCodeChange}
            />
            <label className="flex items-center gap-2.5 cursor-pointer mt-1 mb-2 select-none group">
              <input
                type="checkbox"
                checked={joinAsSpectator}
                onChange={e => setJoinAsSpectator(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded flex items-center justify-center transition-all duration-200"
                style={{
                  background: joinAsSpectator ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)',
                  border: joinAsSpectator ? '1.5px solid #d4af37' : '1px solid rgba(212,175,55,0.25)',
                  boxShadow: joinAsSpectator ? '0 0 8px rgba(212,175,55,0.25)' : 'none',
                }}
              >
                {joinAsSpectator && (
                  <span className="text-xs text-yellow-500 font-bold">✓</span>
                )}
              </div>
              <span
                className="text-xs font-semibold tracking-wider transition-colors duration-200"
                style={{
                  color: joinAsSpectator ? '#f59e0b' : 'rgba(209,213,219,0.7)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                👁️ Join as Spectator
              </span>
            </label>
            {joinError && (
              <p className="text-xs text-red-400" style={{ fontFamily:"'DM Sans',sans-serif" }}>
                {joinError}
              </p>
            )}
            <GoldButton onClick={handleJoin} disabled={joinLoading} variant="secondary">
              {joinLoading ? 'Joining…' : '🚪 Join Room'}
            </GoldButton>
          </Card>
        </div>

        <button
          onClick={() => setShowRuleBook(true)}
          className="mt-6 text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            background: 'rgba(212,175,55,0.06)',
            color: '#f59e0b',
            border: '1px solid rgba(212,175,55,0.25)',
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(212,175,55,0.12)';
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.55)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(212,175,55,0.06)';
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          📜 View Rule Book
        </button>

        {/* Footer note */}
        <p className="mt-10 text-xs text-center"
           style={{ color:'rgba(156,163,175,0.3)', fontFamily:"'DM Sans',sans-serif" }}>
          2–8 players · Indian cities · Play with friends
        </p>

        {/* Rule Book Modal */}
        <RuleBookModal isOpen={showRuleBook} onClose={() => setShowRuleBook(false)} />
      </main>

      <CityStrip />
      <CreatorFooter />
    </div>
  );
}
