/**
 * components/Board/BoardTile.jsx
 *
 * Premium board tile — readability overhaul.
 * - Tile depth pushed toward center (28% → 32% color strip)
 * - Larger icon (10–12px) and name text (7.5–9.5px)
 * - Price badge more prominent
 * - Hover: full-name tooltip + vivid glow ring
 * - House/hotel overlay is larger and clearer
 */
import React, { useMemo, useState } from 'react';
import { COLOR_GROUP_META } from '../../utils/boardTiles';
import { OwnershipBadge } from './OwnershipBadge';

// ── Short name map (keeps tiles uncluttered and prevents wraps) ───────────────
const SHORT_NAMES = {
  'Indian Railways North 🚂': 'Railways North',
  'Indian Railways South 🚂': 'Railways South',
  'Indian Railways East 🚂':  'Railways East',
  'Indian Railways West 🚂':  'Railways West',
  'Electricity Board ⚡':     'Electricity',
  'Water Board 💧':           'Water Board',
  'Community Chest':           'Comm. Chest',
  'Income Tax':                'Income Tax',
  'Andaman & Nicobar 🏝️':      'Andaman',
  'Bengaluru Tech Park 💻':    'Bengaluru Tech',
  'Mumbai Marine Drive 🌊':    'Marine Drive',
  'Income Tax Raid 🚔':        'Tax Raid',
  'GST Payment 💸':            'GST Payment',
};

const TWO_LINE_NAMES = {
  'Start Journey 🇮🇳':           ['Start', 'Journey 🇮🇳'],
  'Indian Railways North 🚂':   ['Railways', 'North 🚂'],
  'Indian Railways South 🚂':   ['Railways', 'South 🚂'],
  'Indian Railways East 🚂':    ['Railways', 'East 🚂'],
  'Indian Railways West 🚂':    ['Railways', 'West 🚂'],
  'Electricity Board ⚡':        ['Electricity', 'Board ⚡'],
  'Water Board 💧':              ['Water', 'Board 💧'],
  'Community Chest':            ['Community', 'Chest'],
  'Income Tax':                 ['Income', 'Tax'],
  'Andaman & Nicobar 🏝️':         ['Andaman &', 'Nicobar 🏝️'],
  'Bengaluru Tech Park 💻':     ['Bengaluru', 'Tech Park 💻'],
  'Mumbai Marine Drive 🌊':     ['Mumbai Marine', 'Drive 🌊'],
  'Income Tax Raid 🚔':         ['Tax', 'Raid 🚔'],
  'GST Payment 💸':             ['GST', 'Payment 💸'],
  'Tea Break ☕':                ['Tea', 'Break ☕'],
  'Tihar Jail 🔒':              ['Tihar', 'Jail 🔒'],
  'Chandigarh':                 ['Chandi', 'garh'],
  'Bengaluru':                  ['Benga', 'luru'],
};

const shortName = (tile) =>
  tile.shortName ?? SHORT_NAMES[tile.name] ?? tile.name;

// ── Type-based tile backgrounds ───────────────────────────────────────────────
const TYPE_STYLES = {
  property:   { bg: '#0c1219', border: 'rgba(255,255,255,0.07)' },
  railway:    { bg: '#0b0f16', border: 'rgba(255,255,255,0.09)' },
  utility:    { bg: '#0c1320', border: 'rgba(255,255,255,0.09)' },
  tax:        { bg: '#160804', border: 'rgba(239,68,68,0.18)'   },
  chance:     { bg: '#0f0818', border: 'rgba(139,92,246,0.22)'  },
  community:  { bg: '#080f16', border: 'rgba(59,130,246,0.22)'  },
  go_to_jail: { bg: '#160606', border: 'rgba(239,68,68,0.22)'   },
};

const TYPE_ICON_GLOW = {
  railway:    '#f59e0b',
  utility:    '#38bdf8',
  tax:        '#f87171',
  chance:     '#a78bfa',
  community:  '#60a5fa',
  go_to_jail: '#f87171',
};

