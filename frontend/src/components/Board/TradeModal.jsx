/**
 * components/Board/TradeModal.jsx
 *
 * Full property trading UI.
 * Supports: property↔property, cash↔property, property+cash combos.
 *
 * Flow:
 *   1. Proposer picks target player, selects offer (properties + cash), selects request (properties + cash)
 *   2. Clicks "Propose" → emits initiate-trade via onInitiateTrade
 *   3. Target player sees incoming offer → Accept or Reject
 *   4. Proposer can cancel while pending
 *
 * Multiplayer-safe: all actions go through socket (onInitiateTrade etc).
 * gameState.activeTrade is the source of truth.
 *
 * Props:
 *   gameState        — full client game state
 *   myId             — my player id
 *   players          — enriched players map
 *   properties       — gameState.properties
 *   onInitiateTrade  — (targetId, offer, request) => void
 *   onAcceptTrade    — () => void
 *   onRejectTrade    — () => void
 *   onCancelTrade    — () => void
 *   onClose          — () => void
 */
import React, { useState, useMemo } from 'react';
import { BOARD_TILES, COLOR_GROUP_META } from '../../utils/boardTiles';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

// ── Property chip ─────────────────────────────────────────────────────────────
function PropChip({ tile, selected, onClick, disabled }) {
  const groupColor = tile.group ? COLOR_GROUP_META[tile.group]?.hex : null;
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '5px 8px',
        borderRadius: 8,
        background:   selected
          ? (groupColor ? `${groupColor}25` : 'rgba(212,175,55,0.15)')
          : 'rgba(255,255,255,0.04)',
        border:       selected
          ? `1px solid ${groupColor ?? '#d4af37'}60`
          : '1px solid rgba(255,255,255,0.08)',
        cursor:       disabled ? 'default' : 'pointer',
        opacity:      disabled ? 0.4 : 1,
        transition:   'all 0.15s',
        fontSize:     11,
        color:        selected ? '#f3f4f6' : 'rgba(156,163,175,0.7)',
        fontWeight:   selected ? 700 : 400,
      }}
    >
      {groupColor && (
        <div style={{ width: 8, height: 8, borderRadius: 2, background: groupColor, flexShrink: 0 }} />
      )}
      <span>{tile.icon} {tile.name}</span>
    </div>
  );
}

