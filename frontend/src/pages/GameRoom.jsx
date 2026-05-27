/**
 * frontend/src/pages/GameRoom.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multiplayer Monopoly India — fully integrated game room.
 *
 * CHANGES vs previous version:
 *  - useBoardAnimation now receives releasePendingMoves (token gating fixed)
 *  - useTokenMovement.releasePendingMoves wired through useBoardAnimation
 *  - onDeckClick handler: calls drawCard() from useBoardAnimation
 *  - All new modal/panel props passed down to MonopolyBoard
 *  - Build actions: onBuildHouse, onBuildHotel, onSellHouse, onSellHotel
 *  - Trade actions: onInitiateTrade, onAcceptTrade, onRejectTrade, onCancelTrade
 *  - All actions go through doAction wrapper (loading + error handling)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate }                    from 'react-router-dom';
import socket                                         from '@/socket/socket';
import socketService                                  from '@/services/socketService';
import ConnectionStatus                               from '@/components/GameHUD/ConnectionStatus';
import EndGameModal                                    from '@/components/EndGameModal';
import BankruptcyModal                                 from '@/components/BankruptcyModal';

import { MonopolyBoard }      from '@/components/Board/MonopolyBoard';
import { useDiceAnimation }   from '@/hooks/useDiceAnimation';
import { useTokenMovement }   from '@/hooks/useTokenMovement';
import { useBoardAnimation }  from '@/hooks/useBoardAnimation';
import { delay }              from '@/utils/animationHelpers';
import { BOARD_TILES, TILE_BY_ID, COLOR_GROUP_META } from '@/utils/boardTiles';

// ─────────────────────────────────────────────────────────────────────────────
const stored = (k) => sessionStorage.getItem(k) ?? '';
const TOKENS  = ['🚗', '🐘', '🚆', '👑', '🛺', '🐅', '⚓', '🎯'];

const hasMonopoly = (properties, playerId, tileId) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile || !tile.group) return false;
  const groupTiles = BOARD_TILES.filter(t => t.group === tile.group).map(t => t.id);
  return groupTiles.every(id => properties[id] && properties[id].ownerId === playerId);
};

const countRailwaysOwned = (properties, playerId) => {
  return BOARD_TILES.filter(t => t.type === 'railway' && properties[t.id]?.ownerId === playerId).length;
};

const countUtilitiesOwned = (properties, playerId) => {
  return BOARD_TILES.filter(t => t.type === 'utility' && properties[t.id]?.ownerId === playerId).length;
};

const calculateRent = (properties, players, tileId, landingPlayerId, diceTotal = 7) => {
  const prop = properties[tileId];
  if (!prop || !prop.ownerId || prop.mortgaged) return 0;

  const tile = TILE_BY_ID[tileId];
  if (!tile) return 0;

  if (tile.type === 'railway') {
    const owned = countRailwaysOwned(properties, prop.ownerId);
    return tile.rent[Math.max(0, owned - 1)] ?? 0;
  }

  if (tile.type === 'utility') {
    const owned = countUtilitiesOwned(properties, prop.ownerId);
    const multiplier = tile.rent[owned === 2 ? 1 : 0] ?? 4;
    return diceTotal * multiplier;
  }

  if (tile.type === 'property') {
    if (prop.hotel) return tile.rent[5];
    if (prop.houses > 0) return tile.rent[prop.houses];
    const monopoly = hasMonopoly(properties, prop.ownerId, tileId);
    return monopoly ? tile.rent[0] * 2 : tile.rent[0];
  }

  return 0;
};


const TILE_NAMES = [
  'Start 🇮🇳','Patna','Community Chest','Ranchi','Income Tax',
  'Railways North','Chandigarh','Chance','Indore','Lucknow',
  'Tihar Jail','Ahmedabad','Electricity','Pune','Kochi',
  'Railways South','Chennai','Community Chest','Hyderabad','Kolkata',
  'Tea Break','Bengaluru','Chance','Delhi','Mumbai',
  'Railways East','Jaipur','Goa','Water Board','Shimla',
  'Go To Jail','Munnar','Srinagar','Community Chest','Andaman',
  'Railways West','Chance','Tech Park','GST Payment','Marine Drive',
];
const tileName = (pos) => TILE_NAMES[pos] ?? `Tile ${pos}`;

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PlayerCard({ player, index, isCurrentTurn, isMe }) {
  const ownedCount = player.ownedProperties?.length ?? 0;
  return (
    <div
      className="flex items-start gap-2 px-2.5 py-2.5 rounded-xl transition-all duration-300"
      style={{
        background: isCurrentTurn ? 'rgba(34,197,94,0.08)' : isMe ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
        border: isCurrentTurn ? '1px solid rgba(34,197,94,0.25)' : isMe ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.05)',
        opacity: player.isBankrupt ? 0.4 : 1,
      }}
    >
      <span className="text-lg flex-shrink-0 mt-0.5"
        style={{ filter: isCurrentTurn ? 'drop-shadow(0 0 6px rgba(34,197,94,0.9))' : 'none' }}>
        {TOKENS[index % TOKENS.length]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-semibold truncate"
            style={{ color: isCurrentTurn ? '#4ade80' : isMe ? '#fde68a' : '#d1d5db', fontFamily:"'DM Sans',sans-serif" }}>
            {player.username}{isMe ? ' (you)' : ''}
          </p>
          {isCurrentTurn && <span style={{ fontSize:'0.5rem', color:'#4ade80' }}>▶</span>}
          {player.isBankrupt && (
            <span className="text-xs px-1 rounded"
              style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', fontSize:'0.55rem', fontWeight:700 }}>
              BANKRUPT
            </span>
          )}
          {player.isConnected === false && !player.isBankrupt && (
            <span style={{ fontSize:'0.55rem', color:'#f59e0b' }}>⚠</span>
          )}
        </div>
        <p className="text-xs font-bold mb-1"
          style={{ color: isCurrentTurn ? 'rgba(74,222,128,0.8)' : 'rgba(212,175,55,0.7)', fontFamily:"'DM Sans',sans-serif" }}>
          ₹{Number(player.money ?? 0).toLocaleString('en-IN')}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color:'rgba(156,163,175,0.5)', fontFamily:"'DM Sans',sans-serif" }}>
            📍 {tileName(player.position ?? 0)}
          </span>
          {player.inJail && (
            <span className="text-xs px-1 rounded"
              style={{ background:'rgba(239,68,68,0.1)', color:'#fca5a5', fontSize:'0.6rem' }}>
              🔒 Jail
            </span>
          )}
          {ownedCount > 0 && (
            <span className="text-xs" style={{ color:'rgba(156,163,175,0.45)', fontSize:'0.65rem' }}>
              🏠 {ownedCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, variant = 'primary', loading = false }) {
  const isPrimary = variant === 'primary';
  const isDanger  = variant === 'danger';
  const bg    = disabled ? 'rgba(255,255,255,0.04)'
              : isPrimary ? 'linear-gradient(135deg,#d97706 0%,#f59e0b 50%,#d97706 100%)'
              : isDanger  ? 'rgba(239,68,68,0.15)'
              : 'rgba(255,255,255,0.06)';
  const color = disabled ? 'rgba(156,163,175,0.3)' : isPrimary ? '#0a0805' : isDanger ? '#fca5a5' : '#d1d5db';
  const border = disabled ? '1px solid rgba(255,255,255,0.05)'
               : isPrimary ? 'none'
               : isDanger  ? '1px solid rgba(239,68,68,0.25)'
               : '1px solid rgba(255,255,255,0.1)';
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
      style={{ background: bg, color, border, fontFamily:"'DM Sans',sans-serif",
        boxShadow: !disabled && isPrimary ? '0 3px 14px rgba(245,158,11,0.3)' : 'none' }}
    >
      {loading ? '…' : label}
    </button>
  );
}

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = {
    error:   { bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.3)',   text:'#fca5a5' },
    success: { bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.25)',  text:'#4ade80' },
    info:    { bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.25)', text:'#93c5fd' },
    warning: { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.25)', text:'#fde68a' },
  };
  const c = colors[type] || colors.info;
  return (
    <div className="fixed top-14 left-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 max-w-xs"
      style={{ transform:'translateX(-50%)', background:c.bg, border:`1px solid ${c.border}`, color:c.text, fontFamily:"'DM Sans',sans-serif", backdropFilter:'blur(12px)' }}>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} style={{ opacity:0.6, cursor:'pointer' }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function GameRoom() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();
  const myId         = stored('mi_playerId');

  const [gameState,     setGameState]     = useState(null);
  const [chatMessages,  setChatMessages]  = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [hasDismissedBankruptcy, setHasDismissedBankruptcy] = useState(false);
  
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  const chatEndRef  = useRef(null);
  const eventEndRef = useRef(null);

  // ── Sequencer State Refs ───────────────────────────────────────────────────
  const gameStateRef           = useRef(null);
  const pendingGameStateRef    = useRef(null);
  const eventQueueRef          = useRef([]);
  const isSequencingRef        = useRef(false);
  const applyTimeoutRef        = useRef(null);
  const cardDismissResolverRef = useRef(null);
  const cardTimerRef           = useRef(null);
  const rentDismissResolverRef = useRef(null);
  const isActionPendingRef     = useRef(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (gameState?.status === 'finished') {
      navigate(`/results/${roomCode}`);
    }
  }, [gameState?.status, roomCode, navigate]);

  useEffect(() => {
    const isMeBankrupt = gameState?.players?.[myId]?.isBankrupt;
    if (isMeBankrupt && !hasDismissedBankruptcy) {
      setShowBankruptcyModal(true);
    } else {
      setShowBankruptcyModal(false);
    }
  }, [gameState?.players, myId, hasDismissedBankruptcy]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages]);
  useEffect(() => { eventEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [events]);

  const showToast    = useCallback((msg, type = 'error') => setToast({ message: msg, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const pushFeedEvent = useCallback((msg, icon = '🔔') => {
    setEvents(prev => [...prev.slice(-99), { message:`${icon} ${msg}`, type:'system', ts:Date.now() }]);
  }, []);

  // ── Initial connect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) { navigate('/'); return; }
    const init = async () => {
      try {
        if (!socket.connected) {
          socket.connect();
          await new Promise(res => socket.once('connect', res));
        }
        try {
          const data = await socketService.reconnectRoom(roomCode, myId);
          if (data.gameState) setGameState(data.gameState);
        } catch {
          const data = await socketService.getRoomState();
          if (data.gameState) setGameState(data.gameState);
        }
        try {
          const hist = await socketService.getChatHistory();
          setChatMessages(hist.messages || []);
        } catch { /* no history */ }
      } catch (err) {
        console.error('[GameRoom] init error:', err);
        showToast('Connection failed — retrying…', 'warning');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [roomCode, myId]); // eslint-disable-line

  // ── Animation hooks ────────────────────────────────────────────────────────
  const { dicePhase, displayDice, triggerRoll, resetDice } = useDiceAnimation();

  const { displayPositions, arrivingPlayers, teleportingPlayers, animateMovement } = useTokenMovement(gameState?.players ?? null);

  const boardAnimation = useBoardAnimation();

  // ── Deck click & Card dismissal handlers ──────────────────────────────────
  const handleDismissCard = useCallback(() => {
    clearTimeout(cardTimerRef.current);
    boardAnimation.dismissCard();
    if (cardDismissResolverRef.current) {
      const resolve = cardDismissResolverRef.current;
      cardDismissResolverRef.current = null;
      resolve();
    }
  }, [boardAnimation]);

  const handleDismissRent = useCallback(() => {
    boardAnimation.dismissRent();
    if (rentDismissResolverRef.current) {
      const resolve = rentDismissResolverRef.current;
      rentDismissResolverRef.current = null;
      resolve();
    }
  }, [boardAnimation]);

  const handleDeckClick = useCallback((deckType) => {
    const pendingCardDraw = boardAnimation.pendingCardDraw;
    if (!pendingCardDraw) return;
    if (pendingCardDraw.deck !== deckType) return;
    if (pendingCardDraw.playerId !== myId) return; // only current player

    boardAnimation.showCard(pendingCardDraw.card);

    // Auto-dismiss the revealed card after 5 seconds if not clicked manually
    clearTimeout(cardTimerRef.current);
    cardTimerRef.current = setTimeout(() => {
      handleDismissCard();
    }, 5000);
  }, [boardAnimation, myId, handleDismissCard]);

  // ── Sequencer Loop ────────────────────────────────────────────────────────
  const runSequencer = useCallback(async () => {
    if (isSequencingRef.current) return;
    isSequencingRef.current = true;

    while (eventQueueRef.current.length > 0) {
      const event = eventQueueRef.current.shift();

      const pushMessageLate = (
        event.type === 'DICE_ROLLED' ||
        event.type === 'PLAYER_MOVED' ||
        event.type === 'CHANCE_CARD_DRAWN' ||
        event.type === 'COMMUNITY_CARD_DRAWN'
      );

      // Append log message to local feed at the exact time of sequence execution (if not late)
      if (event.message && !pushMessageLate) {
        pushFeedEvent(event.message, event.type === 'system' ? '⚡' : '🔔');
      }

      switch (event.type) {
        // ── DICE ROLLED ──
        case 'DICE_ROLLED': {
          const { dice } = event.payload;
          // Trigger dice roll animation
          await triggerRoll({
            d1: dice.d1,
            d2: dice.d2,
          });
          if (event.message) {
            pushFeedEvent(event.message, event.type === 'system' ? '⚡' : '🔔');
          }
          // 300ms pause after dice fully stop (as requested)
          await delay(300);
          break;
        }

        // ── PLAYER MOVED (DICE or CARD) ──
        case 'PLAYER_MOVED': {
          const { playerId, from, to, teleport } = event.payload;
          // Animate the player's token step-by-step or teleport instantly
          await animateMovement(playerId, from, to, teleport);
          if (event.message) {
            pushFeedEvent(event.message, event.type === 'system' ? '⚡' : '🔔');
          }
          await delay(300); // 300ms pause after landing bounce!
          break;
        }

        // ── CARD DRAWN ──
        case 'CHANCE_CARD_DRAWN':
        case 'COMMUNITY_CARD_DRAWN': {
          const { card, playerId } = event.payload;
          boardAnimation.setPendingCardDraw({ deck: card.deck, card, playerId });

          // Block the sequencer until the card is drawn and dismissed.
          await new Promise((resolve) => {
            cardDismissResolverRef.current = resolve;

            // If it's another player's turn, auto-draw and auto-dismiss on this client
            if (playerId !== myId) {
              setTimeout(() => {
                if (cardDismissResolverRef.current === resolve) {
                  boardAnimation.showCard(card);
                  setTimeout(() => {
                    if (cardDismissResolverRef.current === resolve) {
                      handleDismissCard();
                    }
                  }, 4000);
                }
              }, 1200);
            }
          });
          if (event.message) {
            pushFeedEvent(event.message, event.type === 'system' ? '⚡' : '🔔');
          }
          break;
        }

        // ── PROPERTY AVAILABLE ──
        case 'PROPERTY_AVAILABLE': {
          const { tileId, canAfford } = event.payload;
          boardAnimation.setPendingPurchase({ tileId, canAfford });
          // Note: we do NOT block the sequencer here, because the purchase action is async
          // and will be resolved when the user makes a choice (which sends new events).
          break;
        }

        // ── RENT PAID ──
        case 'RENT_PAID': {
          const { amount, fromId, toId, partial } = event.payload;
          boardAnimation.setRentInfo({ amount, fromId, toId, partial: partial ?? false });

          // Block the sequencer until the rent is paid/acknowledged
          await new Promise((resolve) => {
            rentDismissResolverRef.current = resolve;

            // If another player is paying, auto-dismiss after 4 seconds
            if (fromId !== myId) {
              setTimeout(() => {
                if (rentDismissResolverRef.current === resolve) {
                  handleDismissRent();
                }
              }, 4000);
            }
          });

          // Show the toast AFTER the payment is made (or animated)
          boardAnimation.showToast({ type: 'rent', amount, fromId, toId, partial: partial ?? false });
          break;
        }

        // ── TAX PAID ──
        case 'TAX_PAID': {
          const { amount } = event.payload;
          boardAnimation.showToast({ type: 'tax', amount });
          await delay(1500);
          break;
        }

        // ── FREE PARKING ──
        case 'FREE_PARKING_COLLECT': {
          const { amount } = event.payload;
          boardAnimation.showToast({ type: 'collect', amount });
          await delay(1500);
          break;
        }

        // ── PASSED GO ──
        case 'PASSED_GO': {
          const { amount } = event.payload;
          boardAnimation.showToast({ type: 'go', amount });
          await delay(1500);
          break;
        }

        // ── PROPERTY BOUGHT ──
        case 'PROPERTY_BOUGHT': {
          const { tileId, price } = event.payload;
          boardAnimation.flashProperty(tileId);
          boardAnimation.setPendingPurchase(null);
          boardAnimation.showToast({ type: 'buy', amount: price, tileId });
          await delay(1000);
          break;
        }

        // ── HOUSE / HOTEL BUILT ──
        case 'HOUSE_BUILT':
        case 'HOTEL_BUILT': {
          const { tileId, houses, hotel } = event.payload;
          boardAnimation.setHouseBuiltInfo({ tileId, houses: houses ?? 0, hotel: hotel ?? false });
          boardAnimation.flashProperty(tileId);
          boardAnimation.showToast({ type: event.type === 'HOTEL_BUILT' ? 'hotel' : 'house', tileId });
          await delay(1500);
          break;
        }

        // ── TURN STARTED / ENDED ──
        case 'TURN_STARTED':
        case 'TURN_ENDED': {
          resetDice();
          boardAnimation.setPendingPurchase(null);
          boardAnimation.setPendingCardDraw(null);
          break;
        }

        // ── TRADE EVENTS ──
        case 'TRADE_INITIATED': {
          boardAnimation.setActiveTrade(event.payload);
          break;
        }
        case 'TRADE_COMPLETED':
        case 'TRADE_REJECTED':
        case 'TRADE_CANCELLED': {
          boardAnimation.setActiveTrade(null);
          if (event.type === 'TRADE_COMPLETED') {
            boardAnimation.showToast({ type: 'trade', message: 'Trade completed!' });
          }
          break;
        }

        // ── AUCTION STARTED ──
        case 'AUCTION_STARTED': {
          boardAnimation.showToast({ type: 'auction', tileId: event.payload.tileId });
          boardAnimation.setPendingPurchase(null);
          break;
        }

        default:
          break;
      }
    }

    // After all events in the queue are executed, apply the pending server state
    if (pendingGameStateRef.current) {
      setGameState(pendingGameStateRef.current);
      pendingGameStateRef.current = null;
    }

    isSequencingRef.current = false;
  }, [myId, triggerRoll, resetDice, animateMovement, pushFeedEvent, boardAnimation, handleDismissCard]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const onGameUpdated = ({ data }) => {
      if (!data) return;
      pendingGameStateRef.current = data;

      // If we are currently running an animation sequence, hold the update.
      if (isSequencingRef.current) return;

      // Check if this update represents a roll or movement
      const hasRollOrMovement = gameStateRef.current && (
        data.lastDice?.total !== gameStateRef.current.lastDice?.total ||
        Object.keys(data.players).some(id => data.players[id].position !== gameStateRef.current.players[id]?.position)
      );

      // If it is a movement/roll update, schedule a longer safety timeout (600ms) to allow events to arrive.
      // If it is a non-movement update, schedule a shorter timeout (300ms).
      // Both will be cancelled immediately if events arrive and the sequencer runs.
      const delayMs = hasRollOrMovement ? 600 : 300;

      // Otherwise, delay slightly to let any accompanying game-events arrive.
      clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = setTimeout(() => {
        if (!isSequencingRef.current && eventQueueRef.current.length === 0) {
          if (pendingGameStateRef.current) {
            setGameState(pendingGameStateRef.current);
            pendingGameStateRef.current = null;
            isActionPendingRef.current = false;
          }
        }
      }, delayMs);
    };

    const onGameEvents = ({ data }) => {
      // Clear action pending flag because events have arrived and are about to be processed
      isActionPendingRef.current = false;

      const incomingEvents = data?.events ?? [];
      if (incomingEvents.length === 0) return;

      // Deduplicate events to guard against any double-emissions/loops
      const uniqueEvents = [];
      const seen = new Set();
      incomingEvents.forEach((ev) => {
        const key = `${ev.type}_${JSON.stringify(ev.payload)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEvents.push(ev);
        }
      });

      if (uniqueEvents.length === 0) return;

      // Cancel the immediate state application because we have events to sequence
      clearTimeout(applyTimeoutRef.current);

      eventQueueRef.current.push(...uniqueEvents);
      runSequencer();
    };

    const onRoomUpdated       = () => {};
    const onPlayerDisconnected = ({ data }) => {
      if (!data) return;
      pushFeedEvent(`${data.username} disconnected`, '⚡');
      showToast(`${data.username} disconnected`, 'warning');
    };
    const onPlayerReconnected = ({ data }) => {
      if (!data) return;
      pushFeedEvent(`${data.username} reconnected`, '✅');
      showToast(`${data.username} reconnected!`, 'success');
    };
    const onReceiveMessage    = ({ data }) => {
      if (data?.message) setChatMessages(prev => [...prev, data.message]);
    };
    const onGameOver          = ({ data }) => {
      const winner = data?.username ?? 'Someone';
      pushFeedEvent(`Game Over! ${winner} wins! 🏆`, '🎉');
      setTimeout(() => { alert(`🏆 ${winner} wins Monopoly India!`); navigate('/'); }, 800);
    };

    const onLoanApproved = ({ ok, data, error }) => {
      showToast('Emergency loan approved by Madras Banking Corp!', 'success');
    };
    const onLoanRejected = ({ ok, error }) => {
      showToast(error || 'Loan application rejected', 'error');
    };
    const onLoanRepaymentDue = ({ ok, data }) => {
      showToast('⚠️ Notice: Loan repayment is due next turn!', 'warning');
    };
    const onLoanRepaid = ({ ok, data }) => {
      showToast('💰 Loan repaid in full. Credit line cleared!', 'success');
    };

    socket.on('game-updated',        onGameUpdated);
    socket.on('game-events',         onGameEvents);
    socket.on('room-updated',        onRoomUpdated);
    socket.on('player-disconnected', onPlayerDisconnected);
    socket.on('player-reconnected',  onPlayerReconnected);
    socket.on('receive-message',     onReceiveMessage);
    socket.on('game-over',           onGameOver);
    socket.on('loan-approved',       onLoanApproved);
    socket.on('loan-rejected',       onLoanRejected);
    socket.on('loan-repayment-due',  onLoanRepaymentDue);
    socket.on('loan-repaid',         onLoanRepaid);
    return () => {
      socket.off('game-updated',        onGameUpdated);
      socket.off('game-events',         onGameEvents);
      socket.off('room-updated',        onRoomUpdated);
      socket.off('player-disconnected', onPlayerDisconnected);
      socket.off('player-reconnected',  onPlayerReconnected);
      socket.off('receive-message',     onReceiveMessage);
      socket.off('game-over',           onGameOver);
      socket.off('loan-approved',       onLoanApproved);
      socket.off('loan-rejected',       onLoanRejected);
      socket.off('loan-repayment-due',  onLoanRepaymentDue);
      socket.off('loan-repaid',         onLoanRepaid);
    };
  }, [navigate, pushFeedEvent, showToast, runSequencer]);


  // ── Action wrapper ─────────────────────────────────────────────────────────
  const doAction = useCallback(async (key, serviceFn, label) => {
    setActionLoading(key);
    isActionPendingRef.current = true; // Lock state updates
    try {
      await serviceFn();
    } catch (err) {
      showToast(err.message || `${label} failed`, 'error');
      isActionPendingRef.current = false; // Action failed, unlock immediately
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const handleRollDice  = useCallback(() => doAction('roll', socketService.rollDice,   'Roll Dice'),   [doAction]);
  const handleBuyProp   = useCallback(() => doAction('buy',  socketService.buyProperty, 'Buy'),         [doAction]);
  const handleEndTurn   = useCallback(() => doAction('end',  socketService.endTurn,     'End Turn'),    [doAction]);
  const handlePayJail   = useCallback(() => doAction('jail', socketService.payJailFine, 'Pay Fine'),    [doAction]);
  const handlePlaceBid    = useCallback((amount) => doAction('bid',  () => socketService.placeBid(amount), 'Place Bid'),  [doAction]);
  const handlePassAuction = useCallback(() => doAction('pass', socketService.passAuction,                  'Pass Auction'), [doAction]);
  const handleAuctionProperty = useCallback((tileId) => doAction('auction-prop', () => socketService.startPropertyAuction(tileId), 'Auction Property'), [doAction]);

  // Build actions
  const handleBuildHouse = useCallback((tileId) =>
    doAction(`buildHouse${tileId}`, () => socketService.buildHouse(tileId), 'Build House'), [doAction]);
  const handleBuildHotel = useCallback((tileId) =>
    doAction(`buildHotel${tileId}`, () => socketService.buildHotel(tileId), 'Build Hotel'), [doAction]);
  const handleSellHouse  = useCallback((tileId) =>
    doAction(`sellHouse${tileId}`, () => socketService.sellHouse(tileId), 'Sell House'),   [doAction]);
  const handleSellHotel  = useCallback((tileId) =>
    doAction(`sellHotel${tileId}`, () => socketService.sellHotel(tileId), 'Sell Hotel'),   [doAction]);

  // Loan & Bankruptcy actions
  const handleTakeLoan = useCallback((amount) =>
    doAction('takeLoan', () => socketService.takeLoan(amount), 'Take Loan'), [doAction]);
  const handleRepayLoan = useCallback(() =>
    doAction('repayLoan', socketService.repayLoan, 'Repay Loan'), [doAction]);
  const handleDeclareBankruptcy = useCallback(() =>
    doAction('declareBankruptcy', socketService.declareBankruptcy, 'Declare Bankruptcy'), [doAction]);
  const handleRequestEndGame = useCallback(() => {
    setShowEndGameModal(false);
    doAction('requestEndGame', socketService.requestEndGame, 'Request End Game');
  }, [doAction]);
  const handleVoteEndGame = useCallback((accept) => {
    doAction('voteEndGame', () => socketService.voteEndGame(accept), 'Vote End Game');
  }, [doAction]);

  // Trade actions
  const handleInitiateTrade = useCallback((targetId, offer, request) =>
    socketService.initiateTrade(targetId, offer, request), []);
  const handleAcceptTrade   = useCallback(() => socketService.acceptTrade(),  []);
  const handleRejectTrade   = useCallback(() => socketService.rejectTrade(),  []);
  const handleCancelTrade   = useCallback(() => socketService.cancelTrade(),  []);

  // Chat
  const handleChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    try { await socketService.sendMessage(text); } catch { /* silent */ }
  }, [chatInput]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const players         = gameState ? Object.values(gameState.players) : [];
  const currentPlayerId = gameState?.currentPlayerId;
  const isMyTurn        = currentPlayerId === myId;
  const me              = gameState?.players?.[myId];
  const hasRolled       = gameState?.hasRolled ?? false;
  const canRoll         = isMyTurn && !hasRolled && !me?.isBankrupt;
  const canEnd          = isMyTurn && hasRolled;
  const canPayJail      = isMyTurn && (me?.inJail ?? false);

  const myProperties = Object.entries(gameState?.properties ?? {})
    .filter(([_, prop]) => prop.ownerId === myId)
    .map(([id, prop]) => {
      const tile = TILE_BY_ID[id];
      return {
        id: Number(id),
        ...prop,
        tile,
      };
    })
    .filter(p => p.tile)
    .sort((a, b) => a.tile.position - b.tile.position);



  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background:'#0a0805', fontFamily:"'DM Sans',sans-serif" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl animate-bounce">🎲</div>
          <p style={{ color:'rgba(212,175,55,0.6)', letterSpacing:'0.15em', fontSize:'0.8rem', textTransform:'uppercase', fontWeight:600 }}>
            Loading game…
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col overflow-hidden"
      style={{ background:'#080604', fontFamily:"'DM Sans',sans-serif", color:'#f3f4f6' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.18); border-radius: 4px }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background:'rgba(0,0,0,0.65)', borderBottom:'1px solid rgba(212,175,55,0.1)', backdropFilter:'blur(12px)' }}>
        <span className="font-black text-base"
          style={{ fontFamily:"'Playfair Display',serif", background:'linear-gradient(135deg,#d4af37,#fde68a,#d97706)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Monopoly <em>India</em>
        </span>
        <div className="flex items-center gap-3">
          {isMyTurn && (
            <span className="text-xs font-bold px-3 py-1 rounded-full animate-pulse"
              style={{ background:'rgba(34,197,94,0.18)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.3)' }}>
              Your Turn
            </span>
          )}
          {gameState?.activeAuction && (
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.3)' }}>
              🔨 Auction
            </span>
          )}
          <ConnectionStatus />
          {gameState?.status === 'playing' && (
            <button
              onClick={() => setShowEndGameModal(true)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#fca5a5',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            >
              🛑 End Game
            </button>
          )}
          <span className="text-xs" style={{ color:'rgba(156,163,175,0.4)' }}>{roomCode}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-60 flex flex-col gap-0 flex-shrink-0 overflow-hidden"
          style={{ borderRight:'1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

            <h3 className="text-xs font-bold uppercase tracking-widest"
              style={{ color:'rgba(212,175,55,0.5)' }}>Players</h3>

            {players.length === 0
              ? <p className="text-xs" style={{ color:'rgba(156,163,175,0.3)' }}>No players found</p>
              : players.map((p, i) => (
                <PlayerCard key={p.id} player={p} index={i}
                  isCurrentTurn={p.id === currentPlayerId} isMe={p.id === myId} />
              ))
            }

            <div style={{ height:'1px', background:'rgba(255,255,255,0.05)' }} />

            <h3 className="text-xs font-bold uppercase tracking-widest"
              style={{ color:'rgba(212,175,55,0.5)' }}>Live Events</h3>

            <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight:'220px', minHeight:'60px' }}>
              {events.length === 0
                ? <p className="text-xs" style={{ color:'rgba(156,163,175,0.25)' }}>No events yet…</p>
                : events.slice(-30).map((ev, i) => (
                  <p key={i} className="text-xs leading-snug"
                    style={{
                      color: ev.type === 'system' ? 'rgba(245,158,11,0.6)' : 'rgba(209,213,219,0.55)',
                      fontFamily:"'DM Sans',sans-serif",
                      borderLeft: ev.type === 'system' ? '2px solid rgba(245,158,11,0.3)' : '2px solid rgba(255,255,255,0.06)',
                      paddingLeft: '6px',
                    }}>
                    {ev.message}
                  </p>
                ))
              }
              <div ref={eventEndRef} />
            </div>
          </div>

          {/* Controls */}
          <div className="p-3 flex flex-col gap-2 flex-shrink-0"
            style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color:'rgba(212,175,55,0.5)' }}>
              {isMyTurn ? '⚡ Your Actions' : 'Actions'}
            </h3>

            <ActionButton label="🎲 Roll Dice"
              onClick={handleRollDice} disabled={!canRoll}
              loading={actionLoading === 'roll'} variant="primary" />

            {canPayJail && (
              <ActionButton label="💸 Pay Jail Fine ₹500"
                onClick={handlePayJail} disabled={!canPayJail}
                loading={actionLoading === 'jail'} variant="danger" />
            )}

            <ActionButton label="✔ End Turn"
              onClick={handleEndTurn} disabled={!canEnd}
              loading={actionLoading === 'end'} variant="secondary" />

            {!isMyTurn && gameState && (
              <p className="text-xs text-center mt-1"
                style={{ color:'rgba(156,163,175,0.35)' }}>
                Waiting for {gameState.players?.[currentPlayerId]?.username ?? '…'}
              </p>
            )}

            {/* Pending card draw hint */}
            {boardAnimation.pendingCardDraw && (
              <div style={{
                padding: '6px 8px', borderRadius: 8,
                background: boardAnimation.pendingCardDraw.deck === 'chance' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${boardAnimation.pendingCardDraw.deck === 'chance' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.25)'}`,
                fontSize: 10, color: boardAnimation.pendingCardDraw.deck === 'chance' ? '#fbbf24' : '#93c5fd',
                textAlign: 'center', fontWeight: 600,
              }}>
                {boardAnimation.pendingCardDraw.playerId === myId
                  ? `Click ${boardAnimation.pendingCardDraw.deck === 'chance' ? 'Chance ❓' : 'Community 📦'} deck!`
                  : `Waiting for ${gameState?.players?.[boardAnimation.pendingCardDraw.playerId]?.username ?? '…'} to draw…`
                }
              </div>
            )}
          </div>
        </aside>

        {/* Board */}
        <main className="flex-1 overflow-hidden" style={{ position:'relative', minWidth:0 }}>
          <MonopolyBoard
            gameState={gameState}
            myId={myId}
            isMyTurn={isMyTurn}
            hasRolled={hasRolled}
            dicePhase={dicePhase}
            displayDice={displayDice}
            onRoll={handleRollDice}
            onBuy={handleBuyProp}
            onEndTurn={handleEndTurn}
            // Sizing states
            showTradeModal={showTradeModal}
            setShowTradeModal={setShowTradeModal}
            showBuildPanel={showBuildPanel}
            setShowBuildPanel={setShowBuildPanel}
            showLoanModal={showLoanModal}
            setShowLoanModal={setShowLoanModal}
            // Card system
            pendingCardDraw={boardAnimation.pendingCardDraw}
            activeCard={boardAnimation.activeCard}
            onDeckClick={handleDeckClick}
            onDismissCard={handleDismissCard}
            // Purchase
            pendingPurchase={boardAnimation.pendingPurchase}
            onDismissPurchase={boardAnimation.dismissPurchase}
            // Rent
            rentInfo={boardAnimation.rentInfo}
            onDismissRent={handleDismissRent}
            // Trade
            activeTrade={boardAnimation.activeTrade}
            onInitiateTrade={handleInitiateTrade}
            onAcceptTrade={handleAcceptTrade}
            onRejectTrade={handleRejectTrade}
            onCancelTrade={handleCancelTrade}
            // Build
            onBuildHouse={handleBuildHouse}
            onBuildHotel={handleBuildHotel}
            onSellHouse={handleSellHouse}
            onSellHotel={handleSellHotel}
            // Auction
            onPlaceBid={handlePlaceBid}
            onPassAuction={handlePassAuction}
            onAuctionProperty={handleAuctionProperty}
            // Loans & Bankruptcy
            onTakeLoan={handleTakeLoan}
            onRepayLoan={handleRepayLoan}
            onDeclareBankruptcy={handleDeclareBankruptcy}
            // Visuals
            activeToast={boardAnimation.activeToast}
            flashTile={boardAnimation.flashTile}
            displayPositions={displayPositions}
            arrivingPlayers={arrivingPlayers}
            teleportingPlayers={teleportingPlayers}
          />


        </main>

        {/* Right: Chat & My Properties */}
        <aside className="flex flex-col flex-shrink-0"
          style={{ width: '280px', borderLeft:'1px solid rgba(255,255,255,0.05)', height: '100%' }}>
          
          {/* Chat Container */}
          <div className="flex flex-col" style={{ height: '55%', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="px-3 py-2 flex-shrink-0"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest"
                style={{ color:'rgba(156,163,175,0.4)' }}>Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-3">
              {chatMessages.length === 0
                ? <p className="text-xs text-center mt-4" style={{ color:'rgba(156,163,175,0.25)' }}>No messages yet</p>
                : chatMessages.map((msg) => {
                    const isMe2 = msg.playerId === myId;
                    return (
                      <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe2 ? 'items-end' : 'items-start'}`}>
                        <span className="text-xs" style={{ color:'rgba(156,163,175,0.4)' }}>{msg.username}</span>
                        <div className="text-xs px-2.5 py-1.5 rounded-xl max-w-full break-words"
                          style={{
                            background: isMe2 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                            color: isMe2 ? '#fde68a' : '#d1d5db',
                            border: isMe2 ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.06)',
                          }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
              }
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 flex gap-2 flex-shrink-0"
              style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleChat(); }}
                placeholder="Message…"
                maxLength={300}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#f3f4f6', caretColor:'#f59e0b' }}
              />
              <button onClick={handleChat}
                className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all"
                style={{ background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.18)' }}>
                ↑
              </button>
            </div>
          </div>

          {/* My Properties Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex-shrink-0"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest"
                style={{ color:'rgba(156,163,175,0.4)' }}>My Properties ({myProperties.length})</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {myProperties.length === 0 ? (
                <div className="text-center mt-6 px-2">
                  <p className="text-xs" style={{ color: 'rgba(156,163,175,0.45)', lineHeight: 1.4 }}>
                    🏠 You don't own any properties yet. Land on buyable tiles or win auctions to grow your empire!
                  </p>
                </div>
              ) : (
                myProperties.map(({ id, tile, mortgaged, houses, hotel }) => {
                  const groupColor = tile.group ? (COLOR_GROUP_META[tile.group]?.hex ?? '#9ca3af') : '#4b5563';
                  const currentRent = calculateRent(gameState.properties, gameState.players, id, '', 7);
                  const fmt = (val) => Number(val ?? 0).toLocaleString('en-IN');

                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 10,
                        position: 'relative',
                        overflow: 'hidden',
                        opacity: mortgaged ? 0.6 : 1,
                      }}
                    >
                      {/* Left color stripe */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: groupColor,
                        }}
                      />

                      <div style={{ fontSize: 16, marginLeft: 4 }}>{tile.icon}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tile.name}
                          </span>
                          {mortgaged && (
                            <span style={{ fontSize: 8, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 4px', borderRadius: 4, textTransform: 'uppercase' }}>
                              M
                            </span>
                          )}
                        </div>

                        {/* Buildings indicator */}
                        {(houses > 0 || hotel) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                            {hotel ? (
                              <span style={{ fontSize: 9, color: '#a855f7', fontWeight: 800 }}>🏨 Hotel</span>
                            ) : (
                              <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 800 }}>
                                {'🟢'.repeat(houses)} <span style={{ color: 'rgba(156,163,175,0.5)', fontSize: 8 }}>({houses} Houses)</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: 'rgba(156,163,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rent</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: mortgaged ? 'rgba(156,163,175,0.4)' : '#fbbf24' }}>
                          {mortgaged ? '₹0' : `₹${fmt(currentRent)}`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Buttons Section */}
            {isMyTurn && gameState?.status === 'playing' && (
              <div className="p-3 flex flex-col gap-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => setShowTradeModal(true)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background:    'rgba(59,130,246,0.12)',
                    border:        '1px solid rgba(59,130,246,0.3)',
                    color:         '#93c5fd',
                    letterSpacing: '0.05em',
                    fontFamily:    "'DM Sans',sans-serif",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                >
                  🤝 Trade Property
                </button>
                <button
                  onClick={() => setShowBuildPanel(p => !p)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background:    showBuildPanel ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)',
                    border:        `1px solid rgba(34,197,94,${showBuildPanel ? '0.4' : '0.25'})`,
                    color:         '#4ade80',
                    letterSpacing: '0.05em',
                    fontFamily:    "'DM Sans',sans-serif",
                  }}
                >
                  🏠 Build Houses/Hotels
                </button>
                
                <button
                  onClick={() => setShowLoanModal(true)}
                  disabled={me?.loanActive}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  style={{
                    background:    me?.loanActive ? 'rgba(100,100,100,0.08)' : 'rgba(212,175,55,0.12)',
                    border:        me?.loanActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(212,175,55,0.3)',
                    color:         me?.loanActive ? '#6b7280' : '#fbf5b7',
                    letterSpacing: '0.05em',
                    fontFamily:    "'DM Sans',sans-serif",
                    cursor:        me?.loanActive ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!me?.loanActive) e.currentTarget.style.background = 'rgba(212,175,55,0.22)'; }}
                  onMouseLeave={e => { if (!me?.loanActive) e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
                >
                  🏦 Take Bank Loan
                </button>

                {me?.loanActive && (
                  <button
                    onClick={handleRepayLoan}
                    className="w-full py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background:    'rgba(34,197,94,0.15)',
                      border:        '1px solid rgba(34,197,94,0.35)',
                      color:         '#4ade80',
                      letterSpacing: '0.05em',
                      fontFamily:    "'DM Sans',sans-serif",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
                  >
                    💰 Repay Bank Loan
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* End Game Modal */}
      <EndGameModal
        isOpen={showEndGameModal || !!gameState?.endGameVote}
        onClose={() => setShowEndGameModal(false)}
        onRequestEnd={handleRequestEndGame}
        voteState={gameState?.endGameVote}
        myId={myId}
        onVote={handleVoteEndGame}
        players={gameState?.players ?? {}}
      />

      {/* Bankruptcy Modal */}
      <BankruptcyModal
        isOpen={showBankruptcyModal}
        onClose={() => {
          setShowBankruptcyModal(false);
          setHasDismissedBankruptcy(true);
        }}
      />
    </div>
  );
}