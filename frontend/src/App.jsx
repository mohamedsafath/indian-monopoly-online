import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import ResultPage from './pages/ResultPage';

// Guard for protected pages (Home, Lobby, GameRoom, Results)
function AuthGuard({ children }) {
  try {
    const stored = localStorage.getItem('mi_google_user');
    if (!stored) {
      const path = window.location.pathname;
      if (path.startsWith('/lobby/')) {
        sessionStorage.setItem('mi_redirect_lobby', path);
      }
      return <Navigate to="/" replace />;
    }
  } catch (e) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Guard for guest-only pages (Login)
function GuestGuard({ children }) {
  try {
    const stored = localStorage.getItem('mi_google_user');
    if (stored) {
      return <Navigate to="/home" replace />;
    }
  } catch (e) {
    // Ignored
  }
  return children;
}

import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';

// Creator Footer Component for Instagram & LinkedIn redirects
function CreatorFooter() {
  return (
    <div style={{
      position: 'fixed',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(19, 19, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(212, 175, 55, 0.35)',
      borderRadius: '20px',
      padding: '6px 14px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 10px rgba(212, 175, 55, 0.1)',
      fontSize: '11px',
      color: '#cbd5e1',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      pointerEvents: 'auto',
    }} className="creator-floating-bar">
      <span style={{ fontWeight: 600, color: '#d4af37', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        Created by Mohamed Safath
      </span>
      <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* LinkedIn */}
        <a 
          href="https://www.linkedin.com/in/mohamed-safath/" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="LinkedIn Profile"
          style={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#0077b5">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
        </a>

        {/* Instagram */}
        <a 
          href="https://www.instagram.com/justt.zafathh/" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Instagram Profile"
          style={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="url(#igGrad)">
            <defs>
              <radialGradient id="igGrad" cx="30%" cy="107%" r="130%" fx="30%" fy="107%">
                <stop offset="0" stopColor="#fdf497" />
                <stop offset="0.05" stopColor="#fdf497" />
                <stop offset="0.45" stopColor="#fd5949" />
                <stop offset="0.6" stopColor="#d6249f" />
                <stop offset="0.9" stopColor="#285AEB" />
              </radialGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unified Login page with Animated Splash Screen */}
        <Route path="/" element={<LoginPage />} />

        {/* Login redirect fallback */}
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* Home (Room Management) */}
        <Route path="/home" element={<AuthGuard><Home /></AuthGuard>} />

        {/* Lobby */}
        <Route path="/lobby/:roomCode" element={<AuthGuard><Lobby /></AuthGuard>} />

        {/* Game Room */}
        <Route path="/game/:roomCode" element={<AuthGuard><GameRoom /></AuthGuard>} />

        {/* Profile Page */}
        <Route path="/profile/:userId" element={<AuthGuard><ProfilePage /></AuthGuard>} />

        {/* Result Page */}
        <Route path="/results/:roomCode" element={<AuthGuard><ResultPage /></AuthGuard>} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
      </Routes>
      <CreatorFooter />
    </BrowserRouter>
  );
}

export default App;