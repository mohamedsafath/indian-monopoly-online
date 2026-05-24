/**
 * frontend/src/components/Navbar.jsx
 */

import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
         style={{ background: 'rgba(10,8,5,0.82)', backdropFilter: 'blur(12px)',
                  borderBottom: '1px solid rgba(212,175,55,0.18)' }}>

      {/* Logo wordmark */}
      <Link to="/" className="flex items-center gap-2 group">
        <span className="text-xl" style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}>🎲</span>
        <span className="font-black tracking-tight leading-none"
              style={{ fontFamily: "'Playfair Display', serif",
                       background: 'linear-gradient(135deg, #f59e0b 0%, #fde68a 50%, #d97706 100%)',
                       WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                       fontSize: '1.15rem' }}>
          Monopoly <span style={{ fontStyle: 'italic' }}>India</span>
        </span>
      </Link>

      {/* Nav actions */}
      {!isHome && (
        <Link to="/"
              className="text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded border transition-all"
              style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)',
                       fontFamily: "'DM Sans', sans-serif" }}
              onMouseEnter={e => { e.target.style.background = 'rgba(245,158,11,0.1)'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; }}>
          ← Home
        </Link>
      )}
    </nav>
  );
}
