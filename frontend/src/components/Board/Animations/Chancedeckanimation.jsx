/**
 * components/Board/ChanceDeckAnimation.jsx
 *
 * Premium card reveal popup for Chance and Community Chest.
 * Sequence:
 *   1. Backdrop fades in with blur
 *   2. Card flips in from the deck position (scale + rotateY)
 *   3. Deck glows with card-type accent
 *   4. Icon / Card-art illustration bounces in
 *   5. Text reveals line by line
 *   6. Auto-dismiss after 4 s (or tap to dismiss early)
 *
 * Multiplayer-safe: component is purely presentational.
 * Parent owns `card` state and `onDismiss` callback.
 *
 * Props:
 *   card       — { id, deck: 'chance'|'community', title, text, icon }
 *   onDismiss  — called when popup should close
 */
import React, { useEffect, useState, useRef } from 'react';

// ── CSS injected once ─────────────────────────────────────────────────────────
const CARD_CSS = `
@keyframes cardBackdropIn {
  from { opacity: 0 }
  to   { opacity: 1 }
}
@keyframes cardBackdropOut {
  from { opacity: 1 }
  to   { opacity: 0 }
}
@keyframes cardFlipIn {
  0%   { opacity: 0; transform: perspective(800px) rotateY(-90deg) scale(0.7); }
  60%  { transform: perspective(800px) rotateY(8deg) scale(1.04); }
  100% { opacity: 1; transform: perspective(800px) rotateY(0deg) scale(1); }
}
@keyframes cardFlipOut {
  from { opacity: 1; transform: perspective(800px) rotateY(0deg) scale(1); }
  to   { opacity: 0; transform: perspective(800px) rotateY(90deg) scale(0.7); }
}
@keyframes deckGlow {
  0%,100% { box-shadow: 0 0 0 0 transparent; }
  50%      { box-shadow: 0 0 32px 8px var(--deck-accent); }
}
@keyframes iconBounce {
  0%   { transform: scale(0)   translateY(10px); opacity: 0; }
  60%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
  100% { transform: scale(1)   translateY(0);    opacity: 1; }
}
@keyframes textReveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmerSlide {
  from { transform: translateX(-100%) skewX(-12deg); }
  to   { transform: translateX(200%)  skewX(-12deg); }
}
@keyframes cornerPulse {
  0%,100% { opacity: 0.4; }
  50%      { opacity: 0.9; }
}
@keyframes pulse {
  0%   { transform: scale(0.96); opacity: 0.7; }
  100% { transform: scale(1.04); opacity: 1; }
}
@keyframes float-slow {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%      { transform: translateY(-5px) rotate(2deg); }
}
@keyframes float-fast {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%      { transform: translateY(-7px) rotate(-3deg); }
}

@media (max-width: 768px) {
  .mobile-card-popup-container {
    align-items: flex-end !important;
  }
  .mobile-card-popup-card {
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 24px 24px 0 0 !important;
    border-bottom: none !important;
    border-left: none !important;
    border-right: none !important;
    padding: 24px 20px 32px !important;
    margin-bottom: 0 !important;
    animation: mobileCardSlideUp 0.35s cubic-bezier(0.34, 1.3, 0.64, 1) forwards !important;
  }
  .mobile-card-popup-card.leaving {
    animation: mobileCardSlideDown 0.28s ease-in forwards !important;
  }
  @keyframes mobileCardSlideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes mobileCardSlideDown {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(100%); opacity: 0; }
  }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = CARD_CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

// ── VECTOR ILLUSTRATION COMPONENTS ──────────────────────────────────────────

const PoliceCarSvg = ({ accent }) => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <radialGradient id="sirenGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sirenBlue" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1.5" />
    <circle cx="42" cy="35" r="22" fill="url(#sirenGlow)" opacity="0.6" style={{ animation: 'pulse 1s infinite alternate' }} />
    <circle cx="78" cy="35" r="22" fill="url(#sirenBlue)" opacity="0.6" style={{ animation: 'pulse 1s infinite alternate-reverse' }} />
    <path d="M20 75 L25 60 C27 54, 35 52, 45 52 L75 52 C85 52, 93 54, 95 60 L100 75 C103 76, 105 79, 105 82 L105 90 C105 92, 103 94, 100 94 L94 94 C92 98, 87 102, 82 102 C77 102, 72 98, 70 94 L50 94 C48 98, 43 102, 38 102 C33 102, 28 98, 26 94 L20 94 C17 94, 15 92, 15 90 L15 82 C15 79, 17 76, 20 75 Z" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
    <path d="M30 60 L33 55 C34 53, 37 53, 40 53 L80 53 C83 53, 86 53, 87 55 L90 60 Z" fill="#60a5fa" opacity="0.8" />
    <rect x="58" y="53" width="4" height="7" fill="#1e293b" />
    <rect x="42" y="66" width="36" height="15" fill="#f8fafc" rx="2" />
    <text x="60" y="77" fill="#0f172a" fontSize="10" fontWeight="900" textAnchor="middle" letterSpacing="0.05em" fontFamily="sans-serif">POLICE</text>
    <rect x="50" y="47" width="20" height="5" fill="#334155" rx="1" />
    <circle cx="54" cy="46" r="3" fill="#ef4444" />
    <circle cx="66" cy="46" r="3" fill="#3b82f6" />
    <circle cx="23" cy="81" r="4" fill="#fef08a" />
    <circle cx="97" cy="81" r="4" fill="#fef08a" />
    <circle cx="38" cy="94" r="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
    <circle cx="38" cy="94" r="4" fill="#94a3b8" />
    <circle cx="82" cy="94" r="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
    <circle cx="82" cy="94" r="4" fill="#94a3b8" />
  </svg>
);

const MoneyChestSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <radialGradient id="chestGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="55" r="40" fill="url(#chestGlow)" />
    <circle cx="60" cy="60" r="50" fill="rgba(251, 191, 36, 0.08)" stroke="rgba(251, 191, 36, 0.2)" strokeWidth="1.5" />
    <circle cx="35" cy="30" r="7" fill="url(#goldGrad)" style={{ animation: 'float-slow 2s infinite ease-in-out' }} />
    <circle cx="85" cy="25" r="5" fill="url(#goldGrad)" style={{ animation: 'float-fast 1.6s infinite ease-in-out' }} />
    <circle cx="50" cy="20" r="6" fill="url(#goldGrad)" style={{ animation: 'float-slow 2.4s infinite ease-in-out' }} />
    <path d="M25 45 C25 25, 95 25, 95 45 Z" fill="#78350f" stroke="#451a03" strokeWidth="2.5" />
    <path d="M28 45 C28 30, 92 30, 92 45 Z" fill="#92400e" />
    <path d="M40 31 C40 33, 40 40, 40 45" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
    <path d="M80 31 C80 33, 80 40, 80 45" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
    <ellipse cx="60" cy="50" rx="32" ry="8" fill="url(#goldGrad)" />
    <circle cx="48" cy="48" r="5" fill="#fef08a" />
    <circle cx="65" cy="47" r="6" fill="#fef08a" />
    <circle cx="74" cy="49" r="4" fill="#fbbf24" />
    <path d="M22 48 L98 48 L94 85 L26 85 Z" fill="#451a03" stroke="#270501" strokeWidth="2.5" />
    <path d="M25 50 L95 50 L91 82 L29 82 Z" fill="#78350f" />
    <rect x="35" y="56" width="50" height="20" fill="none" stroke="#451a03" strokeWidth="1.5" />
    <line x1="60" y1="50" x2="60" y2="82" stroke="#451a03" strokeWidth="2.5" />
    <path d="M22 48 L32 48 L29 85 L22 85 Z" fill="#fbbf24" opacity="0.8" />
    <path d="M98 48 L88 48 L91 85 L98 85 Z" fill="#fbbf24" opacity="0.8" />
    <rect x="53" y="48" width="14" height="16" fill="#fbbf24" rx="2" stroke="#d97706" strokeWidth="1" />
    <circle cx="60" cy="56" r="3" fill="#000" />
  </svg>
);

const TechSvg = ({ accent }) => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <radialGradient id="techGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
        <stop offset="100%" stopColor={accent} stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(59, 130, 246, 0.08)" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" />
    <circle cx="60" cy="50" r="35" fill="url(#techGlow)" />
    <text x="25" y="32" fill={accent} opacity="0.3" fontSize="8" fontFamily="monospace">01</text>
    <text x="88" y="28" fill={accent} opacity="0.3" fontSize="8" fontFamily="monospace">10</text>
    <text x="22" y="68" fill={accent} opacity="0.2" fontSize="8" fontFamily="monospace">11</text>
    <text x="92" y="65" fill={accent} opacity="0.2" fontSize="8" fontFamily="monospace">00</text>
    <rect x="25" y="35" width="70" height="46" rx="4" fill="url(#screenGrad)" stroke="#475569" strokeWidth="2.5" />
    <rect x="28" y="38" width="64" height="40" rx="2" fill="#020617" />
    <line x1="32" y1="48" x2="88" y2="48" stroke="#1e293b" strokeWidth="0.5" />
    <line x1="32" y1="58" x2="88" y2="58" stroke="#1e293b" strokeWidth="0.5" />
    <line x1="32" y1="68" x2="88" y2="68" stroke="#1e293b" strokeWidth="0.5" />
    <path d="M32 72 L45 62 L58 66 L72 50 L88 43" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="88" cy="43" r="3" fill="#fff" filter={`drop-shadow(0 0 4px ${accent})`} />
    <path d="M15 81 L105 81 C108 81, 110 83, 108 86 L104 92 C103 94, 100 94, 98 94 L22 94 C20 94, 17 94, 16 92 L12 86 C10 83, 12 81, 15 81 Z" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
    <rect x="52" y="84" width="16" height="6" rx="1" fill="#475569" />
  </svg>
);

const TrainSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="trainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="40%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
      <radialGradient id="headlightGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(241, 245, 249, 0.06)" stroke="rgba(203, 213, 225, 0.2)" strokeWidth="1.5" />
    <path d="M15 110 L50 78 L70 78 L105 110" fill="none" stroke="#475569" strokeWidth="3" />
    <line x1="38" y1="90" x2="82" y2="90" stroke="#334155" strokeWidth="2" />
    <line x1="44" y1="84" x2="76" y2="84" stroke="#334155" strokeWidth="1.5" />
    <line x1="48" y1="80" x2="72" y2="80" stroke="#334155" strokeWidth="1" />
    <path d="M42 45 C42 30, 78 30, 78 45 L74 78 C74 81, 70 83, 60 83 C50 83, 46 81, 46 78 Z" fill="url(#trainGrad)" stroke="#1e293b" strokeWidth="2" />
    <path d="M47 43 C47 38, 73 38, 73 43 L71 52 C71 54, 69 55, 60 55 C51 55, 49 54, 49 52 Z" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1" />
    <path d="M51 44 L69 44 L67 48 L53 48 Z" fill="#60a5fa" opacity="0.6" />
    <path d="M44.5 64 L75.5 64 L75 69 L45 69 Z" fill="#dc2626" />
    <path d="M45 69 L75 69 L74.7 71 L45.3 71 Z" fill="#eab308" />
    <circle cx="50" cy="76" r="12" fill="url(#headlightGlow)" />
    <circle cx="70" cy="76" r="12" fill="url(#headlightGlow)" />
    <circle cx="50" cy="76" r="3" fill="#fff" />
    <circle cx="70" cy="76" r="3" fill="#fff" />
    <circle cx="60" cy="38" r="8" fill="url(#headlightGlow)" />
    <circle cx="60" cy="38" r="2" fill="#fff" />
  </svg>
);

const BuildingSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(30, 58, 138, 0.08)" stroke="rgba(30, 58, 138, 0.2)" strokeWidth="1.5" />
    <rect x="25" y="25" width="70" height="70" rx="8" fill="url(#blueGrad)" stroke="#3b82f6" strokeWidth="2" />
    <line x1="39" y1="25" x2="39" y2="95" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="53" y1="25" x2="53" y2="95" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="67" y1="25" x2="67" y2="95" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="81" y1="25" x2="81" y2="95" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="25" y1="39" x2="95" y2="39" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="25" y1="53" x2="95" y2="53" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="25" y1="67" x2="95" y2="67" stroke="#1d4ed8" strokeWidth="0.5" />
    <line x1="25" y1="81" x2="95" y2="81" stroke="#1d4ed8" strokeWidth="0.5" />
    <path d="M35 85 L35 55 L48 55 L48 40 L60 40 L60 32 L72 32 L72 48 L85 48 L85 85 Z" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 2" />
    <path d="M42 85 L42 65 L48 65 M48 85 L48 72 M54 85 L54 48 M66 85 L66 38 M78 85 L78 58" fill="none" stroke="#60a5fa" strokeWidth="1" />
    <g transform="translate(60, 60) rotate(-45) translate(-60, -60)">
      <rect x="56" y="35" width="8" height="50" fill="#fbbf24" stroke="#d97706" strokeWidth="1" rx="2" />
      <circle cx="60" cy="35" r="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
      <rect x="55" y="25" width="10" height="8" fill="#1e3a8a" />
      <circle cx="60" cy="85" r="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
      <rect x="55" y="87" width="10" height="8" fill="#0f172a" />
    </g>
  </svg>
);

const HospitalSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="heartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
      <radialGradient id="heartGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1.5" />
    <circle cx="60" cy="55" r="35" fill="url(#heartGlow)" />
    <path d="M50 25 H70 V45 H90 V65 H70 V85 H50 V65 H30 V45 H50 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    <path d="M60 78 C60 78, 28 56, 28 42 C28 30, 42 24, 60 40 C78 24, 92 30, 92 42 C92 56, 60 78, 60 78 Z" fill="url(#heartGrad)" stroke="#b91c1c" strokeWidth="2" style={{ animation: 'pulse 1.2s infinite' }} />
    <path d="M35 52 L50 52 L54 44 L58 62 L62 48 L65 55 L70 52 L85 52" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CelebrationSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="cakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(236, 72, 153, 0.08)" stroke="rgba(236, 72, 153, 0.2)" strokeWidth="1.5" />
    <circle cx="30" cy="35" r="2" fill="#fbbf24" />
    <circle cx="90" cy="30" r="2.5" fill="#60a5fa" />
    <circle cx="40" cy="22" r="1.5" fill="#34d399" />
    <path d="M25 25 L29 27" stroke="#fb7185" strokeWidth="1.5" />
    <path d="M92 42 L96 40" stroke="#fb7185" strokeWidth="1.5" />
    <g style={{ animation: 'float-slow 2s infinite ease-in-out' }}>
      <circle cx="28" cy="60" r="10" fill="#60a5fa" opacity="0.8" />
      <path d="M28 70 Q28 80, 24 85" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    </g>
    <g style={{ animation: 'float-fast 1.8s infinite ease-in-out' }}>
      <circle cx="92" cy="55" r="9" fill="#fbbf24" opacity="0.8" />
      <path d="M92 64 Q92 74, 96 78" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    </g>
    <rect x="35" y="65" width="50" height="20" rx="3" fill="url(#cakeGrad)" stroke="#db2777" strokeWidth="2" />
    <path d="M35 70 C40 72, 45 72, 50 70 C55 68, 60 68, 65 70 C70 72, 75 72, 80 70 C85 68, 85 70, 85 70" fill="none" stroke="#fff" strokeWidth="2.5" />
    <rect x="42" y="50" width="36" height="16" rx="2" fill="#fbcfe8" stroke="#db2777" strokeWidth="1.5" />
    <rect x="48" y="40" width="2" height="10" fill="#fbbf24" />
    <path d="M49 34 C49 34, 47 37, 49 40 C51 37, 49 34, 49 34 Z" fill="#ef4444" />
    <rect x="60" y="40" width="2" height="10" fill="#60a5fa" />
    <path d="M61 34 C61 34, 59 37, 61 40 C63 37, 61 34, 61 34 Z" fill="#f59e0b" />
    <rect x="70" y="40" width="2" height="10" fill="#fbbf24" />
    <path d="M71 34 C71 34, 69 37, 71 40 C73 37, 71 34, 71 34 Z" fill="#ef4444" />
  </svg>
);

const EducationSvg = () => (
  <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
    <defs>
      <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="rgba(71, 85, 105, 0.08)" stroke="rgba(71, 85, 105, 0.2)" strokeWidth="1.5" />
    <path d="M30 60 C30 75, 45 85, 60 85 C75 85, 90 75, 90 60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" strokeLinecap="round" />
    <path d="M42 55 L42 68 C42 74, 78 74, 78 68 L78 55 Z" fill="url(#capGrad)" stroke="#1e293b" strokeWidth="2" />
    <path d="M60 32 L95 48 L60 64 L25 48 Z" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <path d="M60 35 L90 48 L60 61 L30 48 Z" fill="#0f172a" />
    <circle cx="60" cy="48" r="2.5" fill="#fbbf24" />
    <path d="M60 48 L38 56 L38 68" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="36" y="68" width="4" height="6" fill="#fbbf24" rx="0.5" />
    <g transform="translate(40, 80) rotate(-10)">
      <rect x="0" y="0" width="38" height="10" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="16" y="0" width="6" height="10" fill="#ef4444" />
      <path d="M16 10 L14 15 L19 13 L24 15 L22 10" fill="#ef4444" />
    </g>
  </svg>
);

const FallbackSvg = ({ isChance, accent }) => {
  if (isChance) {
    return (
      <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
        <defs>
          <radialGradient id="qGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldGradText" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="rgba(245, 158, 11, 0.08)" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="1.5" />
        <circle cx="60" cy="55" r="35" fill="url(#qGlow)" />
        <text x="60" y="80" fill="url(#goldGradText)" fontSize="62" fontWeight="900" textAnchor="middle" filter="drop-shadow(0 0 12px rgba(245,158,11,0.55))" fontFamily="'Playfair Display', serif">?</text>
      </svg>
    );
  } else {
    return (
      <svg viewBox="0 0 120 120" style={{ width: 130, height: 130, margin: '8px auto' }}>
        <defs>
          <radialGradient id="cGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="rgba(59, 130, 246, 0.08)" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" />
        <circle cx="60" cy="55" r="35" fill="url(#cGlow)" />
        <rect x="35" y="45" width="50" height="36" rx="4" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2.5" />
        <path d="M35 55 H85" stroke="#3b82f6" strokeWidth="2" />
        <rect x="54" y="52" width="12" height="10" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        <circle cx="60" cy="57" r="2" fill="#000" />
      </svg>
    );
  }
};

// ── ILLUSTRATION ROUTER ──────────────────────────────────────────────────────

function getCardIllustration(card, accent) {
  const id = card?.id || '';
  const title = card?.title || '';
  const deck = card?.deck || 'chance';

  // Police / Raid / Challan template
  if (
    id === 'CH-11' || 
    id === 'CH-27' || 
    id === 'CC-26' || 
    title.toLowerCase().includes('traffic') ||
    title.toLowerCase().includes('raid') ||
    title.toLowerCase().includes('arrested') ||
    card.icon === '🚔'
  ) {
    return <PoliceCarSvg accent={accent} />;
  }

  // Tech / Screen template
  if (
    id === 'CH-07' || 
    id === 'CH-15' || 
    id === 'CH-26' || 
    id === 'CH-09' || 
    id === 'CH-02' || 
    title.toLowerCase().includes('tech') ||
    title.toLowerCase().includes('freelance') ||
    title.toLowerCase().includes('hackathon') ||
    title.toLowerCase().includes('crypto') ||
    card.icon === '💻' || card.icon === '🖥️' || card.icon === '📱'
  ) {
    return <TechSvg accent={accent} />;
  }

  // Medical / Heart / Shield template
  if (
    id === 'CH-12' || 
    id === 'CC-14' || 
    id === 'CC-20' || 
    title.toLowerCase().includes('hospital') ||
    title.toLowerCase().includes('medical') ||
    title.toLowerCase().includes('health') ||
    card.icon === '🏥' || card.icon === '🩺'
  ) {
    return <HospitalSvg />;
  }

  // Train / Travel template
  if (
    id === 'CH-14' || 
    id === 'CH-20' || 
    id === 'CH-21' || 
    id === 'CH-23' || 
    id === 'CC-12' || 
    id === 'CC-15' || 
    id === 'CC-16' || 
    title.toLowerCase().includes('train') ||
    title.toLowerCase().includes('railway') ||
    title.toLowerCase().includes('travel') ||
    title.toLowerCase().includes('breakdown') ||
    card.icon === '🚂' || card.icon === '🚆' || card.icon === '✈️'
  ) {
    return <TrainSvg />;
  }

  // Building / Infrastructure / Repairs template
  if (
    id === 'CH-18' || 
    id === 'CH-24' || 
    id === 'CC-18' || 
    id === 'CC-21' || 
    id === 'CC-24' || 
    title.toLowerCase().includes('utility') ||
    title.toLowerCase().includes('maintenance') ||
    title.toLowerCase().includes('repairs') ||
    title.toLowerCase().includes('electricity') ||
    card.icon === '🔧' || card.icon === '⚡' || card.icon === '🏗️'
  ) {
    return <BuildingSvg />;
  }

  // Celebration / Birthday / Ribbon template
  if (
    id === 'CH-03' || 
    id === 'CH-13' || 
    id === 'CH-22' || 
    id === 'CH-29' || 
    id === 'CC-09' || 
    id === 'CC-10' || 
    id === 'CC-13' || 
    id === 'CC-19' || 
    id === 'CC-25' || 
    id === 'CC-28' || 
    id === 'CC-29' || 
    title.toLowerCase().includes('birthday') ||
    title.toLowerCase().includes('wedding') ||
    title.toLowerCase().includes('award') ||
    title.toLowerCase().includes('prize') ||
    title.toLowerCase().includes('parade') ||
    title.toLowerCase().includes('diwali') ||
    card.icon === '🎂' || card.icon === '🎉' || card.icon === '🏅' || card.icon === '🌟' || card.icon === '💒'
  ) {
    return <CelebrationSvg />;
  }

  // Education / Scholarship / Certificate template
  if (
    id === 'CC-01' || 
    id === 'CC-02' || 
    id === 'CC-17' || 
    id === 'CH-30' || 
    title.toLowerCase().includes('scholarship') ||
    title.toLowerCase().includes('increment') ||
    title.toLowerCase().includes('chairman') ||
    title.toLowerCase().includes('school') ||
    card.icon === '🎓' || card.icon === '📚' || card.icon === '👔'
  ) {
    return <EducationSvg />;
  }

  // Money Chest (Gold coins, cash, deposits) template
  if (
    id === 'CH-01' || 
    id === 'CH-04' || 
    id === 'CH-05' || 
    id === 'CH-06' || 
    id === 'CH-08' || 
    id === 'CH-10' || 
    id === 'CC-03' || 
    id === 'CC-04' || 
    id === 'CC-05' || 
    id === 'CC-06' || 
    id === 'CC-08' || 
    id === 'CC-11' || 
    id === 'CC-22' || 
    id === 'CC-30' || 
    title.toLowerCase().includes('bonus') ||
    title.toLowerCase().includes('investor') ||
    title.toLowerCase().includes('cash') ||
    title.toLowerCase().includes('refund') ||
    title.toLowerCase().includes('subsidy') ||
    title.toLowerCase().includes('profit') ||
    title.toLowerCase().includes('jackpot') ||
    title.toLowerCase().includes('maturity') ||
    card.icon === '🏏' || card.icon === '🪔' || card.icon === '📈' || card.icon === '🏛️' || card.icon === '🏆' || card.icon === '🚀' || card.icon === '🏦' || card.icon === '💰' || card.icon === '💵'
  ) {
    return <MoneyChestSvg />;
  }

  // Default / Fallback template (glowing ? or chest)
  return <FallbackSvg isChance={deck === 'chance'} accent={accent} />;
}

// ── CARD POPUP COMPONENT ──────────────────────────────────────────────────────

export function CardPopup({ card, onDismiss }) {
  injectCSS();
  const [phase, setPhase] = useState('idle'); // idle → entering → showing → leaving
  const timersRef = useRef([]);

  const clear = () => timersRef.current.forEach(clearTimeout);

  useEffect(() => {
    if (!card) { setPhase('idle'); return; }
    clear();
    setPhase('entering');
    const t1 = setTimeout(() => setPhase('showing'), 480);
    const t2 = setTimeout(() => setPhase('leaving'), 4200);
    const t3 = setTimeout(() => { onDismiss?.(); setPhase('idle'); }, 4500);
    timersRef.current = [t1, t2, t3];
    return clear;
  }, [card]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card || phase === 'idle') return null;

  const isChance   = card.deck === 'chance';
  const accent     = isChance ? '#f59e0b' : '#3b82f6';
  const accentDim  = isChance ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)';
  const bgGrad     = isChance
    ? 'linear-gradient(160deg,#1a1000 0%,#120b00 45%,#0a0600 100%)'
    : 'linear-gradient(160deg,#00091a 0%,#000d22 45%,#000710 100%)';
  const deckLabel  = isChance ? '❓ Chance' : '📦 Community Chest';

  const isLeaving  = phase === 'leaving';
  const isEntering = phase === 'entering';

  const dismiss = () => {
    clear();
    setPhase('leaving');
    setTimeout(() => { onDismiss?.(); setPhase('idle'); }, 320);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dismiss();
        }
      }}
      className="mobile-card-popup-container"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1200,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        animation:      isLeaving
          ? 'cardBackdropOut 0.32s ease-in forwards'
          : 'cardBackdropIn 0.25s ease-out forwards',
        cursor:         'pointer',
      }}
    >
      {/* Deck glow behind card */}
      <div style={{
        position:     'absolute',
        width:        180,
        height:       240,
        borderRadius: 18,
        background:   accentDim,
        '--deck-accent': `${accent}60`,
        animation:    'deckGlow 1.4s ease-in-out infinite',
        pointerEvents:'none',
      }} />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mobile-card-popup-card ${isLeaving ? 'leaving' : ''}`}
        style={{
          position:     'relative',
          width:        340,
          maxWidth:     '92vw',
          borderRadius: 22,
          padding:      '32px 26px 24px',
          background:   bgGrad,
          border:       `2px solid ${accent}45`,
          boxShadow:    `0 28px 90px rgba(0,0,0,0.75), 0 0 50px ${accent}22`,
          textAlign:    'center',
          fontFamily:   "'DM Sans', sans-serif",
          overflow:     'hidden',
          animation:    isEntering
            ? 'cardFlipIn 0.48s cubic-bezier(0.34,1.4,0.64,1) forwards'
            : isLeaving
              ? 'cardFlipOut 0.32s ease-in forwards'
              : 'none',
        }}
      >
        {/* Top shimmer line */}
        <div style={{
          position:   'absolute',
          top: 0, left: 0, right: 0,
          height:     2,
          background: `linear-gradient(90deg,transparent,${accent},transparent)`,
        }} />

        {/* Animated shimmer sweep */}
        <div style={{
          position:    'absolute',
          inset:       0,
          overflow:    'hidden',
          borderRadius: 22,
          pointerEvents:'none',
        }}>
          <div style={{
            position:   'absolute',
            top: 0, bottom: 0,
            left: '-40%',
            width:      '30%',
            background: `linear-gradient(90deg,transparent,${accent}12,transparent)`,
            animation:  'shimmerSlide 2.8s ease-in-out infinite',
          }} />
        </div>

        {/* Corner ornaments */}
        {[{top:12,left:14},{top:12,right:14},{bottom:12,left:14},{bottom:12,right:14}].map((pos, i) => (
          <div key={i} style={{
            position:   'absolute',
            width:       16, height: 16,
            borderTop:  i < 2 ? `2px solid ${accent}60` : undefined,
            borderBottom:i >= 2 ? `2px solid ${accent}60` : undefined,
            borderLeft: (i === 0 || i === 2) ? `2px solid ${accent}60` : undefined,
            borderRight:(i === 1 || i === 3) ? `2px solid ${accent}60` : undefined,
            animation:  'cornerPulse 2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            ...pos,
          }} />
        ))}

        {/* Deck label */}
        <div style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color:         `${accent}95`,
          marginBottom:  14,
          animation:     'textReveal 0.4s ease-out 0.3s both',
        }}>
          {deckLabel}
        </div>

        {/* Styled Vector Illustration */}
        <div style={{
          marginBottom: 14,
          display:      'flex',
          justifyContent: 'center',
          alignItems:   'center',
          animation:    'iconBounce 0.5s cubic-bezier(0.34,1.5,0.64,1) 0.2s both',
        }}>
          {getCardIllustration(card, accent)}
        </div>

        {/* Title */}
        <h3 style={{
          fontSize:   20,
          fontWeight: 800,
          color:      accent,
          margin:     '0 0 10px',
          lineHeight: 1.2,
          textShadow: `0 0 24px ${accent}70`,
          animation:  'textReveal 0.4s ease-out 0.35s both',
          fontFamily: "'Playfair Display', serif",
        }}>
          {card.title}
        </h3>

        {/* Body text */}
        <p style={{
          fontSize:   14,
          color:      'rgba(215,219,228,0.85)',
          lineHeight: 1.65,
          margin:     '0 0 18px',
          animation:  'textReveal 0.4s ease-out 0.48s both',
        }}>
          {card.text}
        </p>

        {/* Dismiss hint */}
        <div style={{
          fontSize:      10,
          color:         'rgba(156,163,175,0.38)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          animation:     'textReveal 0.4s ease-out 0.9s both',
        }}>
          Tap to dismiss
        </div>
      </div>
    </div>
  );
}

export const ChanceDeckAnimation    = CardPopup;
export const CommunityDeckAnimation = CardPopup;
