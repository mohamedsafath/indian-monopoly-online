/**
 * frontend/src/pages/LoginPage.jsx
 *
 * Monopoly India login page.
 * Presents two initial landing options: "Login via Gmail" and "Play as Guest".
 * Selecting Gmail transitions into a pixel-perfect Google Choose Account chooser.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorFooter from '@/components/CreatorFooter';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

// ── Google Multi-colored G Icon ──
function GoogleColoredLogo({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── Google Antigravity stylized blue gradient "A" logo ──
function AntigravityLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-10 h-10 mb-4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 21C3 21 7 17 12 17C17 17 21 21 21 21L12 2Z" fill="url(#logoGrad)" stroke="url(#logoGradStroke)" strokeWidth="0.5" />
      <defs>
        <linearGradient id="logoGrad" x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="logoGradStroke" x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Decorative Ornamental Border ──
function OrnamentalBorder({ className = '' }) {
  return (
    <svg viewBox="0 0 400 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="12" x2="400" y2="12" stroke="url(#gl-login)" strokeWidth="1" />
      <circle cx="200" cy="12" r="6" stroke="#d4af37" strokeWidth="1.5" fill="none" />
      <circle cx="200" cy="12" r="2" fill="#d4af37" />
      <circle cx="180" cy="12" r="3" stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="220" cy="12" r="3" stroke="#d4af37" strokeWidth="1" fill="none" />
      <circle cx="164" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <circle cx="236" cy="12" r="1.5" fill="#d4af37" opacity="0.6" />
      <polygon points="200,4 204,8 200,12 196,8" fill="#d4af37" opacity="0.35" />
      <defs>
        <linearGradient id="gl-login" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0" />
          <stop offset="30%" stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#d4af37" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Seeded list of users matching screenshot ──
const ACCOUNTS = [
  {
    name: "MOHAMED SAFATH",
    email: "msafath2004@gmail.com",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=MSafath"
  },
  {
    name: "mohamed sameer",
    email: "sameer732261@gmail.com",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Sameer"
  },
  {
    name: "Marianne Sruthi",
    email: "mariannesruthi@gmail.com",
    initial: "M",
    initialBg: "#6b21a8"
  },
  {
    name: "M Safath",
    email: "msafath118@gmail.com",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Safath118"
  },
  {
    name: "Rose Berry",
    email: "roseeberr44@gmail.com",
    initial: "R",
    initialBg: "#1e3a8a"
  }
];

export default function LoginPage() {
  const navigate = useNavigate();
  
  // Splash Screen States
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  // View States: 'landing' | 'google_chooser' | 'google_custom'
  const [loginView, setLoginView] = useState('landing');

  // Input states
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle splash screen timeout
  useEffect(() => {
    if (!showSplash) return;
    
    const fadeTimer = setTimeout(() => {
      setSplashFade(true);
    }, 3000);

    const doneTimer = setTimeout(() => {
      try {
        const stored = localStorage.getItem('mi_google_user');
        if (stored) {
          navigateToDestination();
        } else {
          setShowSplash(false);
        }
      } catch (e) {
        setShowSplash(false);
      }
    }, 3500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [showSplash]);

  const navigateToDestination = () => {
    const redirectPath = sessionStorage.getItem('mi_redirect_lobby');
    if (redirectPath && redirectPath.startsWith('/lobby/')) {
      sessionStorage.removeItem('mi_redirect_lobby');
      navigate(redirectPath);
    } else {
      navigate('/home');
    }
  };

  // Google Login API flow
  const handleGoogleLogin = async (email, username = '') => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      localStorage.setItem('mi_google_user', JSON.stringify(data.user));
      sessionStorage.setItem('mi_playerId', data.user.playerId);
      sessionStorage.setItem('mi_username', data.user.username);
      
      navigateToDestination();
    } catch (err) {
      setError(err.message || 'Failed to connect. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const email = customEmail.trim();
    const name = customName.trim();
    if (!email) {
      return setError('Please enter your Google Email address.');
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return setError('Please use a valid Gmail address (@gmail.com).');
    }
    handleGoogleLogin(email, name);
  };

  // Play as Guest flow
  const handleGuestLogin = () => {
    const guestNum = Math.floor(1000 + Math.random() * 9000);
    const guestUser = {
      playerId: `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      username: `Guest_${guestNum}`,
      email: `guest_${guestNum}@gmail.com`,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${guestNum}`,
      level: 1,
      wins: 0,
      games: 0,
      losses: 0,
      isGuest: true
    };
    localStorage.setItem('mi_google_user', JSON.stringify(guestUser));
    sessionStorage.setItem('mi_playerId', guestUser.playerId);
    sessionStorage.setItem('mi_username', guestUser.username);
    navigateToDestination();
  };

  // Splash Screen Render
  if (showSplash) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center relative transition-opacity duration-500"
        style={{ 
          background: 'radial-gradient(ellipse at 50% 50%, #1c0f00 0%, #050302 100%)',
          opacity: splashFade ? 0 : 1,
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
          @keyframes slowBlinkDouble {
            0% { opacity: 0; transform: scale(0.90); }
            25% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.15; transform: scale(0.95); }
            75% { opacity: 1; transform: scale(1); }
            90% { opacity: 1; transform: scale(1); }
            100% { opacity: 1; transform: scale(1); }
          }
          .animate-slowBlink {
            animation: slowBlinkDouble 3.0s ease-in-out forwards;
          }
        `}</style>

        <div className="text-center relative z-10 flex flex-col items-center justify-center">
          <img 
            src="/splash_logo.png" 
            alt="Indian Business Games Logo" 
            className="w-80 h-80 md:w-[450px] md:h-[450px] object-contain select-none animate-slowBlink"
            style={{ filter: 'drop-shadow(0 0 35px rgba(212,175,55,0.45))' }}
          />
        </div>
      </div>
    );
  }

  // ── VIEW 1: LANDING SELECTION SCREEN (Gmail vs Guest) ──
  if (loginView === 'landing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 30%, #1c0f00 0%, #06060a 75%)',
        color: '#cbd5e1',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box'
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
          .option-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(212, 175, 55, 0.18);
            box-shadow: 0 10px 25px rgba(0,0,0,0.45);
            transition: all 0.2s ease-in-out;
          }
          .option-card:hover {
            transform: translateY(-4px);
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid #d4af37;
            box-shadow: 0 12px 30px rgba(212, 175, 55, 0.15);
          }
        `}</style>

        {/* Branding header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="text-5xl mb-3" style={{ filter:'drop-shadow(0 0 15px rgba(245,158,11,0.4))' }}>
            🎲
          </div>
          <h1 className="font-black leading-none mb-1"
              style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(2.5rem,7vw,4rem)',
                       background:'linear-gradient(135deg,#d4af37 0%,#fde68a 40%,#f59e0b 70%,#d4af37 100%)',
                       WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Monopoly
          </h1>
          <h2 className="font-bold italic leading-none"
              style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(1.5rem,4vw,2.5rem)',
                       color:'#f97316', letterSpacing:'0.04em' }}>
            India
          </h2>
          <OrnamentalBorder style={{ width: '100%', maxWidth: 300, margin: '20px auto 0 auto' }} />
        </div>

        {/* Two choice cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 20,
          maxWidth: 620,
          width: '100%',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 12
        }}>
          {/* Option A: Login with Gmail */}
          <div 
            onClick={() => setLoginView('google_chooser')}
            className="option-card"
            style={{
              flex: '1 1 260px',
              borderRadius: 18,
              padding: '30px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16
            }}
          >
            <div style={{
              width: 50,
              height: 50,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(255,255,255,0.05)'
            }}>
              <GoogleColoredLogo size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fde68a', margin: '0 0 6px 0' }}>Login via Gmail</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Access with your secure Google account. Retains level, win/loss stats, and game history.
              </p>
            </div>
          </div>

          {/* Option B: Play as Guest */}
          <div 
            onClick={handleGuestLogin}
            className="option-card"
            style={{
              flex: '1 1 260px',
              borderRadius: 18,
              padding: '30px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16
            }}
          >
            <div style={{
              width: 50,
              height: 50,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 0 15px rgba(255,255,255,0.05)'
            }}>
              👤
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fde68a', margin: '0 0 6px 0' }}>Play as Guest</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Instant entry without a Google profile. Perfect for a quick session (stats are not saved).
              </p>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', marginTop: 'auto' }}>
          <CreatorFooter />
        </div>
      </div>
    );
  }

  // ── VIEW 2 & 3: GOOGLE ACCOUNT CHOOSER OR CUSTOM SIGN IN ──
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0d',
      color: '#e3e3e3',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      boxSizing: 'border-box'
    }}>
      
      {/* Spacer top */}
      <div />

      {/* Main Account Container */}
      <div style={{
        maxWidth: 820,
        width: '100%',
        margin: '0 auto',
        background: '#131314',
        border: '1.5px solid rgba(255, 255, 255, 0.05)',
        borderRadius: 28,
        padding: '36px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'row',
        gap: 40,
        boxSizing: 'border-box',
        flexWrap: 'wrap'
      }} className="login-card">
        
        {/* Left Column: Google Branding */}
        <div style={{
          flex: '1 1 300px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 220
        }}>
          <div>
            {/* Top Google Icon Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <GoogleColoredLogo size={18} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#e3e3e3', letterSpacing: '0.01em' }}>Sign in with Google</span>
            </div>

            <AntigravityLogo />
            
            <h2 style={{
              fontSize: 32,
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.25,
              margin: '8px 0 12px 0',
              letterSpacing: '-0.02em'
            }}>
              {loginView === 'google_custom' ? 'Sign in' : 'Choose an account'}
            </h2>
            
            <p style={{
              fontSize: 14,
              color: '#c4c7c5',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              to continue to <span style={{ color: '#93c5fd', fontWeight: 600 }}>Google Antigravity</span>
            </p>
          </div>
        </div>

        {/* Right Column: Choices */}
        <div style={{
          flex: '1.2 1 340px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative'
        }}>
          
          {loading && (
            <div style={{
              position: 'absolute',
              top: -24,
              left: 0,
              right: 0,
              height: 3,
              background: '#3b82f6',
              animation: 'loadingProgress 1.5s infinite linear',
              borderRadius: 3
            }} />
          )}

          {loginView === 'google_chooser' ? (
            /* Choose Account List */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                {ACCOUNTS.map((acc, idx) => (
                  <button
                    key={acc.email}
                    onClick={() => handleGoogleLogin(acc.email, acc.name)}
                    disabled={loading}
                    className="account-item-btn"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '16px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderBottom: '1px solid #2d2e30',
                      transition: 'background 0.2s',
                      borderRadius: idx === 0 ? '12px 12px 0 0' : 0,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: acc.initialBg || 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {acc.initial ? (
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{acc.initial}</span>
                      ) : (
                        <img src={acc.avatar} alt="" style={{ width: '100%', height: '100%' }} />
                      )}
                    </div>
                    
                    {/* Account Texts */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e3e3e3' }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{acc.email}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Use Another Account Button */}
              <button
                onClick={() => { setLoginView('google_custom'); setError(''); }}
                disabled={loading}
                className="account-item-btn"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: 20, color: '#a8c7fa', fontWeight: 300 }}>+</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#a8c7fa' }}>Use another account</div>
              </button>

              {/* Return to landing selector options */}
              <button
                onClick={() => { setLoginView('landing'); setError(''); }}
                disabled={loading}
                className="account-item-btn"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  borderRadius: '0 0 12px 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  borderTop: '1px dashed #2d2e30'
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: 14, color: '#94a3b8' }}>↩</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>Go Back (Main Menu)</div>
              </button>

              {error && (
                <div style={{
                  fontSize: 13,
                  color: '#f87171',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px',
                  marginTop: 10,
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  borderRadius: 8
                }}>
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Custom Email Input Form */
            <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Google styled outline input for email */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="email"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  placeholder="Email or phone"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '16px 14px',
                    fontSize: 15,
                    background: 'transparent',
                    border: '1px solid #8e918f',
                    borderRadius: 4,
                    color: '#fff',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  className="google-input"
                />
              </div>

              {/* Optional Name field */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Full name (Optional)"
                  disabled={loading}
                  maxLength={18}
                  style={{
                    width: '100%',
                    padding: '16px 14px',
                    fontSize: 15,
                    background: 'transparent',
                    border: '1px solid #8e918f',
                    borderRadius: 4,
                    color: '#fff',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  className="google-input"
                />
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#f87171', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                
                <button
                  type="button"
                  onClick={() => { setLoginView('google_chooser'); setCustomEmail(''); setCustomName(''); setError(''); }}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a8c7fa',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#c2e7ff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#a8c7fa'}
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading || !customEmail}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 700,
                    background: loading || !customEmail ? 'rgba(168,199,250,0.1)' : '#a8c7fa',
                    color: loading || !customEmail ? 'rgba(255,255,255,0.3)' : '#070708',
                    border: 'none',
                    cursor: loading || !customEmail ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => { if (!loading && customEmail) e.currentTarget.style.background = '#c2e7ff'; }}
                  onMouseLeave={e => { if (!loading && customEmail) e.currentTarget.style.background = '#a8c7fa'; }}
                >
                  {loading ? 'Verifying...' : 'Next'}
                </button>
              </div>
            </form>
          )}

          {/* Privacy note */}
          <div style={{
            fontSize: 12,
            color: '#c4c7c5',
            lineHeight: 1.5,
            marginTop: 40,
            borderTop: '1px solid #2d2e30',
            paddingTop: 16
          }}>
            Before using this app, you can review Google Antigravity’s <span style={{ color: '#a8c7fa', cursor: 'pointer' }}>Privacy Policy</span> and <span style={{ color: '#a8c7fa', cursor: 'pointer' }}>Terms of Service</span>.
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <footer style={{
        maxWidth: 820,
        width: '100%',
        margin: '24px auto 0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: '#c4c7c5'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span>English (United States)</span>
          <span style={{ fontSize: 8 }}>▼</span>
        </div>
        
        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ cursor: 'pointer' }}>Help</span>
          <span style={{ cursor: 'pointer' }}>Privacy</span>
          <span style={{ cursor: 'pointer' }}>Terms</span>
        </div>
      </footer>

      <CreatorFooter />

      {/* Styles */}
      <style>{`
        @keyframes loadingProgress {
          0% { transform: scaleX(0.1) translateX(-100%); }
          50% { transform: scaleX(0.5) translateX(50%); }
          100% { transform: scaleX(0.1) translateX(1000%); }
        }
        .account-item-btn:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .google-input:focus {
          border: 2px solid #a8c7fa !important;
          padding: 15px 13px !important;
        }
        @media (max-width: 768px) {
          .login-card {
            flex-direction: column !important;
            gap: 24px !important;
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
