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

function DieFace({ value, rolling, endRotation }) {
  const dots = DOT_POSITIONS[value] ?? DOT_POSITIONS[1];

  return (
    <div
      style={{
        width:        80,
        height:       80,
        borderRadius: 16,
        background:   'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
        border:       '2px solid rgba(0,0,0,0.3)',
        boxShadow:    '0 10px 28px rgba(0,0,0,0.65), inset 0 2.5px 2.5px rgba(255,255,255,0.9)',
        position:     'relative',
        flexShrink:   0,
        '--die-end-rot': `${endRotation}deg`,
        animation:    rolling === 'rolling'
          ? 'diceRoll 1.2s ease-in-out forwards'
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

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            12,
      width:          '100%',
      height:         '100%',
    }}>

      {/* Turn indicator */}
      {currentPlayer && (
        <div style={{
          fontSize:       14,
          fontWeight:     800,
          letterSpacing:  '0.06em',
          textTransform:  'uppercase',
          color:          currentPlayer.color,
          textAlign:      'center',
          lineHeight:     1.3,
          textShadow:     `0 0 12px ${currentPlayer.color}88`,
          padding:        '4px 12px',
          borderRadius:   8,
          background:     `${currentPlayer.color}18`,
          border:         `1px solid ${currentPlayer.color}40`,
          maxWidth:       '90%',
          overflow:       'hidden',
          textOverflow:   'ellipsis',
          whiteSpace:     'nowrap',
        }}>
          {currentPlayer.token} {currentPlayer.username}
        </div>
      )}

      {/* Dice display */}
      {displayDice ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: 0.6 }}>
          <DieFace value={1} rolling="none" endRotation={-15} />
          <DieFace value={1} rolling="none" endRotation={12} />
        </div>
      )}

      {/* Total + double indicator */}
      {isShowing && displayDice && (
        <div style={{
          fontSize:    14,
          fontWeight:  800,
          color:       displayDice.d1 === displayDice.d2 ? '#f59e0b' : 'rgba(255,255,255,0.7)',
          letterSpacing: '0.05em',
          textShadow:  displayDice.d1 === displayDice.d2 ? '0 0 8px rgba(245,158,11,0.8)' : 'none',
        }}>
          {displayDice.d1 === displayDice.d2 ? '🎯 DOUBLE!' : `= ${displayDice.d1 + displayDice.d2}`}
        </div>
      )}

      {/* Roll button */}
      {canRoll && (
        <button
          onClick={onRoll}
          style={{
            padding:        '10px 22px',
            borderRadius:   10,
            background:     'linear-gradient(135deg, #d97706, #f59e0b)',
            color:          '#0a0805',
            fontWeight:     900,
            fontSize:       13,
            letterSpacing:  '0.08em',
            textTransform:  'uppercase',
            border:         'none',
            cursor:         'pointer',
            boxShadow:      '0 4px 14px rgba(245,158,11,0.5)',
            transition:     'transform 0.15s, box-shadow 0.15s',
            fontFamily:     "'DM Sans', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform  = 'scale(1.07)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(245,158,11,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform  = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,0.5)';
          }}
        >
          🎲 Roll
        </button>
      )}

      {/* Pending action hint */}
      {pendingAction === 'buy_decision' && isMyTurn && (
        <div style={{
          fontSize:    10,
          color:       '#f59e0b',
          textAlign:   'center',
          fontWeight:  600,
          letterSpacing: '0.04em',
          animation:   'tokenGlow 1.5s ease-in-out infinite',
        }}>
          Buy or Auction?
        </div>
      )}
    </div>
  );
});