/**
 * frontend/src/pages/Home.jsx
 *
 * Monopoly India landing page.
 * Aesthetic: Indian festive luxury — deep jewel tones, gold ornamental motifs,
 * bold serif typography, saffron + emerald + crimson palette.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '@/services/socketService';

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
function GoldInput({ placeholder, value, onChange, maxLength = 20, type = 'text' }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      autoComplete="off"
      className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
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

  // Create room state
  const [createUsername, setCreateUsername] = useState('');
  const [createLoading,  setCreateLoading]  = useState(false);
  const [createError,    setCreateError]    = useState('');

  // Join room state
  const [joinUsername, setJoinUsername] = useState('');
  const [joinCode,     setJoinCode]     = useState('');
  const [joinLoading,  setJoinLoading]  = useState(false);
  const [joinError,    setJoinError]    = useState('');

  // ── Create room ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = createUsername.trim();
    if (!name) return setCreateError('Please enter your name');
    if (name.length < 2) return setCreateError('Name must be at least 2 characters');
    setCreateError('');
    setCreateLoading(true);
    try {
      const { room, playerId } = await socketService.createRoom(name);
      // Persist identity for reconnect
      sessionStorage.setItem('mi_playerId',  playerId);
      sessionStorage.setItem('mi_roomCode',  room.code);
      sessionStorage.setItem('mi_username',  name);
      navigate(`/lobby/${room.code}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Join room ──────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    const name = joinUsername.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) return setJoinError('Please enter your name');
    if (!code || code.length !== 6) return setJoinError('Enter a valid 6-character room code');
    setJoinError('');
    setJoinLoading(true);
    try {
      const { room, playerId } = await socketService.joinRoom(code, name);
      sessionStorage.setItem('mi_playerId', playerId);
      sessionStorage.setItem('mi_roomCode', room.code);
      sessionStorage.setItem('mi_username', name);
      navigate(`/lobby/${room.code}`);
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

        {/* Cards container */}
        <div className="w-full max-w-lg flex flex-col gap-5">

          {/* ── Create Room ─────────────────────────────────── */}
          <Card title="✦ Create a New Room">
            <GoldInput
              placeholder="Your name (e.g. Arjun)"
              value={createUsername}
              onChange={v => { setCreateUsername(v); setCreateError(''); }}
              maxLength={20}
            />
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
            <GoldInput
              placeholder="Your name"
              value={joinUsername}
              onChange={v => { setJoinUsername(v); setJoinError(''); }}
              maxLength={20}
            />
            <GoldInput
              placeholder="Room code (e.g. MUMBAI)"
              value={joinCode}
              onChange={v => { setJoinCode(v.toUpperCase()); setJoinError(''); }}
              maxLength={6}
            />
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

        {/* Footer note */}
        <p className="mt-10 text-xs text-center"
           style={{ color:'rgba(156,163,175,0.3)', fontFamily:"'DM Sans',sans-serif" }}>
          2–8 players · Indian cities · Play with friends
        </p>
      </main>

      <CityStrip />
    </div>
  );
}
