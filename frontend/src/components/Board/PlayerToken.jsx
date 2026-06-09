/**
 * components/Board/PlayerToken.jsx
 * Animated player token. Receives position offset for stacking.
 */
import React from 'react';

export const PlayerToken = React.memo(function PlayerToken({
  player,
  offsetX,
  offsetY,
  isCurrentPlayer,
  isArriving,
  isMe,
}) {
  return (
    <div
      title={`${player.username}${player.isBankrupt ? ' (bankrupt)' : ''}`}
      style={{
        position:        'relative',
        width:           28,
        height:          28,
        borderRadius:    '50%',
        background:      player.isBankrupt
          ? 'rgba(60,60,60,0.7)'
          : `radial-gradient(circle at 35% 35%, ${player.color}dd, ${player.color}88)`,
        border:          isCurrentPlayer
          ? `2px solid gold`
          : isMe
            ? `2px solid rgba(255,255,255,0.7)`
            : `1.5px solid rgba(255,255,255,0.3)`,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        15,
        transform:       `translate(${offsetX}px, ${offsetY}px)`,
        transition:      'transform 0.12s ease-out',
        zIndex:          isCurrentPlayer ? 20 : 10,
        boxShadow:       isCurrentPlayer
          ? `0 0 0 2px gold, 0 2px 8px rgba(0,0,0,0.5)`
          : `0 2px 6px rgba(0,0,0,0.4)`,
        opacity:         player.isBankrupt ? 0.4 : 1,
        cursor:          'default',
        // Animations
        animation: isArriving
          ? 'tokenBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards'
          : isCurrentPlayer
            ? 'tokenGlow 1.8s ease-in-out infinite'
            : 'none',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>
        {player.isBankrupt ? '💸' : player.token}
      </span>

      {/* "Me" indicator */}
      {isMe && !player.isBankrupt && (
        <div style={{
          position:    'absolute',
          bottom:      -6,
          left:        '50%',
          transform:   'translateX(-50%)',
          width:       4,
          height:      4,
          borderRadius: '50%',
          background:  'gold',
          boxShadow:   '0 0 4px gold',
        }} />
      )}
    </div>
  );
});