export function TradeModal({
  gameState, myId, players, properties,
  onInitiateTrade, onAcceptTrade, onRejectTrade, onCancelTrade,
  onClose,
  activeTrade: activeTradeProp,
}) {
  const activeTrade = activeTradeProp || gameState?.activeTrade || null;
  const me          = players[myId];
  const isSpectator = sessionStorage.getItem('mi_isSpectator') === 'true' || 
    (gameState?.spectators || []).some(s => s.id === myId);

  // ── My properties ─────────────────────────────────────────────────────────
  const myProperties = useMemo(() =>
    BOARD_TILES.filter(t => properties[t.id]?.ownerId === myId && !properties[t.id]?.mortgaged),
  [properties, myId]);

  // ── Other players ─────────────────────────────────────────────────────────
  const otherPlayers = useMemo(() =>
    Object.values(players).filter(p => p.id !== myId && !p.isBankrupt),
  [players, myId]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [targetId,      setTargetId]      = useState(otherPlayers[0]?.id ?? '');
  const [offerProps,    setOfferProps]     = useState(new Set());
  const [offerCash,     setOfferCash]      = useState('');
  const [requestProps,  setRequestProps]   = useState(new Set());
  const [requestCash,   setRequestCash]    = useState('');
  const [submitting,    setSubmitting]     = useState(false);
  const [error,         setError]          = useState('');

  const targetPlayer = players[targetId];
  const targetProperties = useMemo(() =>
    BOARD_TILES.filter(t => properties[t.id]?.ownerId === targetId && !properties[t.id]?.mortgaged),
  [properties, targetId]);

  const toggleSet = (set, id) => {
    const ns = new Set(set);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    return ns;
  };

  const handlePropose = async () => {
    if (!targetId) { setError('Select a player'); return; }
    const finalOfferCash = Number(offerCash || 0);
    const finalRequestCash = Number(requestCash || 0);
    if (offerProps.size === 0 && finalOfferCash === 0 && requestProps.size === 0 && finalRequestCash === 0) {
      setError('Trade must include at least one item');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onInitiateTrade(targetId, {
        propertyIds: [...offerProps],
        money:       finalOfferCash,
      }, {
        propertyIds: [...requestProps],
        money:       finalRequestCash,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Trade failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Is this player the target of an active trade? ─────────────────────────
  const isTradeTarget    = activeTrade?.toPlayerId === myId;
  const isTradeInitiator = activeTrade?.fromPlayerId === myId;

  const handleClose = async () => {
    if (activeTrade && isTradeTarget) {
      try {
        await onRejectTrade();
      } catch (err) {
        console.error('Failed to auto-reject trade on close:', err);
      }
    }
    onClose();
  };

  const accent = '#3b82f6';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      style={{
        position:       'fixed', inset: 0, zIndex: 1500,
        display:        'flex', alignItems: 'center', justifyContent: 'center',
        background:     'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        cursor:         'pointer',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        500, maxWidth: '96vw', maxHeight: '90vh',
          overflowY:    'auto', borderRadius: 20,
          background:   'linear-gradient(160deg,#080e18,#050a12)',
          border:       `1.5px solid ${accent}35`,
          boxShadow:    `0 32px 100px rgba(0,0,0,0.8),0 0 60px ${accent}15`,
          fontFamily:   "'DM Sans',sans-serif",
          cursor:       'default',
          animation:    'propModalIn 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards',
        }}
      >
        {/* Header */}
        <div style={{
          padding:      '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display:      'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>🤝 Trade</div>
            {activeTrade && (
              <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.5)', marginTop: 2 }}>
                {isTradeTarget ? `Offer from ${players[activeTrade.fromPlayerId]?.username}`
                : isTradeInitiator ? 'Your pending offer'
                : 'Trade in progress'}
              </div>
            )}
          </div>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: 'rgba(156,163,175,0.5)',
            cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        {/* ── Active trade review (target player) ── */}
        {activeTrade && isTradeTarget && (
          <div style={{ padding: '16px 20px' }}>
            <TradeReview
              trade={activeTrade}
              players={players}
              properties={properties}
              onAccept={async () => { await onAcceptTrade(); onClose(); }}
              onReject={async () => { await onRejectTrade(); onClose(); }}
            />
          </div>
        )}

        {/* ── Initiator can cancel pending trade ── */}
        {activeTrade && isTradeInitiator && (
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(156,163,175,0.7)', marginBottom: 14 }}>
              Waiting for {players[activeTrade.toPlayerId]?.username} to respond…
            </div>
            <button
              onClick={async () => { await onCancelTrade(); onClose(); }}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel Trade
            </button>
          </div>
        )}

        {/* ── Propose a new trade ── */}
        {!activeTrade && (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Target player selector */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(156,163,175,0.45)', letterSpacing: '0.1em', marginBottom: 6 }}>
                TRADE WITH
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {otherPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setTargetId(p.id); setRequestProps(new Set()); setRequestCash(0); }}
                    style={{
                      padding: '5px 12px', borderRadius: 8,
                      background: targetId === p.id ? `${p.color}22` : 'rgba(255,255,255,0.04)',
                      border: targetId === p.id ? `1px solid ${p.color}60` : '1px solid rgba(255,255,255,0.08)',
                      color: targetId === p.id ? p.color : 'rgba(156,163,175,0.6)',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    {p.token} {p.username}
                  </button>
                ))}
              </div>
            </div>

            {/* Two-column: You offer / You request */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* You Offer */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                padding: '12px', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.6)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
                  YOU OFFER
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {myProperties.length === 0
                    ? <div style={{ fontSize: 11, color: 'rgba(156,163,175,0.3)' }}>No properties</div>
                    : myProperties.map(t => (
                      <PropChip
                        key={t.id} tile={t}
                        selected={offerProps.has(t.id)}
                        onClick={() => setOfferProps(s => toggleSet(s, t.id))}
                      />
                    ))}
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.4)', marginBottom: 4 }}>Cash offer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#d4af37' }}>₹</span>
                    <input
                      type="number" min="0" max={me?.money ?? 0}
                      value={offerCash}
                      onChange={e => {
                        const valStr = e.target.value;
                        if (valStr === '') {
                          setOfferCash('');
                        } else {
                          const num = Number(valStr);
                          if (!isNaN(num)) {
                            setOfferCash(Math.max(0, Math.min(me?.money ?? 0, Math.floor(num))));
                          }
                        }
                      }}
                      style={{
                        flex: 1, padding: '4px 6px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f3f4f6', fontSize: 12, outline: 'none',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.35)', marginTop: 2 }}>
                    Balance: ₹{fmt(me?.money)}
                  </div>
                </div>
              </div>

              {/* You Request */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                padding: '12px', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(59,130,246,0.6)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
                  YOU REQUEST
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {!targetId
                    ? <div style={{ fontSize: 11, color: 'rgba(156,163,175,0.3)' }}>Select player first</div>
                    : targetProperties.length === 0
                      ? <div style={{ fontSize: 11, color: 'rgba(156,163,175,0.3)' }}>No properties</div>
                      : targetProperties.map(t => (
                        <PropChip
                          key={t.id} tile={t}
                          selected={requestProps.has(t.id)}
                          onClick={() => setRequestProps(s => toggleSet(s, t.id))}
                        />
                      ))}
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.4)', marginBottom: 4 }}>Cash request</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#d4af37' }}>₹</span>
                    <input
                      type="number" min="0"
                      max={isSpectator ? (targetPlayer?.money ?? 0) : undefined}
                      value={requestCash}
                      onChange={e => {
                        const valStr = e.target.value;
                        if (valStr === '') {
                          setRequestCash('');
                        } else {
                          const num = Number(valStr);
                          if (!isNaN(num)) {
                            const val = Math.floor(num);
                            setRequestCash(Math.max(0, isSpectator ? Math.min(targetPlayer?.money ?? 0, val) : val));
                          }
                        }
                      }}
                      style={{
                        flex: 1, padding: '4px 6px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#f3f4f6', fontSize: 12, outline: 'none',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    />
                  </div>
                  {isSpectator && (
                    <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.35)', marginTop: 2 }}>
                      Their balance: ₹{fmt(targetPlayer?.money)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePropose}
              disabled={submitting || !targetId}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: submitting ? 'rgba(59,130,246,0.1)' : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                border: 'none', color: '#fff', fontWeight: 800, fontSize: 13,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: "'DM Sans',sans-serif",
                letterSpacing: '0.05em',
                opacity: !targetId ? 0.5 : 1,
              }}
            >
              {submitting ? 'Proposing…' : '🤝 Propose Trade'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trade review component (shown to trade target) ────────────────────────────
function TradeReview({ trade, players, properties, onAccept, onReject }) {
  const from = players[trade.fromPlayerId];
  const to   = players[trade.toPlayerId];

  const getProps = (ids) =>
    (ids ?? []).map(id => BOARD_TILES.find(t => t.id === id)).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'rgba(156,163,175,0.7)', textAlign: 'center' }}>
        {from?.username} wants to trade with you:
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TradeColumn label="They offer" tiles={getProps(trade.offer.propertyIds)} cash={trade.offer.money} color="#4ade80" />
        <TradeColumn label="They request" tiles={getProps(trade.request.propertyIds)} cash={trade.request.money} color="#f87171" />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAccept}
          style={{
            flex: 1, padding: '10px', borderRadius: 8,
            background: 'linear-gradient(135deg,#166534,#22c55e)',
            border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
          }}
        >✓ Accept</button>
        <button
          onClick={onReject}
          style={{
            flex: 1, padding: '10px', borderRadius: 8,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontWeight: 800, fontSize: 12, cursor: 'pointer',
          }}
        >✕ Reject</button>
      </div>
    </div>
  );
}

function TradeColumn({ label, tiles, cash, color }) {
  const fmt = n => Number(n ?? 0).toLocaleString('en-IN');
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
      padding: '10px', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 9, color: color, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
        {label.toUpperCase()}
      </div>
      {tiles.map(t => {
        const gc = t.group ? COLOR_GROUP_META[t.group]?.hex : null;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 0', fontSize: 11, color: '#d1d5db',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            {gc && <div style={{ width: 6, height: 6, borderRadius: 1, background: gc, flexShrink: 0 }} />}
            {t.icon} {t.name}
          </div>
        );
      })}
      {cash > 0 && (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#d4af37', marginTop: 4 }}>
          + ₹{fmt(cash)} cash
        </div>
      )}
      {tiles.length === 0 && cash === 0 && (
        <div style={{ fontSize: 11, color: 'rgba(156,163,175,0.3)' }}>Nothing</div>
      )}
    </div>
  );
}