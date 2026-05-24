/**
 * components/Board/ChanceDeckAnimation.jsx
 *
 * Premium card reveal popup for Chance and Community Chest.
 * Sequence:
 *   1. Backdrop fades in with blur
 *   2. Card flips in from the deck position (scale + rotateY)
 *   3. Deck glows with card-type accent
 *   4. Icon bounces in
 *   5. Text reveals line by line
 *   6. Auto-dismiss after 4 s (or tap to dismiss early)
 *
 * Multiplayer-safe: component is purely presentational.
 * Parent owns `card` state and `onDismiss` callback.
 *
 * Props:
 *   card       — { deck: 'chance'|'community', title, text, icon }
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
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = CARD_CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

// ── Card popup ────────────────────────────────────────────────────────────────
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
      onClick={dismiss}
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

        {/* Icon */}
        <div style={{
          fontSize:     52,
          lineHeight:   1,
          marginBottom: 12,
          display:      'block',
          filter:       `drop-shadow(0 0 20px ${accent}90)`,
          animation:    'iconBounce 0.5s cubic-bezier(0.34,1.5,0.64,1) 0.2s both',
        }}>
          {card.icon}
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
