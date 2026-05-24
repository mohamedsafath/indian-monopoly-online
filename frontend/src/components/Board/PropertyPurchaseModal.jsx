/**
 * components/Board/PropertyPurchaseModal.jsx
 *
 * Premium modal shown when the current player lands on an unowned property.
 * Triggered when: pendingAction === 'buy_decision' && isMyTurn
 *
 * Props:
 *   tile         — tile definition from boardTiles.js
 *   property     — gameState.properties[tile.id]
 *   monopolyInfo — { wouldCompleteMonopoly: bool, groupSize: number, ownedInGroup: number }
 *   myMoney      — player's current balance
 *   onBuy        — () => void
 *   onDecline    — () => void  (pass / auction)
 *   onClose      — () => void
 */
import { useState } from 'react';
import { COLOR_GROUP_META } from '../../utils/boardTiles';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

const MODAL_CSS = `
@keyframes propModalIn {
  from { opacity:0; transform: translateY(32px) scale(0.95); }
  to   { opacity:1; transform: translateY(0)    scale(1); }
}
@keyframes propModalOut {
  from { opacity:1; transform: translateY(0)    scale(1); }
  to   { opacity:0; transform: translateY(32px) scale(0.95); }
}
@keyframes propStrip {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes monopolyBadgePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(251,191,36,0); }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = MODAL_CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

export function PropertyPurchaseModal({
  tile,
  monopolyInfo,
  myMoney,
  isMyTurn,
  onBuy,
  onDecline,
  onClose,
}) {
  injectCSS();
  const [leaving, setLeaving] = useState(false);

  if (!tile) return null;

  const groupMeta  = tile.group ? COLOR_GROUP_META[tile.group] : null;
  const groupColor = groupMeta?.hex ?? '#d4af37';
  const canAfford  = myMoney >= (tile.price ?? 0);

  const wouldMonopoly  = monopolyInfo?.wouldCompleteMonopoly ?? false;
  const groupSize      = monopolyInfo?.groupSize ?? groupMeta?.size ?? 0;
  const ownedInGroup   = monopolyInfo?.ownedInGroup ?? 0;

  const rentRows = buildRentRows(tile);

  const close = (cb) => {
    setLeaving(true);
    setTimeout(() => { cb?.(); onClose?.(); }, 300);
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1400,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        animation:      leaving ? 'propModalOut 0.3s ease-in forwards' : 'propModalIn 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards',
      }}
      onClick={() => close(onClose)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:        380,
          maxWidth:     '95vw',
          maxHeight:    '90vh',
          overflowY:    'auto',
          borderRadius: 20,
          background:   'linear-gradient(160deg,#0c1018 0%,#080c12 100%)',
          border:       `1.5px solid ${groupColor}35`,
          boxShadow:    `0 32px 100px rgba(0,0,0,0.8), 0 0 60px ${groupColor}18`,
          fontFamily:   "'DM Sans',sans-serif",
          overflow:     'hidden',
        }}
      >
        {/* Color header strip */}
        <div style={{
          height:     8,
          background: groupColor,
          animation:  'propStrip 0.5s ease-out 0.1s both',
          boxShadow:  `0 2px 20px ${groupColor}70`,
        }} />

        {/* Header */}
        <div style={{
          padding:    '20px 22px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display:    'flex',
          gap:        14,
          alignItems: 'flex-start',
        }}>
          {/* Icon badge */}
          <div style={{
            width:        52,
            height:       52,
            borderRadius: 14,
            background:   `${groupColor}22`,
            border:       `1.5px solid ${groupColor}50`,
            display:      'flex',
            alignItems:   'center',
            justifyContent:'center',
            fontSize:     26,
            flexShrink:   0,
            boxShadow:    `0 0 20px ${groupColor}30`,
          }}>
            {tile.icon}
          </div>

          <div style={{ flex: 1 }}>
            {/* Property name */}
            <div style={{
              fontSize:   18,
              fontWeight: 900,
              color:      '#f3f4f6',
              lineHeight: 1.2,
              fontFamily: "'Playfair Display',serif",
              marginBottom: 4,
            }}>
              {tile.name}
            </div>

            {/* Subtitle / group */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {groupMeta && (
                <span style={{
                  fontSize:   9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:      groupColor,
                  background: `${groupColor}18`,
                  border:     `1px solid ${groupColor}35`,
                  borderRadius: 4,
                  padding:    '1px 6px',
                }}>
                  {groupMeta.label}
                </span>
              )}
              {wouldMonopoly && (
                <span style={{
                  fontSize:   9,
                  fontWeight: 800,
                  color:      '#fbbf24',
                  background: 'rgba(251,191,36,0.12)',
                  border:     '1px solid rgba(251,191,36,0.35)',
                  borderRadius: 4,
                  padding:    '1px 6px',
                  animation:  'monopolyBadgePulse 1.5s ease-in-out infinite',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  ★ Monopoly!
                </span>
              )}
            </div>

            {tile.subtitle && (
              <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.55)', marginTop: 4 }}>
                {tile.subtitle}
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={() => close(onClose)}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(156,163,175,0.4)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1,
              padding: '0 0 0 8px', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Price + balance row */}
        <div style={{
          padding:    '14px 22px',
          display:    'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.45)', marginBottom: 2, letterSpacing: '0.08em' }}>PURCHASE PRICE</div>
            <div style={{
              fontSize:   22,
              fontWeight: 900,
              background: 'linear-gradient(135deg,#d4af37,#f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
            }}>
              ₹{fmt(tile.price)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.45)', marginBottom: 2, letterSpacing: '0.08em' }}>YOUR BALANCE</div>
            <div style={{
              fontSize:   16,
              fontWeight: 800,
              color:      canAfford ? '#4ade80' : '#f87171',
            }}>
              ₹{fmt(myMoney)}
            </div>
            {canAfford && (
              <div style={{ fontSize: 9, color: 'rgba(74,222,128,0.55)' }}>
                After: ₹{fmt(myMoney - tile.price)}
              </div>
            )}
          </div>
        </div>

        {/* Group ownership progress */}
        {groupSize > 0 && (
          <div style={{ padding: '10px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.45)', letterSpacing: '0.08em', marginBottom: 6 }}>
              GROUP PROGRESS
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {Array.from({ length: groupSize }).map((_, i) => (
                <div key={i} style={{
                  flex:         1,
                  height:       6,
                  borderRadius: 3,
                  background:   i < ownedInGroup + 1
                    ? groupColor
                    : 'rgba(255,255,255,0.08)',
                  boxShadow:    i < ownedInGroup + 1 ? `0 0 6px ${groupColor}60` : 'none',
                  transition:   'background 0.3s',
                }} />
              ))}
              <span style={{ fontSize: 9, color: 'rgba(156,163,175,0.5)', marginLeft: 4 }}>
                {ownedInGroup + 1}/{groupSize}
              </span>
            </div>
            {wouldMonopoly && (
              <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 5, fontWeight: 700 }}>
                ✦ Buying this completes your monopoly — rents double!
              </div>
            )}
          </div>
        )}

        {/* Rent table */}
        {rentRows.length > 0 && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.45)', letterSpacing: '0.08em', marginBottom: 8 }}>RENT TABLE</div>
            {rentRows.map((row, i) => (
              <div key={i} style={{
                display:        'flex',
                justifyContent: 'space-between',
                padding:        '4px 0',
                fontSize:       11,
                color:          i === 0 ? 'rgba(215,219,228,0.85)' : 'rgba(156,163,175,0.55)',
                borderBottom:   i < rentRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span>{row.label}</span>
                <span style={{ fontWeight: 700, color: i === 0 ? 'rgba(215,219,228,0.9)' : 'rgba(156,163,175,0.7)' }}>
                  ₹{fmt(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Mortgage info */}
        {tile.mortgage && (
          <div style={{
            padding:    '8px 22px',
            display:    'flex',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize:   11,
          }}>
            <span style={{ color: 'rgba(156,163,175,0.45)' }}>Mortgage value</span>
            <span style={{ color: 'rgba(156,163,175,0.65)', fontWeight: 600 }}>₹{fmt(tile.mortgage)}</span>
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isMyTurn ? (
            <>
              {canAfford ? (
                <button
                  onClick={() => close(onBuy)}
                  style={{
                    width:         '100%',
                    padding:       '13px',
                    borderRadius:  12,
                    background:    `linear-gradient(135deg,${groupColor},${groupColor}cc)`,
                    color:         '#0a0805',
                    fontWeight:    900,
                    fontSize:      13,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    border:        'none',
                    cursor:        'pointer',
                    boxShadow:     `0 4px 20px ${groupColor}50`,
                    transition:    'transform 0.12s, box-shadow 0.12s',
                    fontFamily:    "'DM Sans',sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform  = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = `0 6px 28px ${groupColor}70`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform  = 'scale(1)';
                    e.currentTarget.style.boxShadow = `0 4px 20px ${groupColor}50`;
                  }}
                >
                  🏠 Buy for ₹{fmt(tile.price)}
                </button>
              ) : (
                <div style={{
                  padding:      '12px',
                  borderRadius: 12,
                  background:   'rgba(239,68,68,0.08)',
                  border:       '1px solid rgba(239,68,68,0.2)',
                  textAlign:    'center',
                  fontSize:     12,
                  color:        '#f87171',
                  fontWeight:   700,
                }}>
                  ⚠️ Insufficient funds (short ₹{fmt(tile.price - myMoney)})
                </div>
              )}

              <button
                onClick={() => close(onDecline)}
                style={{
                  width:         '100%',
                  padding:       '11px',
                  borderRadius:  12,
                  background:    'rgba(255,255,255,0.04)',
                  color:         'rgba(156,163,175,0.65)',
                  fontWeight:    700,
                  fontSize:      12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border:        '1px solid rgba(255,255,255,0.08)',
                  cursor:        'pointer',
                  fontFamily:    "'DM Sans',sans-serif",
                  transition:    'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              >
                Decline & End Turn
              </button>
            </>
          ) : (
            <div style={{
              padding:      '14px',
              borderRadius: 12,
              background:   'rgba(255,255,255,0.02)',
              border:       '1px solid rgba(212,175,55,0.15)',
              textAlign:    'center',
              fontSize:     11,
              color:        'rgba(212,175,55,0.75)',
              fontWeight:   600,
              letterSpacing: '0.05em',
            }}>
              ⏳ Waiting for player to decide…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rent row builder ──────────────────────────────────────────────────────────
function buildRentRows(tile) {
  if (!tile.rent) return [];
  const rows = [];

  if (tile.type === 'property') {
    const labels = [
      'Base rent',
      '+ Monopoly (no houses)',
      '+ 1 House',
      '+ 2 Houses',
      '+ 3 Houses',
      '+ 4 Houses',
      '+ Hotel',
    ];
    tile.rent.forEach((r, i) => {
      if (labels[i]) rows.push({ label: labels[i], value: r });
    });
  } else if (tile.type === 'railway') {
    const labels = ['1 railway', '2 railways', '3 railways', '4 railways'];
    tile.rent.forEach((r, i) => {
      if (labels[i]) rows.push({ label: labels[i], value: r });
    });
  } else if (tile.type === 'utility') {
    rows.push({ label: '1 utility (×4 dice)', value: '×4' });
    rows.push({ label: '2 utilities (×10 dice)', value: '×10' });
  }

  return rows;
}