// Strip occupies 22% depth from the edge (leaves 78% for content)
const STRIP_POSITION = {
  bottom: { top: 'auto', bottom: 0,    left: 0, right: 0, height: '22%', width: '100%' },
  top:    { top: 0,      bottom:'auto',left: 0, right: 0, height: '22%', width: '100%' },
  left:   { top: 0, bottom: 0, left: 0, right: 'auto', height: '100%', width: '22%' },
  right:  { top: 0, bottom: 0, left: 'auto', right: 0, height: '100%', width: '22%' },
};

// ── House / hotel overlay ─────────────────────────────────────────────────────
function HouseRow({ houses, hotel, edge, groupColor }) {
  if (!houses && !hotel) return null;
  const isVertical = edge === 'left' || edge === 'right';

  const positionStyle = {
    position: 'absolute',
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 5,
    ...(edge === 'bottom' ? { bottom: 0, left: 0, right: 0, height: '22%', width: '100%' } : {}),
    ...(edge === 'top' ? { top: 0, left: 0, right: 0, height: '22%', width: '100%' } : {}),
    ...(edge === 'left' ? { left: 0, top: 0, bottom: 0, width: '22%', height: '100%' } : {}),
    ...(edge === 'right' ? { right: 0, top: 0, bottom: 0, width: '22%', height: '100%' } : {}),
  };

  return (
    <div style={positionStyle}>
      {hotel ? (
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: '#ef4444',
          border: '0.5px solid #b91c1c',
          boxShadow: '0 0 8px rgba(239,68,68,0.95)',
        }} />
      ) : (
        Array.from({ length: houses }).map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: 2,
            background: '#22c55e',
            border: '0.5px solid #15803d',
            boxShadow: '0 0 6px rgba(34,197,94,0.9)',
          }} />
        ))
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const BoardTile = React.memo(function BoardTile({
  tile,
  property,
  ownerColor,
  ownerToken,
  isMonopoly,
  isFlashing,
  edge,
  gridColumn,
  gridRow,
  isActive,
  onClick,
}) {
  const [hovered, setHovered] = useState(false);

  const typeStyle  = TYPE_STYLES[tile.type] ?? TYPE_STYLES.property;
  const groupColor = tile.group ? (COLOR_GROUP_META[tile.group]?.hex ?? null) : null;
  const stripPos   = groupColor ? STRIP_POSITION[edge] : null;
  const iconGlow   = TYPE_ICON_GLOW[tile.type] ?? null;

  const isMortgaged = property?.mortgaged;
  const houses      = property?.houses ?? 0;
  const hotel       = property?.hotel  ?? false;
  const isVerticalEdge = edge === 'left' || edge === 'right';

  const displayLines = useMemo(() => {
    const displayName = shortName(tile);
    if (isVerticalEdge) {
      return [displayName]; // Display short name on a single line horizontally for vertical sides
    } else {
      return TWO_LINE_NAMES[tile.name] ?? [displayName];
    }
  }, [isVerticalEdge, tile]);

  const nameSize = isVerticalEdge
    ? '12px'
    : (displayLines.length > 1 ? '11px' : '13px');

  // Glow color for hover / active state
  const glowColor = ownerColor ?? groupColor ?? iconGlow ?? 'rgba(212,175,55,0.5)';

  const containerStyle = useMemo(() => ({
    gridColumn,
    gridRow,
    position:       'relative',
    width:          '100%',
    height:         '100%',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    cursor:         'pointer',
  }), [gridColumn, gridRow]);

  const visualTileStyle = useMemo(() => {
    return {
      width:          '100%',
      height:         '100%',
      position:       'absolute',
      background:     ownerColor
        ? `linear-gradient(135deg,${typeStyle.bg},${ownerColor}18)`
        : typeStyle.bg,
      border: ownerColor
        ? `2.5px solid ${ownerColor}`
        : isActive
          ? `1.5px solid ${glowColor}c0`
          : hovered
            ? `1.5px solid ${glowColor}a0`
            : `1px solid ${typeStyle.border}`,
      borderRadius:   8,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      overflow:       'hidden',
      transition:     'background 0.25s, border 0.2s, box-shadow 0.2s',
      boxShadow: isFlashing
        ? `0 0 25px ${ownerColor ?? '#f59e0b'}`
        : ownerColor
          ? `0 0 16px ${ownerColor}cc, inset 0 0 12px ${ownerColor}40`
          : isActive
            ? `inset 0 0 12px rgba(255,215,0,0.14), 0 0 10px ${glowColor}40`
            : hovered
              ? `inset 0 0 20px ${glowColor}30, 0 0 16px ${glowColor}50`
              : 'none',
      animation:      isFlashing ? 'ownershipFlash 0.35s ease-in-out 3' : 'none',
      zIndex:         hovered ? 5 : undefined,
    };
  }, [ownerColor, typeStyle, isActive, glowColor, hovered, isFlashing]);

  const actualStripPos = groupColor ? STRIP_POSITION[edge] : null;

  const contentStyle = useMemo(() => {
    if (isVerticalEdge) {
      const hasStrip = !!groupColor;
      return {
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        width:          '100%',
        height:         '100%',
        zIndex:         3,
        paddingLeft:    edge === 'left' ? (hasStrip ? '28%' : '12%') : '12%',
        paddingRight:   edge === 'right' ? (hasStrip ? '28%' : '12%') : '12%',
        paddingTop:     '4px',
        paddingBottom:  '4px',
        boxSizing:      'border-box',
        gap:            8,
      };
    } else {
      return {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            4,
        width:          '100%',
        height:         '100%',
        zIndex:         3,
        paddingLeft:    '4px',
        paddingRight:   '4px',
        paddingTop:     edge === 'top' ? '26%' : '6%',
        paddingBottom:  edge === 'top' ? '6%' : '26%',
        boxSizing:      'border-box',
      };
    }
  }, [isVerticalEdge, edge, groupColor]);

  const orderIcon  = isVerticalEdge && edge === 'right' ? 3 : 1;
  const orderPrice = isVerticalEdge && edge === 'right' ? 1 : 3;
  const textAlignment = isVerticalEdge ? (edge === 'left' ? 'left' : 'right') : 'center';
  const flexAlignment = isVerticalEdge ? (edge === 'left' ? 'flex-start' : 'flex-end') : 'center';

  return (
    <div
      style={containerStyle}
      onClick={onClick}
      title={tile.name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Visual Tile Body */}
      <div style={visualTileStyle}>
        {/* Mortgage overlay */}
        {isMortgaged && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(100,100,100,0.1) 3px,rgba(100,100,100,0.1) 6px)',
            zIndex: 3, pointerEvents: 'none',
          }} />
        )}

        {/* Color group strip */}
        {groupColor && actualStripPos && (
          <div style={{
            position:  'absolute',
            ...actualStripPos,
            background: isMortgaged
              ? 'rgba(100,100,100,0.4)'
              : isMonopoly
                ? `linear-gradient(90deg,${groupColor},${groupColor}cc,${groupColor})`
                : groupColor,
            opacity:   isMortgaged ? 0.5 : 1,
            boxShadow: isMonopoly && !isMortgaged ? `0 0 10px ${groupColor}90` : 'none',
            animation: isMonopoly && !isMortgaged ? 'monopolyGlow 1.5s ease-in-out infinite' : 'none',
            zIndex:    4, // Push above other layers
            pointerEvents: 'none',
            display:   'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {tile.price && (
              <span style={{
                fontSize:   '12px',
                fontWeight: 900,
                color:      '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textShadow: '0px 1px 2px rgba(0,0,0,0.95), 0px 0px 1px rgba(0,0,0,0.9)',
                zIndex:     5,
                transform:  isVerticalEdge ? (edge === 'left' ? 'rotate(-90deg)' : 'rotate(90deg)') : 'none',
              }}>
                ₹{(tile.price / 1000).toFixed(tile.price % 1000 === 0 ? 0 : 1)}K
              </span>
            )}
          </div>
        )}

        {/* Hover: full name badge */}
        {hovered && displayLines.join(' ') !== tile.name && (
          <div style={{
            position:  'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex:    10,
            background:'rgba(5,8,14,0.92)',
            border:    `1px solid ${glowColor}50`,
            borderRadius: 5,
            padding:   '3px 6px',
            fontSize:  11,
            fontWeight: 700,
            color:     '#f3f4f6',
            whiteSpace:'nowrap',
            pointerEvents:'none',
            boxShadow: `0 2px 12px rgba(0,0,0,0.7)`,
            letterSpacing: '0.02em',
          }}>
            {tile.name}
          </div>
        )}

        {/* Tile content */}
        <div style={contentStyle}>
          {/* Icon */}
          <div style={{
            fontSize:   tile.type === 'property' ? 14 : 18,
            lineHeight: 1,
            flexShrink: 0,
            filter:     iconGlow ? `drop-shadow(0 0 5px ${iconGlow}70)` : 'none',
            order:      orderIcon,
          }}>
            {tile.icon}
          </div>

          {/* Name */}
          <div style={{
            fontSize:      nameSize,
            fontWeight:    800,
            color: isMortgaged
              ? 'rgba(156,163,175,0.35)'
              : tile.type === 'property'
                ? 'rgba(235,237,242,0.92)'
                : iconGlow
                  ? 'rgba(229,231,235,0.8)'
                  : 'rgba(215,219,228,0.8)',
            textAlign:     textAlignment,
            lineHeight:    1.15,
            letterSpacing: '0.01em',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    flexAlignment,
            justifyContent:'center',
            width:         isVerticalEdge ? 'auto' : '100%',
            flexGrow:      isVerticalEdge ? 1 : 0,
            minWidth:      0,
            overflow:      'hidden',
            textOverflow:  'ellipsis',
            textShadow:    isMonopoly && groupColor ? `0 0 8px ${groupColor}50` : 'none',
            order:         2,
          }}>
            {displayLines.map((line, idx) => (
              <span key={idx} style={{ whiteSpace: 'nowrap' }}>
                {line}
              </span>
            ))}
          </div>

          {/* Price (only render in content area if there's no color group strip) */}
          {tile.price && !groupColor && (
            <div style={{
              fontSize:   14,
              fontWeight: 900,
              color:      isMonopoly ? '#fbbf24' : 'rgba(212,175,55,0.85)',
              letterSpacing: '0.02em',
              textShadow: isMonopoly ? '0 0 8px rgba(251,191,36,0.6)' : 'none',
              flexShrink: 0,
              order:      orderPrice,
            }}>
              ₹{(tile.price / 1000).toFixed(tile.price % 1000 === 0 ? 0 : 1)}K
            </div>
          )}

          {/* Tax amount badge */}
          {tile.type === 'tax' && tile.amount && (
            <div style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#f87171',
              letterSpacing: '0.02em',
              flexShrink: 0,
              order:      orderPrice,
            }}>
              ₹{tile.amount >= 1000 ? `${tile.amount / 1000}K` : tile.amount}
            </div>
          )}
        </div>

        {/* Houses / hotel overlay */}
        {(houses > 0 || hotel) && (
          <HouseRow houses={houses} hotel={hotel} edge={edge} groupColor={groupColor} />
        )}

        {/* Subtle premium ownership badge in the corner */}
        {ownerColor && (
          <OwnershipBadge
            ownerColor={ownerColor}
            ownerToken={ownerToken}
            mortgaged={isMortgaged}
            isMonopoly={isMonopoly}
          />
        )}
      </div>
    </div>
  );
});
