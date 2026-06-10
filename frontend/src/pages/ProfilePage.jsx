/**
 * frontend/src/pages/ProfilePage.jsx
 *
 * Monopoly India Public Player Profile page.
 * Theme: Indian festive luxury — deep gold accents, jewel tones, saffron + emerald.
 * Renders player metrics and their completed match history ledger.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CreatorFooter from '@/components/CreatorFooter';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

// ── Decorative SVG border motif ──────────────────────────────────────────────
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

// ── Stats card wrapper ───────────────────────────────────────────────────────
function StatsCard({ title, icon, value, subtext, color = '#fbbf24' }) {
  return (
    <div className="p-5 rounded-2xl flex flex-col gap-1.5 transition-all duration-200 hover:border-yellow-500/35 hover:scale-[1.02]"
         style={{ background: 'rgba(255,255,255,0.02)',
                  border: '1.5px solid rgba(255,255,255,0.04)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{title}</span>
        <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>{icon}</span>
      </div>
      <span className="text-2xl font-black tracking-wide" style={{ color }}>{value}</span>
      {subtext && <span className="text-[10px] text-gray-500 font-medium">{subtext}</span>}
    </div>
  );
}

// ── DiceBear style categories and preset seeds ──────────────────────────────
const STYLE_CATEGORIES = [
  {
    id: 'adventurer',
    name: 'Adventurers',
    presets: ['Sameer', 'Sruthi', 'Milo', 'Aria', 'Leo', 'Luna', 'Felix', 'Jasmine']
  },
  {
    id: 'lorelei',
    name: 'Faces (Lorelei)',
    presets: ['Saffron', 'Gold', 'Ruby', 'Emerald', 'Sapphire', 'Amber', 'Lotus', 'Diya']
  },
  {
    id: 'avataaars',
    name: 'Illustrated (Avataaars)',
    presets: ['Jack', 'Zoey', 'Buster', 'Lily', 'Cody', 'Harley', 'Toby', 'Oscar']
  },
  {
    id: 'bottts',
    name: 'Robots (Bottts)',
    presets: ['Robo1', 'Mech', 'Gear', 'Bolt', 'Spark', 'Circuit', 'Neon', 'Iron']
  }
];

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentUser, setCurrentUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('adventurer');
  const [selectedSeed, setSelectedSeed] = useState('Sameer');
  const [customSeed, setCustomSeed] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Fetch logged in user from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mi_google_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse logged in user:", e);
    }
  }, []);

  // Sync modal state when player data is loaded
  useEffect(() => {
    if (player && player.avatar) {
      try {
        const urlStr = player.avatar;
        if (urlStr.includes('api.dicebear.com')) {
          const match = urlStr.match(/dicebear\.com\/7\.x\/([^/]+)\/svg\?seed=([^&]+)/);
          if (match && match[1] && match[2]) {
            setSelectedStyle(match[1]);
            setSelectedSeed(decodeURIComponent(match[2]));
          }
        }
      } catch (e) {
        console.error("Failed to parse avatar seed from URL:", e);
      }
    }
  }, [player]);

  const isMe = currentUser && currentUser.playerId === userId;

  useEffect(() => {
    setLoading(true);
    setError('');

    if (userId && userId.startsWith('guest_')) {
      try {
        const stored = localStorage.getItem('mi_google_user');
        if (stored) {
          const user = JSON.parse(stored);
          if (user.playerId === userId) {
            setPlayer(user);
            setMatches([]);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse guest from local storage:", e);
      }
    }

    fetch(`${BACKEND_URL}/api/auth/profile/${userId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Player profile not found.');
        }
        return res.json();
      })
      .then(data => {
        if (data.ok && data.user) {
          setPlayer(data.user);
          setMatches(data.matches || []);
        } else {
          setError('Failed to fetch profile statistics.');
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to connect to backend server.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  const handleRandomize = () => {
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    const styles = ['Hero', 'Monopoly', 'Player', 'King', 'Queen', 'Boss', 'Rich', 'Gold'];
    const base = styles[Math.floor(Math.random() * styles.length)];
    const newSeed = `${base}_${rand}`;
    setCustomSeed(newSeed);
    setSelectedSeed(newSeed);
  };

  const handleSaveAvatar = async () => {
    setIsSaving(true);
    setSaveError('');

    const newAvatarUrl = `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${encodeURIComponent(selectedSeed)}`;

    if (player.isGuest) {
      try {
        const updatedUser = { ...player, avatar: newAvatarUrl };
        localStorage.setItem('mi_google_user', JSON.stringify(updatedUser));
        setPlayer(updatedUser);
        setCurrentUser(updatedUser);
        setIsModalOpen(false);
      } catch (err) {
        setSaveError('Failed to save avatar locally.');
      } finally {
        setIsSaving(false);
      }
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/update-avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser?.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {})
          },
          body: JSON.stringify({
            playerId: player.playerId,
            avatar: newAvatarUrl
          })
        });

        const data = await res.json();
        if (data.ok && data.user) {
          localStorage.setItem('mi_google_user', JSON.stringify(data.user));
          setPlayer(data.user);
          setCurrentUser(data.user);
          setIsModalOpen(false);
        } else {
          setSaveError(data.error || 'Failed to save avatar to server.');
        }
      } catch (err) {
        setSaveError('Failed to connect to backend server.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Calculate Win Rate
  const winRate = player && player.games > 0
    ? ((player.wins / player.games) * 100).toFixed(1)
    : '0.0';

  // Format Duration
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Format Date
  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-between"
           style={{ background: 'radial-gradient(ellipse at 20% 0%, #1c0f00 0%, #0a0805 60%, #050302 100%)' }}>
        <CityStrip />
        <main className="flex-1 flex flex-col items-center justify-center font-sans text-white">
          <div className="text-5xl animate-spin mb-4" style={{ filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.5))' }}>👑</div>
          <p className="text-sm font-bold tracking-widest text-yellow-500 uppercase">Retrieving portfolio...</p>
        </main>
        <CityStrip />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen flex flex-col justify-between"
           style={{ background: 'radial-gradient(ellipse at 20% 0%, #1c0f00 0%, #0a0805 60%, #050302 100%)' }}>
        <CityStrip />
        <main className="flex-1 flex flex-col items-center justify-center font-sans text-white gap-4">
          <div className="text-5xl">⚠️</div>
          <p className="text-sm font-black text-red-400 tracking-wide">{error || 'Player profile not found.'}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-white transition-all"
          >
            🏠 Return Home
          </button>
        </main>
        <CityStrip />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between"
         style={{ background: 'radial-gradient(ellipse at 20% 0%, #1c0f00 0%, #0a0805 60%, #050302 100%)' }}>
      
      {/* Styles & Typography */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-modalFadeIn {
          animation: modalFadeIn 0.2s ease-out forwards;
        }
        .animate-modalScaleUp {
          animation: modalScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* Ambient glowing spots */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'50vw', height:'50vw',
                      borderRadius:'50%', background:'radial-gradient(circle, rgba(180,83,9,0.1) 0%, transparent 70%)',
                      filter:'blur(40px)' }} />
        <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:'55vw', height:'55vw',
                      borderRadius:'50%', background:'radial-gradient(circle, rgba(4,120,87,0.06) 0%, transparent 70%)',
                      filter:'blur(60px)' }} />
      </div>

      <CityStrip />

      {/* Profile Card Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10 w-full">
        
        {/* Profile Card Header */}
        <div className="w-full max-w-2xl rounded-3xl p-8 flex flex-col gap-6"
             style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
                      border: '1.5px solid rgba(212,175,55,0.22)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
                      fontFamily: "'DM Sans', sans-serif" }}>
          
          {/* Avatar and Name */}
          <div className="flex flex-col md:flex-row items-center gap-5 pb-5 border-b border-white/5">
            <div className="relative group flex-shrink-0">
              <img
                src={player.avatar}
                alt={player.username}
                className={`w-20 h-20 rounded-full border-2 border-yellow-500/50 bg-black/35 shadow-xl transition-all duration-300 ${isMe ? 'group-hover:scale-[1.05] group-hover:border-amber-400 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer' : ''}`}
                onClick={() => { if (isMe) setIsModalOpen(true); }}
              />
              {isMe && (
                <div 
                  onClick={() => setIsModalOpen(true)}
                  className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer pointer-events-auto"
                >
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex flex-col items-center gap-0.5 select-none">
                    <span>✏️</span>
                    <span>Edit</span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center md:items-start gap-1.5 text-center md:text-left">
              {player.isGuest ? (
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-500/10 px-2 py-0.5 rounded border border-stone-500/20 inline-block w-max">
                  👤 Guest Profile (Transient)
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  🏆 Verified Player Profile
                </span>
              )}
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                {player.username}
                <span className="text-[10px] font-black bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded uppercase">
                  Lv {player.level}
                </span>
              </h2>
              <span className="text-xs text-gray-500">
                {player.isGuest ? 'Transient local-only progress' : player.email}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-black text-yellow-500/50 uppercase tracking-widest block text-center md:text-left">
            📈 Lifetime Statistics & Portfolio
          </span>

          {/* Stats Dashboard Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatsCard
              title="Games Played"
              icon="🎲"
              value={player.games}
              subtext="Total sessions played"
              color="#38bdf8"
            />
            <StatsCard
              title="Wins & Losses"
              icon="🏆"
              value={`${player.wins}W - ${player.losses}L`}
              subtext="Match outcomes record"
              color="#4ade80"
            />
            <StatsCard
              title="Win Rate"
              icon="⚡"
              value={`${winRate}%`}
              subtext="Performance ratio"
              color="#fbbf24"
            />
            <StatsCard
              title="Net Worth Earned"
              icon="💸"
              value={`₹${(player.totalNetWorthEarned || 0).toLocaleString('en-IN')}`}
              subtext="Wealth accumulated"
              color="#fbbf24"
            />
            <StatsCard
              title="Properties Purchased"
              icon="🏠"
              value={player.propertiesPurchased || 0}
              subtext="Bought properties"
              color="#a78bfa"
            />
            <StatsCard
              title="Properties Mortgaged"
              icon="📜"
              value={player.propertiesMortgaged || 0}
              subtext="Mortgaged properties"
              color="#f59e0b"
            />
            <StatsCard
              title="Properties Repossessed"
              icon="⚖️"
              value={player.propertiesRepossessed || 0}
              subtext="Surrendered assets"
              color="#ef4444"
            />
            <StatsCard
              title="Auctions Won"
              icon="🔨"
              value={player.auctionsWon || 0}
              subtext="Won auctions"
              color="#10b981"
            />
            <StatsCard
              title="Loans Requested"
              icon="🏦"
              value={player.loansTaken || 0}
              subtext="Emergency bank support"
              color="#f87171"
            />
            <StatsCard
              title="Rent Paid"
              icon="💸"
              value={`₹${(player.rentPaid || 0).toLocaleString('en-IN')}`}
              subtext="Paid to other landlords"
              color="#ec4899"
            />
            <StatsCard
              title="Rent Earned"
              icon="💰"
              value={`₹${(player.rentEarned || 0).toLocaleString('en-IN')}`}
              subtext="Rent earned from assets"
              color="#10b981"
            />
            <StatsCard
              title="Bankruptcies"
              icon="💀"
              value={player.bankruptcies || 0}
              subtext="Shortfall eliminations"
              color="#6b7280"
            />
          </div>

          {/* 🎮 Completed Match History Section */}
          <div className="flex flex-col gap-4 mt-2">
            <span className="text-[10px] font-black text-yellow-500/50 uppercase tracking-widest block text-center md:text-left">
              🎮 Completed Match History
            </span>

            {matches.length === 0 ? (
              <div className="p-8 rounded-2xl text-center flex flex-col items-center justify-center border border-dashed border-white/10 bg-white/5">
                <span className="text-3xl mb-2">🎲</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">No completed matches yet</span>
                <p className="text-[10px] text-gray-600 mt-1 max-w-xs leading-normal">Start or join a Room selection lobby, bankrupt your friends, and build your portfolio!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                {matches.map((m) => {
                  const myRanking = m.rankings?.find(r => r.playerId === player.playerId || r.username === player.username);
                  const isWinner = m.winner === player.username || (myRanking && m.rankings?.[0]?.playerId === player.playerId);
                  const opponents = m.players.filter(p => p !== player.username).join(', ');

                  return (
                    <div
                      key={m.matchId}
                      className="p-4 rounded-xl flex items-center justify-between gap-4 border transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        borderColor: isWinner ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                    >
                      {/* Left: Status and Date */}
                      <div className="flex flex-col gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-max"
                          style={{
                            background: isWinner ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: isWinner ? '#4ade80' : '#f87171',
                            border: `1.5px solid ${isWinner ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`
                          }}
                        >
                          {isWinner ? '🏆 Victory' : '💀 Defeat'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold tracking-wide">
                          {formatDate(m.date)}
                        </span>
                      </div>

                      {/* Center: Duration and Competitors */}
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                          ⏳ {formatDuration(m.duration)}
                        </span>
                        <span className="text-[10px] text-gray-600 truncate max-w-[180px] font-medium">
                          👥 vs {opponents || 'Bankrupt Friends'}
                        </span>
                      </div>

                      {/* Right: Personal Match Stats */}
                      <div className="text-right flex flex-col gap-0.5 font-sans">
                        <span className="text-xs font-black text-amber-500">
                          Net Worth: ₹{myRanking ? myRanking.netWorth.toLocaleString('en-IN') : '0'}
                        </span>
                        <div className="flex gap-2 justify-end text-[9px] text-gray-600 font-bold mt-0.5">
                          <span>Cash: ₹{myRanking ? myRanking.cash.toLocaleString('en-IN') : '0'}</span>
                          <span>🏠 {myRanking ? myRanking.propertiesOwnedCount : 0} props</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <OrnamentialBorder className="w-56 mx-auto opacity-50 mt-2" />

          {/* Footer Navigation Action */}
          <button
            onClick={() => navigate('/home')}
            className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-center cursor-pointer transition-all duration-200 text-yellow-500 bg-yellow-500/5 border border-yellow-500/25 hover:bg-yellow-500/10"
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(212, 175, 55, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            🏠 Return Home
          </button>
        </div>

      </main>

      <CityStrip />
      <CreatorFooter />

      {/* Avatar selection modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-modalFadeIn">
          <div className="w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col gap-5 animate-modalScaleUp"
               style={{ background: 'linear-gradient(135deg, rgba(28, 18, 5, 0.95) 0%, rgba(10, 8, 5, 0.98) 100%)',
                        border: '1.5px solid rgba(212,175,55,0.35)',
                        boxShadow: '0 25px 70px rgba(0,0,0,0.85)',
                        fontFamily: "'DM Sans', sans-serif" }}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <span>🎨</span> Choose Your Avatar
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSaveError('');
                }}
                className="text-gray-400 hover:text-white transition-all text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Preview Section */}
            <div className="flex flex-col items-center gap-2 py-4 bg-black/45 rounded-2xl border border-white/5 shadow-inner">
              <div className="w-20 h-20 rounded-full border-2 border-yellow-500/80 bg-black/35 shadow-lg overflow-hidden flex items-center justify-center p-1 relative">
                <img 
                  src={`https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${encodeURIComponent(selectedSeed)}`}
                  alt="Preview Avatar"
                  className="w-full h-full rounded-full"
                />
              </div>
              <span className="text-[9px] text-yellow-500/60 uppercase tracking-widest font-black">
                Preview Seed: {selectedSeed}
              </span>
            </div>

            {/* Tabs / Styles Selector */}
            <div className="flex gap-1 p-1 bg-black/35 rounded-xl border border-white/5 overflow-x-auto whitespace-nowrap scrollbar-none">
              {STYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedStyle(cat.id);
                    setSelectedSeed(cat.presets[0]);
                    setCustomSeed('');
                  }}
                  className={`flex-1 min-w-[75px] sm:min-w-0 py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex-shrink-0 ${
                    selectedStyle === cat.id
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                      : 'text-stone-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {cat.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Preset Avatars Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                Preset Characters
              </span>
              <div className="grid grid-cols-4 gap-2.5 max-h-36 overflow-y-auto pr-1">
                {STYLE_CATEGORIES.find(c => c.id === selectedStyle)?.presets.map((seedName) => {
                  const seedUrl = `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${encodeURIComponent(seedName)}`;
                  const isSelected = selectedSeed === seedName;
                  return (
                    <button
                      key={seedName}
                      onClick={() => {
                        setSelectedSeed(seedName);
                        setCustomSeed('');
                      }}
                      className={`p-1.5 rounded-xl border flex items-center justify-center bg-black/20 hover:scale-[1.05] transition-all duration-200 cursor-pointer relative group ${
                        isSelected 
                          ? 'border-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                          : 'border-white/5 hover:border-white/20'
                      }`}
                    >
                      <img src={seedUrl} alt={seedName} className="w-8 h-8 rounded-full" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Seed Input & Randomize */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                Custom seed / name
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type anything..."
                  value={customSeed}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomSeed(val);
                    setSelectedSeed(val || 'Default');
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-black/40 border border-white/10 text-white focus:outline-none focus:border-yellow-500/70 focus:ring-1 focus:ring-yellow-500/30 font-semibold"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                <button
                  onClick={handleRandomize}
                  className="px-3 py-2 rounded-xl text-[10px] font-black bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  🎲 Random
                </button>
              </div>
            </div>

            {saveError && (
              <span className="text-[10px] font-bold text-red-400 tracking-wide block text-center">
                ⚠️ {saveError}
              </span>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSaveError('');
                }}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-stone-400 bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-center transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAvatar}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-950 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all cursor-pointer disabled:opacity-50"
                style={{ fontFamily: "'DM Sans', sans-serif", color: '#022c22' }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
