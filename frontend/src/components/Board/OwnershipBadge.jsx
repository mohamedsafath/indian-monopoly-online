/**
 * components/Board/OwnershipBadge.jsx
 * Small token/dot overlay on tiles to show owner.
 */
import React from 'react';

export const OwnershipBadge = React.memo(function OwnershipBadge({
  ownerColor,
  ownerToken,
  mortgaged,
  isMonopoly,
}) {
  if (!ownerColor) return null;

  return (
    <div
      title={mortgaged ? 'Mortgaged' : isMonopoly ? 'Monopoly!' : 'Owned'}
      style={{
        position:     'absolute',
        top:          4,
        right:        4,
        width:        16,
        height:       16,
        borderRadius: '50%',
        background:   mortgaged ? 'rgba(100,100,100,0.85)' : `${ownerColor}ee`,
        border:       isMonopoly ? `1.5px solid #fbbf24` : `1.5px solid rgba(255,255,255,0.75)`,
        boxShadow:    isMonopoly ? `0 0 8px ${ownerColor}` : `0 0 4px ${ownerColor}50`,
        zIndex:       10,
        fontSize:     9,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        overflow:     'hidden',
        flexShrink:   0,
        pointerEvents: 'none',
        animation:    isMonopoly ? 'monopolyGlow 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {ownerToken ? (
        <span style={{ fontSize: 9, lineHeight: 1 }}>{ownerToken}</span>
      ) : isMonopoly ? (
        <span style={{ fontSize: 7, lineHeight: 1 }}>★</span>
      ) : null}
    </div>
  );
});