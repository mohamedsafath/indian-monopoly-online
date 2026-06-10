/**
 * components/Board/CornerTile.jsx
 *
 * Premium corner tile renderer.
 * Corners are 2×2 grid cells (larger), each with unique styling.
 */
import React from 'react';

const CORNER_CONFIG = {
  0: {
    label:    'START',
    sub:      'Collect ₹2,000',
    icon:     '🇮🇳',
    bg:       'linear-gradient(135deg, #0a3d0a 0%, #0d5e0d 50%, #0a3d0a 100%)',
    accent:   '#22c55e',
    glow:     'rgba(34,197,94,0.3)',
    arrow:    '←',
    arrowDir: 'bottom-left',
  },
  10: {
    label:    'TIHAR JAIL',
    sub:      'Just Visiting',
    icon:     '🔒',
    bg:       'linear-gradient(135deg, #1a0a00 0%, #2d1500 50%, #1a0a00 100%)',
    accent:   '#f59e0b',
    glow:     'rgba(245,158,11,0.25)',
    arrow:    '↑',
    arrowDir: 'top-left',
  },
  20: {
    label:    'TEA BREAK',
    sub:      'Free Parking ☕',
    icon:     '☕',
    bg:       'linear-gradient(135deg, #0a1a2e 0%, #0d2444 50%, #0a1a2e 100%)',
    accent:   '#38bdf8',
    glow:     'rgba(56,189,248,0.25)',
    arrow:    '→',
    arrowDir: 'top-right',
  },
  30: {
    label:    'TAX RAID',
    sub:      'Go To Tihar!',
    icon:     '🚔',
    bg:       'linear-gradient(135deg, #1a0010 0%, #2d0018 50%, #1a0010 100%)',
    accent:   '#f43f5e',
    glow:     'rgba(244,63,94,0.3)',
    arrow:    '↓',
    arrowDir: 'bottom-right',
  },
};

export const CornerTile = React.memo(function CornerTile({
  tileId,
  isOccupied,
  onClick,
}) {
  const cfg = CORNER_CONFIG[tileId];
  if (!cfg) return null;

  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: tileId === 0  ? '11 / 12' :
                    tileId === 10 ? '1 / 2'   :
                    tileId === 20 ? '1 / 2'   : '11 / 12',
        gridRow:    tileId === 0  ? '11 / 12' :
                    tileId === 10 ? '11 / 12' :
                    tileId === 20 ? '1 / 2'   : '1 / 2',
        background: cfg.bg,
        border:     `1px solid ${cfg.accent}30`,
        borderRadius: tileId === 0  ? '0 0 12px 0' :
                      tileId === 10 ? '0 0 0 12px'  :
                      tileId === 20 ? '12px 0 0 0'  : '0 12px 0 0',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        cursor:        'pointer',
        position:      'relative',
        overflow:      'hidden',
        boxShadow:     `inset 0 0 24px ${cfg.accent}35, 0 4px 16px rgba(0,0,0,0.5)`,
        transition:    'box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = `1.5px solid ${cfg.accent}80`;
        e.currentTarget.style.boxShadow = `inset 0 0 36px ${cfg.accent}55, 0 0 24px ${cfg.accent}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = `1px solid ${cfg.accent}30`;
        e.currentTarget.style.boxShadow = `inset 0 0 24px ${cfg.accent}35, 0 4px 16px rgba(0,0,0,0.5)`;
      }}
    >
      {/* Shimmer layer */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: `linear-gradient(45deg, transparent 30%, ${cfg.accent}08 50%, transparent 70%)`,
        backgroundSize: '200% 200%',
        animation:  'boardShimmer 4s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Diagonal accent line */}
      <div style={{
        position:     'absolute',
        width:        '130%',
        height:       '1px',
        background:   `linear-gradient(90deg, transparent, ${cfg.accent}40, transparent)`,
        transform:    'rotate(-45deg)',
        pointerEvents:'none',
      }} />

      {/* Icon */}
      <div style={{
        fontSize:   tileId === 0 ? 'var(--corner-icon-start-size, 38px)' : 'var(--corner-icon-size, 34px)',
        lineHeight: 1,
        filter:     `drop-shadow(0 0 8px ${cfg.accent}80)`,
        marginBottom: 'var(--corner-icon-margin, 8px)',
        zIndex:     2,
      }}>
        {cfg.icon}
      </div>

      {/* Label */}
      <div style={{
        fontSize:      'var(--corner-label-size, 16px)',
        fontWeight:    900,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color:         cfg.accent,
        textAlign:     'center',
        lineHeight:    1.2,
        zIndex:        2,
        textShadow:    `0 0 8px ${cfg.accent}60`,
      }}>
        {cfg.label}
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize:   'var(--corner-sub-size, 11px)',
        color:      'rgba(255,255,255,0.35)',
        marginTop:  'var(--corner-sub-margin, 4px)',
        textAlign:  'center',
        lineHeight: 1.2,
        zIndex:     2,
        padding:    '0 4px',
      }}>
        {cfg.sub}
      </div>

      {/* Occupied pulse */}
      {isOccupied && (
        <div style={{
          position:     'absolute',
          inset:        0,
          borderRadius: 'inherit',
          border:       `2px solid ${cfg.accent}`,
          animation:    'currentPlayerPulse 2s ease-in-out infinite',
          pointerEvents:'none',
        }} />
      )}
    </div>
  );
});
