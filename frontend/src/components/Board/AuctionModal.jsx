/**
 * components/Board/AuctionModal.jsx
 *
 * Premium Modal for simultaneous real-time property auctions.
 */
import React, { useState, useEffect } from 'react';
import { TILE_BY_ID, COLOR_GROUP_META } from '../../utils/boardTiles';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

export function AuctionModal({
  activeAuction,
  players,
  myId,
  onPlaceBid,
  onPassAuction,
}) {
  if (!activeAuction) return null;

  const tile = TILE_BY_ID[activeAuction.tileId];
  if (!tile) return null;

  const groupMeta  = tile.group ? COLOR_GROUP_META[tile.group] : null;
  const groupColor = groupMeta?.hex ?? '#d4af37';

  const myPlayer = players[myId];
  const hasPassed = activeAuction.passedPlayers?.includes(myId) ?? false;
  const isParticipant = activeAuction.participants?.includes(myId) ?? false;
  const canBid = isParticipant && !hasPassed && !myPlayer?.isBankrupt;

  const highBid = activeAuction.highBid ?? 0;
  const highBidder = activeAuction.highBidderId ? players[activeAuction.highBidderId] : null;

  const [bidAmount, setBidAmount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // Keep bidAmount valid as highBid updates from socket
  useEffect(() => {
    setBidAmount(0);
  }, [highBid]);

  // Live countdown timer synced to activeAuction.endsAt
  useEffect(() => {
    if (!activeAuction.endsAt) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((activeAuction.endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const timerId = setInterval(updateTimer, 250);
    return () => clearInterval(timerId);
  }, [activeAuction.endsAt]);

  const handleQuickBid = (increment) => {
    const nextBid = highBid + increment;
    if (nextBid <= (myPlayer?.money ?? 0)) {
      setBidAmount(nextBid);
    }
  };

  const submitBid = () => {
    const num = Number(bidAmount);
    if (isNaN(num) || num <= highBid) return;
    if (num > (myPlayer?.money ?? 0)) return;
    onPlaceBid?.(num);
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1500,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          width:        400,
          maxWidth:     '95vw',
          borderRadius: 24,
          background:   'linear-gradient(160deg,#0a0d16 0%,#05080c 100%)',
          border:       `1.5px solid ${groupColor}40`,
          boxShadow:    `0 24px 80px rgba(0,0,0,0.9), 0 0 50px ${groupColor}20`,
          fontFamily:   "'DM Sans',sans-serif",
          overflow:     'hidden',
          animation:    'propModalIn 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards',
        }}
      >
        {/* Header strip */}
        <div style={{
          height: 8,
          background: `linear-gradient(90deg, ${groupColor}, #fbbf24, ${groupColor})`,
        }} />

        {/* Title */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 18, fontWeight: 900,
            color: '#fbbf24', margin: 0,
            textTransform: 'uppercase', letterSpacing: '0.15em',
            fontFamily: "'Playfair Display',serif",
          }}>
            🔨 Property Auction 🔨
          </h2>
          {timeLeft > 0 ? (
            <div style={{
              fontSize: 12, color: '#f87171', fontWeight: 800, marginTop: 6,
              letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>
              ⏳ Time Remaining: <span style={{ fontSize: 14, color: '#ef4444' }}>{timeLeft}s</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 800, marginTop: 6 }}>
              ⏳ Concluding Auction...
            </div>
          )}
        </div>

        {/* Property Info */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${groupColor}22`, border: `1px solid ${groupColor}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>{tile.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f3f4f6' }}>{tile.name}</div>
            <div style={{ fontSize: 10, color: groupColor, fontWeight: 700, textTransform: 'uppercase' }}>
              {groupMeta?.label ?? 'Special'} Group
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.5)', letterSpacing: '0.05em' }}>VALUE</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>₹{fmt(tile.price)}</div>
          </div>
        </div>

        {/* High Bid Display */}
        <div style={{
          padding: '20px 24px',
          textAlign: 'center',
          background: 'rgba(251,191,36,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Current High Bid
          </div>
          <div style={{
            fontSize: 32, fontWeight: 900,
            background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '4px 0',
          }}>
            ₹{fmt(highBid)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(156,163,175,0.65)' }}>
            Bidder:{' '}
            {highBidder ? (
              <span style={{ fontWeight: 800, color: highBidder.color }}>
                {highBidder.username} {activeAuction.highBidderId === myId ? '(You)' : ''}
              </span>
            ) : (
              <em style={{ color: 'rgba(156,163,175,0.35)' }}>No bids yet</em>
            )}
          </div>
        </div>

        {/* Participants & Stats */}
        <div style={{
          padding: '12px 20px',
          maxHeight: 110, overflowY: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.45)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>
            Bidders Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeAuction.participants?.map((pid) => {
              const p = players[pid];
              if (!p) return null;
              const hasP = activeAuction.passedPlayers?.includes(pid) ?? false;
              return (
                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: p.color, fontWeight: pid === myId ? 800 : 500 }}>
                    {p.username} {pid === myId ? ' (You)' : ''}
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: hasP ? '#ef4444' : '#10b981',
                  }}>
                    {hasP ? '❌ OUT / PASS' : '✔ ACTIVE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bidding Controls */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {canBid ? (
            <>
              {/* Quick Increment Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[100, 500, 1000].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => handleQuickBid(inc)}
                    disabled={highBid + inc > myPlayer.money}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#d1d5db', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  >
                    +₹{inc}
                  </button>
                ))}
              </div>

              {/* Custom Bid Input */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(156,163,175,0.5)' }}>Custom Bid:</span>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBidAmount(val === '' ? '' : Number(val));
                  }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none',
                    textAlign: 'right',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={submitBid}
                  disabled={!bidAmount || Number(bidAmount) <= highBid || Number(bidAmount) > myPlayer.money}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                    color: '#0a0805', fontWeight: 900, fontSize: 13,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Place Bid (₹{bidAmount ? fmt(bidAmount) : '0'})
                </button>
                <button
                  onClick={onPassAuction}
                  style={{
                    padding: '12px 18px', borderRadius: 12,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171', fontWeight: 700, fontSize: 12,
                    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Pass / Fold
                </button>
              </div>

              <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.4)', textAlign: 'center' }}>
                Your Balance: <span style={{ color: '#4ade80', fontWeight: 700 }}>₹{fmt(myPlayer.money)}</span>
              </div>
            </>
          ) : (
            <div style={{
              padding: '16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center', fontSize: 12, color: 'rgba(156,163,175,0.45)',
              fontWeight: 700,
            }}>
              {hasPassed ? '❌ You have passed / folded this auction' : '⏳ Spectating auction...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
