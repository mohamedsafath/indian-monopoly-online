/**
 * components/Board/BuildPanel.jsx
 *
 * Premium centered modal overlay for building houses & hotels.
 * Validates monopoly ownership, showing progress guide if they have none.
 *
 * Props:
 *   gameState     — full client state
 *   myId          — current player id
 *   properties    — gameState.properties
 *   monopolies    — { [tileId]: true } tiles that are monopolies
 *   onBuildHouse  — (tileId) => void
 *   onBuildHotel  — (tileId) => void
 *   onSellHouse   — (tileId) => void
 *   onSellHotel   — (tileId) => void
 *   onClose       — () => void
 */
import React, { useMemo } from 'react';
import { BOARD_TILES, COLOR_GROUP_META } from '../../utils/boardTiles';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

export function BuildPanel({
  gameState, myId, properties, monopolies,
  onBuildHouse, onBuildHotel, onSellHouse, onSellHotel,
  onClose,
}) {
  const me          = gameState?.players?.[myId];
  const houseBank   = gameState?.houseBank   ?? 32;
  const hotelBank   = gameState?.hotelBank   ?? 12;

  // Properties owned by current player that belong to a monopoly group
  const buildable = useMemo(() => {
    return BOARD_TILES.filter(t => {
      if (t.type !== 'property') return false;
      const prop = properties[t.id];
      if (prop?.ownerId !== myId) return false;
      if (prop?.mortgaged) return false;
      return monopolies[t.id] === true;
    });
  }, [properties, myId, monopolies]);

  // Monopoly progress guide (shown when player owns no complete groups)
  const progressGuide = useMemo(() => {
    const groups = {};
    BOARD_TILES.forEach(t => {
      if (t.type === 'property' && t.group) {
        if (!groups[t.group]) {
          groups[t.group] = {
            name: COLOR_GROUP_META[t.group]?.label ?? t.group,
            color: COLOR_GROUP_META[t.group]?.hex ?? '#9ca3af',
            total: 0,
            owned: 0,
          };
        }
        groups[t.group].total++;
        if (properties[t.id]?.ownerId === myId) {
          groups[t.group].owned++;
        }
      }
    });
    return Object.values(groups).filter(g => g.owned > 0 && g.owned < g.total);
  }, [properties, myId]);

  // Monopoly validation failed state (guide display)
  if (buildable.length === 0) {
    return (
      <div
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         1500,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            width:        360,
            maxWidth:     '95vw',
            borderRadius: 24,
            background:   'linear-gradient(160deg,#0d111a 0%,#070a10 100%)',
            border:       '1.5px solid rgba(239,68,68,0.3)',
            boxShadow:    '0 24px 80px rgba(0,0,0,0.9), 0 0 50px rgba(239,68,68,0.08)',
            fontFamily:   "'DM Sans',sans-serif",
            overflow:     'hidden',
            padding:      '24px 20px',
            textAlign:    'center',
            animation:    'propModalIn 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: '#f87171', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Monopoly Required
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(156,163,175,0.7)', lineHeight: 1.5, marginBottom: 16 }}>
            You need a complete, unmortgaged color group (Monopoly) to build houses or hotels.
          </p>

          {progressGuide.length > 0 && (
            <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px', marginBottom: 18 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(156,163,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Your Monopoly Progress
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {progressGuide.map(g => (
                  <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#f3f4f6' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />
                      {g.name}
                    </span>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>{g.owned} / {g.total} owned</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              padding: '11px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(156,163,175,0.7)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              width: '100%',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Close Guide
          </button>
        </div>
      </div>
    );
  }

  // Centered Build Modal (When they have buildable monopolies)
  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1500,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width:        380,
          maxWidth:     '95vw',
          maxHeight:    '75vh',
          borderRadius: 24,
          background:   'linear-gradient(160deg,#0a101d 0%,#04070a 100%)',
          border:       '1.5px solid rgba(34,197,94,0.4)',
          boxShadow:    '0 24px 80px rgba(0,0,0,0.9), 0 0 50px rgba(34,197,94,0.15)',
          fontFamily:   "'DM Sans',sans-serif",
          overflow:     'hidden',
          display:      'flex',
          flexDirection: 'column',
          animation:    'propModalIn 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards',
        }}
      >
        {/* Sticky Header */}
        <div style={{
          padding:      '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display:      'flex', justifyContent: 'space-between', alignItems: 'center',
          background:   'rgba(255,255,255,0.01)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f3f4f6', letterSpacing: '0.02em' }}>🏠 Build Houses & Hotels</div>
            <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.5)', marginTop: 2 }}>
              Bank: {houseBank} houses · {hotelBank} hotels
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(156,163,175,0.5)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {/* Scrollable Property List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {buildable.map(tile => {
            const prop       = properties[tile.id];
            const groupMeta  = COLOR_GROUP_META[tile.group];
            const groupColor = groupMeta?.hex ?? '#d4af37';
            const houses     = prop?.houses  ?? 0;
            const hotel      = prop?.hotel   ?? false;
            const houseCost  = tile.houseCost ?? 0;

            const canBuildHouse = !hotel && houses < 4 && (me?.money ?? 0) >= houseCost && houseBank > 0;
            const canBuildHotel = !hotel && houses === 4 && (me?.money ?? 0) >= houseCost && hotelBank > 0;
            const canSellHouse  = !hotel && houses > 0;
            const canSellHotel  = hotel;

            return (
              <div key={tile.id} style={{
                padding:      '12px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {/* Tile Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: groupColor, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f3f4f6' }}>
                    {tile.icon} {tile.name}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: '#fbbf24', fontWeight: 800 }}>
                    ₹{fmt(houseCost)}
                  </div>
                </div>

                {/* Building Visual Indicators */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  {hotel ? (
                    <div style={{
                      width: 12, height: 12, borderRadius: 2.5,
                      background: '#ef4444',
                      border: '0.5px solid #b91c1c',
                      boxShadow: '0 0 5px rgba(239,68,68,0.9)',
                    }} />
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: i < houses ? '#22c55e' : 'rgba(255,255,255,0.08)',
                        border: i < houses ? '0.5px solid #15803d' : '1px solid rgba(255,255,255,0.04)',
                        boxShadow: i < houses ? '0 0 4px rgba(34,197,94,0.6)' : 'none',
                      }} />
                    ))
                  )}
                  <span style={{ fontSize: 9, color: 'rgba(156,163,175,0.4)', marginLeft: 4 }}>
                    {hotel ? 'Hotel built' : `${houses}/4 houses`}
                  </span>
                </div>

                {/* Build/Sell Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {!hotel && houses < 4 && (
                    <button
                      onClick={() => onBuildHouse(tile.id)}
                      disabled={!canBuildHouse}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        background: canBuildHouse ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid rgba(34,197,94,${canBuildHouse ? '0.4' : '0.1'})`,
                        color: canBuildHouse ? '#4ade80' : 'rgba(156,163,175,0.3)',
                        fontSize: 11, fontWeight: 800, cursor: canBuildHouse ? 'pointer' : 'not-allowed',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      + House
                    </button>
                  )}
                  {!hotel && houses === 4 && (
                    <button
                      onClick={() => onBuildHotel(tile.id)}
                      disabled={!canBuildHotel}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        background: canBuildHotel ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid rgba(168,85,247,${canBuildHotel ? '0.4' : '0.1'})`,
                        color: canBuildHotel ? '#c084fc' : 'rgba(156,163,175,0.3)',
                        fontSize: 11, fontWeight: 800, cursor: canBuildHotel ? 'pointer' : 'not-allowed',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      + Hotel
                    </button>
                  )}
                  {canSellHouse && (
                    <button
                      onClick={() => onSellHouse(tile.id)}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      Sell
                    </button>
                  )}
                  {canSellHotel && (
                    <button
                      onClick={() => onSellHotel(tile.id)}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      Sell Hotel
                    </button>
                  )}
                </div>

                {!canBuildHouse && !hotel && houses < 4 && (
                  <div style={{ fontSize: 9, color: '#f87171', marginTop: 5, fontWeight: 600 }}>
                    {houseBank === 0 ? '❌ No houses in bank' : `⚠️ Need ₹${fmt(houseCost - (me?.money ?? 0))} more`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
          fontSize: 11,
          color: 'rgba(156,163,175,0.6)',
          textAlign: 'center',
          fontWeight: 600,
        }}>
          Your Cash: <span style={{ color: '#4ade80', fontWeight: 800 }}>₹{fmt(me?.money)}</span>
        </div>
      </div>
    </div>
  );
}