/**
 * components/Board/TileDetailsPanel.jsx
 *
 * Premium slide-in tile details panel.
 * Shows: full name, rent table, owner, monopoly state, mortgage, houses/hotel, rules.
 * Includes build buttons when player has monopoly and it's their turn.
 */
import React, { useState, useEffect } from 'react';
import { fmt, isPurchasable, rentDescription } from '../../utils/tileHelpers';
import { GROUP_COLORS } from '../../utils/boardLayout';
import { BOARD_TILES, COLOR_GROUP_META } from '../../utils/boardTiles';

export function TileDetailsPanel({
  tile,
  property,
  ownerPlayer,
  pendingAction,
  isMyTurn,
  myMoney,
  monopolies,
  onBuy,
  onEndTurn,
  onBuildHouse,
  onBuildHotel,
  onSellHouse,
  onSellHotel,
  myId,
  gameState,
  onClose,
  onAuctionProperty,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (tile) {
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [tile?.id]);

  if (!tile) return null;

  const groupMeta   = tile.group ? COLOR_GROUP_META[tile.group] : null;
  const groupColor  = tile.group ? (GROUP_COLORS[tile.group] ?? null) : null;
  const canAfford   = myMoney >= (tile.price ?? 0);
  const isOwned     = !!property?.ownerId;
  const isMortgaged = property?.mortgaged ?? false;
  const isMonopoly  = monopolies?.[tile.id] ?? false;
  const canBuy      = pendingAction === 'buy_decision' && isMyTurn && !isOwned && canAfford;
  const rentRows    = rentDescription(tile);

  // House/hotel build eligibility
  const isMyProperty  = property?.ownerId === myId;
  const houses        = property?.houses ?? 0;
  const hotel         = property?.hotel  ?? false;
  const houseCost     = tile.houseCost ?? 0;
  const houseBank     = gameState?.houseBank ?? 32;
  const hotelBank     = gameState?.hotelBank ?? 12;
  const canBuildHs    = isMyProperty && isMonopoly && isMyTurn && !hotel && houses < 4
                        && myMoney >= houseCost && houseBank > 0 && !isMortgaged;
  const canBuildHotel = isMyProperty && isMonopoly && isMyTurn && !hotel && houses === 4
                        && myMoney >= houseCost && hotelBank > 0 && !isMortgaged;
  const canSellHs     = isMyProperty && isMyTurn && !hotel && houses > 0;
  const canSellHotel  = isMyProperty && isMyTurn && hotel;

  // Owned property auction eligibility
  const hasHousesInGroup = tile.group ? Object.values(gameState?.properties || {}).some(p => {
    const t = BOARD_TILES.find(x => x.id === p.tileId);
    return t && t.group === tile.group && ((p.houses ?? 0) > 0 || p.hotel);
  }) : false;

  const canAuction = isMyProperty && isMyTurn && !isMortgaged && houses === 0 && !hotel && !hasHousesInGroup && pendingAction === null;

  return (
    <div style={{
      position:      'absolute',
      right:         0, top: 0, bottom: 0,
      width:         228,
      background:    'rgba(8,6,4,0.97)',
      border:        '1px solid rgba(212,175,55,0.18)',
      borderRadius:  '0 0 0 14px',
      overflow:      'hidden',
      zIndex:        50,
      display:       'flex',
      flexDirection: 'column',
      transform:     visible ? 'translateX(0)' : 'translateX(100%)',
      transition:    'transform 0.32s cubic-bezier(0.34,1.1,0.64,1)',
      opacity:       visible ? 1 : 0,
      fontFamily:    "'DM Sans',sans-serif",
      boxShadow:     '-8px 0 32px rgba(0,0,0,0.6)',
    }}>
      {/* Color strip */}
      {groupColor && (
        <div style={{
          height:     11,
          background: isMonopoly
            ? `linear-gradient(90deg,${groupColor},${groupColor}cc,${groupColor})`
            : groupColor,
          boxShadow:  `0 2px 18px ${groupColor}80`,
          flexShrink: 0,
          animation:  isMonopoly ? 'monopolyGlow 1.5s ease-in-out infinite' : 'none',
        }} />
      )}

      {/* Header */}
      <div style={{
        padding:      '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink:   0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f3f4f6', lineHeight: 1.25 }}>
              {tile.icon} {tile.name}
            </div>
            {tile.subtitle && (
              <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.55)', marginTop: 2 }}>
                {tile.subtitle}
              </div>
            )}
            {/* Badges row */}
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {groupMeta && (
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: groupColor, background: `${groupColor}18`,
                  border: `1px solid ${groupColor}35`,
                  borderRadius: 3, padding: '1px 5px',
                }}>
                  {groupMeta.label}
                </span>
              )}
              {isMonopoly && (
                <span style={{
                  fontSize: 8, fontWeight: 800,
                  color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 3, padding: '1px 5px',
                  letterSpacing: '0.08em',
                }}>
                  ★ MONOPOLY
                </span>
              )}
              {isMortgaged && (
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  color: '#f87171', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 3, padding: '1px 5px', letterSpacing: '0.08em',
                }}>
                  MORTGAGED
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(156,163,175,0.45)',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
              padding: '0 0 0 8px', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Price */}
        {tile.price && (
          <div style={{ marginTop: 10 }}>
            <span style={{
              fontSize: 16, fontWeight: 900,
              background: 'linear-gradient(135deg,#d4af37,#f59e0b)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              ₹{fmt(tile.price)}
            </span>
          </div>
        )}

        {/* Tax */}
        {tile.type === 'tax' && tile.amount && (
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: '#f87171' }}>
            Pay ₹{fmt(tile.amount)}
          </div>
        )}
      </div>

      {/* Owner section */}
      {isOwned && ownerPlayer && (
        <div style={{
          padding:      '9px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display:      'flex', alignItems: 'center', gap: 8,
          flexShrink:   0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: ownerPlayer.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0,
            boxShadow: `0 0 10px ${ownerPlayer.color}60`,
          }}>
            {ownerPlayer.token}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ownerPlayer.color }}>
              {ownerPlayer.username}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.45)' }}>Owner</div>
          </div>
          {/* Houses / hotel badges */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
            {hotel ? (
              <span style={{ fontSize: 14 }}>🏨</span>
            ) : (
              Array.from({ length: houses }).map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: 1.5,
                  background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.7)',
                }} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Rent / info table */}
      {rentRows.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', minHeight: 0 }}>
          <div style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.15em',
            color: 'rgba(212,175,55,0.45)', textTransform: 'uppercase', marginBottom: 7,
          }}>
            {tile.type === 'tax' ? 'Tax' : tile.type === 'utility' ? 'Dice Multiplier' : 'Rent Schedule'}
          </div>
          {rentRows.map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '3.5px 0', fontSize: 10,
              color: i === 0 ? 'rgba(215,219,228,0.85)' : 'rgba(156,163,175,0.5)',
              borderBottom: i < rentRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              fontWeight: i === 0 ? 600 : 400,
            }}>
              <span style={{ color: 'rgba(156,163,175,0.55)', fontSize: 9 }}>
                {row.split(' (')[1]?.replace(')', '') ?? ''}
              </span>
              <span style={{ fontWeight: 700, color: 'rgba(215,219,228,0.9)' }}>
                {row.split(' (')[0]}
              </span>
            </div>
          ))}

          {tile.mortgage && (
            <div style={{
              marginTop: 8, padding: '4px 0',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'rgba(156,163,175,0.45)',
            }}>
              <span>Mortgage</span>
              <span style={{ color: 'rgba(212,175,55,0.65)', fontWeight: 600 }}>₹{fmt(tile.mortgage)}</span>
            </div>
          )}
          {tile.houseCost && (
            <div style={{
              padding: '4px 0',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'rgba(156,163,175,0.45)',
            }}>
              <span>House / Hotel cost</span>
              <span style={{ color: 'rgba(212,175,55,0.65)', fontWeight: 600 }}>₹{fmt(tile.houseCost)}</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {tile.description && (
        <div style={{
          padding: '7px 14px', fontSize: 9,
          color: 'rgba(156,163,175,0.3)', lineHeight: 1.5, flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {tile.description}
        </div>
      )}

      {/* House/hotel build section */}
      {isMyProperty && isMonopoly && !isMortgaged && (
        <div style={{
          padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: 'rgba(34,197,94,0.5)', letterSpacing: '0.12em', marginBottom: 7, fontWeight: 700 }}>
            BUILD
          </div>
          {/* Current state viz */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 7 }}>
            {hotel ? (
              <span style={{ fontSize: 16 }}>🏨</span>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: i < houses ? '#22c55e' : 'rgba(255,255,255,0.08)',
                  boxShadow: i < houses ? '0 0 4px rgba(34,197,94,0.6)' : 'none',
                }} />
              ))
            )}
            <span style={{ fontSize: 9, color: 'rgba(156,163,175,0.4)', marginLeft: 2 }}>
              {hotel ? 'Hotel' : `${houses}/4`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {!hotel && houses < 4 && (
              <button
                onClick={() => onBuildHouse?.(tile.id)}
                disabled={!canBuildHs}
                style={{
                  flex: 1, padding: '5px', borderRadius: 6,
                  background: canBuildHs ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(34,197,94,${canBuildHs ? '0.3' : '0.1'})`,
                  color: canBuildHs ? '#4ade80' : 'rgba(156,163,175,0.25)',
                  fontSize: 9, fontWeight: 700, cursor: canBuildHs ? 'pointer' : 'not-allowed',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >+ House</button>
            )}
            {!hotel && houses === 4 && (
              <button
                onClick={() => onBuildHotel?.(tile.id)}
                disabled={!canBuildHotel}
                style={{
                  flex: 1, padding: '5px', borderRadius: 6,
                  background: canBuildHotel ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(168,85,247,${canBuildHotel ? '0.3' : '0.1'})`,
                  color: canBuildHotel ? '#c084fc' : 'rgba(156,163,175,0.25)',
                  fontSize: 9, fontWeight: 700, cursor: canBuildHotel ? 'pointer' : 'not-allowed',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >+ Hotel</button>
            )}
            {(canSellHs || canSellHotel) && (
              <button
                onClick={() => hotel ? onSellHotel?.(tile.id) : onSellHouse?.(tile.id)}
                style={{
                  padding: '5px 8px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >Sell</button>
            )}
          </div>
        </div>
      )}

      {/* Property Deal section (Auction) */}
      {isMyProperty && isMyTurn && !isMortgaged && (
        <div style={{
          padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: '#fbbf24', letterSpacing: '0.12em', marginBottom: 7, fontWeight: 700 }}>
            DEALS
          </div>
          <button
            onClick={() => onAuctionProperty?.(tile.id)}
            disabled={!canAuction}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              background: canAuction ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid rgba(251,191,36,${canAuction ? '0.35' : '0.1'})`,
              color: canAuction ? '#fbbf24' : 'rgba(156,163,175,0.25)',
              fontSize: 10, fontWeight: 700, cursor: canAuction ? 'pointer' : 'not-allowed',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            🔨 Put to Auction
          </button>
          {!canAuction && (
            <div style={{ fontSize: 8, color: '#f87171', marginTop: 4, lineHeight: 1.25 }}>
              {houses > 0 || hotel || hasHousesInGroup 
                ? 'Sell houses/hotels in group first'
                : pendingAction !== null 
                  ? 'Cannot auction during turn sequence'
                  : ''}
            </div>
          )}
        </div>
      )}

      {/* Buy / Auction actions */}
      {(canBuy || (pendingAction === 'buy_decision' && isMyTurn)) && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {canBuy && (
            <button
              onClick={onBuy}
              style={{
                width: '100%', padding: '9px', borderRadius: 8,
                background: groupColor
                  ? `linear-gradient(135deg,${groupColor},${groupColor}cc)`
                  : 'linear-gradient(135deg,#d97706,#f59e0b)',
                color: '#0a0805', fontWeight: 800, fontSize: 11,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
                boxShadow: `0 3px 14px ${groupColor ? groupColor + '50' : 'rgba(245,158,11,0.4)'}`,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              🏠 Buy ₹{fmt(tile.price)}
            </button>
          )}
          {!canAfford && isPurchasable(tile) && !isOwned && (
            <div style={{ fontSize: 9, color: '#f87171', textAlign: 'center' }}>
              Need ₹{fmt((tile.price ?? 0) - myMoney)} more
            </div>
          )}
          <button
            onClick={onEndTurn}
            style={{
              width: '100%', padding: '7px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(156,163,175,0.6)', fontWeight: 600, fontSize: 10,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {pendingAction === 'buy_decision' ? 'Decline & End Turn' : 'End Turn →'}
          </button>
        </div>
      )}
    </div>
  );
}