/**
 * components/Board/DiceArena.jsx
 *
 * Renders the dice in the center of the board.
 * Shows rolling animation → lands on server-correct values.
 */
import React from 'react';

// SVG dice face dot positions for each value 1–6
const DOT_POSITIONS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
};

import { useState, useRef, useEffect } from 'react';

function DieFace({ value, rolling, endRotation }) {
  const dots = DOT_POSITIONS[value] ?? DOT_POSITIONS[1];

  return (
    <div
      style={{
        width:        'var(--die-size, 80px)',
        height:       'var(--die-size, 80px)',
        borderRadius: 'var(--die-border-radius, 16px)',
        background:   'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
        border:       '2px solid rgba(0,0,0,0.3)',
        boxShadow:    '0 10px 28px rgba(0,0,0,0.65), inset 0 2.5px 2.5px rgba(255,255,255,0.9)',
        position:     'relative',
        flexShrink:   0,
        '--die-end-rot': `${endRotation}deg`,
        animation:    rolling === 'rolling'
          ? 'diceRoll3D 1.2s ease-in-out forwards'
          : rolling === 'landing'
            ? 'diceLand 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards'
            : 'none',
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={11} fill="#1a1a2e" />
        ))}
      </svg>
    </div>
  );
}

export const DiceArena = React.memo(function DiceArena({
  dicePhase,
  displayDice,
  currentPlayer,
  hasRolled,
  isMyTurn,
  onRoll,
  pendingAction,
}) {
  const isRolling = dicePhase === 'rolling';
  const isLanding = dicePhase === 'landing';
  const isShowing = dicePhase === 'showing';
  const isIdle    = dicePhase === 'idle';

  const canRoll   = isMyTurn && isIdle && !hasRolled;

  // Drag-and-Release physics cup states
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  const handleStart = (e) => {
    if (!canRoll) return;
    setIsDragging(true);
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartYRef.current;
    const newDragY = Math.min(80, Math.max(0, deltaY));
    setDragY(newDragY);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY >= 35) {
      onRoll();
    }
    setDragY(0);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      // Prevent page scrolling on mobile during cup drag
      if (e.cancelable) e.preventDefault();
      handleMove(e);
    };
    const onEnd = () => handleEnd();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, dragY]);

  const cupScale = 1 + (dragY / 400);
  const cupRotation = (dragY / 4.5);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--dice-arena-gap, 12px)',
      width:          '100%',
      height:         '100%',
    }}>

      {/* Turn indicator */}
      {currentPlayer && (
        <div style={{
          fontSize:       'var(--die-font-size, 14px)',
          fontWeight:     800,
          letterSpacing:  '0.06em',
          textTransform:  'uppercase',
          color:          currentPlayer.color,
          textAlign:      'center',
          lineHeight:     1.3,
          textShadow:     `0 0 12px ${currentPlayer.color}88`,
          padding:        'var(--center-toast-padding, 4px 12px)',
          borderRadius:   8,
          background:     `${currentPlayer.color}18`,
          border:         `1px solid ${currentPlayer.color}40`,
          maxWidth:       '90%',
          overflow:       'hidden',
          textOverflow:   'ellipsis',
          whiteSpace:     'nowrap',
          marginBottom:   4,
        }}>
          {currentPlayer.token} {currentPlayer.username}
        </div>
      )}

      {/* Drag-and-Release physics cup / Dice display */}
      {canRoll ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            style={{
              width: 90,
              height: 110,
              cursor: 'grab',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              transform: `translateY(${dragY}px) scaleY(${cupScale}) rotate(${cupRotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* Cup Lip */}
            <div style={{
              width: 76,
              height: 22,
              background: '#140802',
              border: '2px solid #fbbf24',
              borderRadius: '50%',
              position: 'absolute',
              top: 0,
              zIndex: 2,
              boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              {/* Peeking dice inside cup */}
              <div style={{ width: 8, height: 8, background: '#ffffff', borderRadius: 2, opacity: dragY > 15 ? 0.3 : 0.8 }} />
              <div style={{ width: 8, height: 8, background: '#ffffff', borderRadius: 2, opacity: dragY > 15 ? 0.3 : 0.8 }} />
            </div>
            
            {/* Cup Body */}
            <div style={{
              width: 76,
              height: 85,
              background: 'linear-gradient(135deg, #3d1b04 0%, #d4af37 50%, #210e02 100%)',
              border: '2px solid rgba(251,191,36,0.7)',
              borderTop: 'none',
              borderRadius: '0 0 20px 20px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
              position: 'absolute',
              top: 10,
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span style={{
                fontSize: 7, fontWeight: 900, color: '#000000',
                letterSpacing: '0.05em', textTransform: 'uppercase',
                background: 'rgba(255,255,255,0.45)', padding: '2px 5px',
                borderRadius: 3, marginTop: 4
              }}>
                {dragY > 35 ? 'Release!' : 'Pull Down'}
              </span>
            </div>
          </div>
        </div>
      ) : displayDice ? (
        <div style={{ display: 'flex', gap: 'var(--dice-arena-gap, 12px)', alignItems: 'center' }}>
          <DieFace
            value={displayDice.d1}
            rolling={dicePhase === 'rolling' ? 'rolling' : dicePhase === 'landing' ? 'landing' : 'none'}
            endRotation={-15}
          />
          <DieFace
            value={displayDice.d2}
            rolling={dicePhase === 'rolling' ? 'rolling' : dicePhase === 'landing' ? 'landing' : 'none'}
            endRotation={12}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--dice-arena-gap, 12px)', alignItems: 'center', opacity: 0.6 }}>
          <DieFace value={1} rolling="none" endRotation={-15} />
          <DieFace value={1} rolling="none" endRotation={12} />
        </div>
      )}

      {/* Total + double indicator */}
      {isShowing && displayDice && (
        <div style={{
          fontSize:    'var(--die-font-size, 14px)',
          fontWeight:  800,
          color:       displayDice.d1 === displayDice.d2 ? '#f59e0b' : 'rgba(255,255,255,0.7)',
          letterSpacing: '0.05em',
          textShadow:  displayDice.d1 === displayDice.d2 ? '0 0 8px rgba(245,158,11,0.8)' : 'none',
        }}>
          {displayDice.d1 === displayDice.d2 ? '🎯 DOUBLE!' : `= ${displayDice.d1 + displayDice.d2}`}
        </div>
      )}

      {/* Roll button fallback */}
      {canRoll && (
        <button
          onClick={onRoll}
          style={{
            padding:        'var(--die-button-padding, 8px 18px)',
            borderRadius:   8,
            background:     'rgba(251,191,36,0.1)',
            color:          '#fbbf24',
            fontWeight:     800,
            fontSize:       'var(--die-button-font, 11px)',
            letterSpacing:  '0.06em',
            textTransform:  'uppercase',
            border:         '1px solid rgba(251,191,36,0.35)',
            cursor:         'pointer',
            transition:     'transform 0.15s, background 0.15s',
            fontFamily:     "'DM Sans', sans-serif",
            marginTop:      4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(251,191,36,0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(251,191,36,0.1)';
          }}
        >
          🎲 Roll directly
        </button>
      )}
    </div>
  );
});