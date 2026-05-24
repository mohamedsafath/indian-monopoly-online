/**
 * components/Board/HouseRenderer.jsx
 * Renders 1–4 house icons or a hotel icon for a property tile.
 */
import React from 'react';

export const HouseRenderer = React.memo(function HouseRenderer({ houses, hotel, ownerColor }) {
  if (!ownerColor) return null;
  if (!hotel && (!houses || houses === 0)) return null;

  if (hotel) {
    return (
      <div style={{
        position:    'absolute',
        top:         2,
        left:        '50%',
        transform:   'translateX(-50%)',
        fontSize:    10,
        lineHeight:  1,
        zIndex:      6,
        filter:      `drop-shadow(0 0 3px ${ownerColor})`,
        animation:   'houseAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        🏨
      </div>
    );
  }

  return (
    <div style={{
      position:       'absolute',
      top:            2,
      left:           '50%',
      transform:      'translateX(-50%)',
      display:        'flex',
      gap:            1,
      zIndex:         6,
    }}>
      {Array.from({ length: houses }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize:  7,
            lineHeight: 1,
            filter:    `drop-shadow(0 0 2px ${ownerColor})`,
            animation: `houseAppear 0.4s ${i * 0.06}s cubic-bezier(0.34,1.56,0.64,1) both`,
          }}
        >
          🏠
        </span>
      ))}
    </div>
  );
});