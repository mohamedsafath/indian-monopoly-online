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
      const search = window.location.search;
      if (path.startsWith('/lobby/') || path.startsWith('/game/')) {
        sessionStorage.setItem('mi_redirect_lobby', path + search);
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

// CreatorFooter is now imported and rendered inline in page layouts

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
    </BrowserRouter>
  );
}

export default App;