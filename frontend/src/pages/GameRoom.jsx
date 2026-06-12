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
import RuleBookModal                                   from '@/components/RuleBookModal';
import OnboardingTutorial                              from '@/components/Board/OnboardingTutorial';
import ShortfallPanel                                  from '@/components/Board/ShortfallPanel';

import { MonopolyBoard }      from '@/components/Board/MonopolyBoard';
import { useDiceAnimation }   from '@/hooks/useDiceAnimation';
import { useTokenMovement }   from '@/hooks/useTokenMovement';
import { useBoardAnimation }  from '@/hooks/useBoardAnimation';
import { delay }              from '@/utils/animationHelpers';
import { BOARD_TILES, TILE_BY_ID, COLOR_GROUP_META } from '@/utils/boardTiles';
import { PLAYER_TOKENS }      from '@/utils/boardLayout';
import {
  playCoinSound,
  playDiceRoll,
  playJailSound,
  playWinnerSound,
  playTradeSound,
  playBankruptcySound,
  toggleMute,
  getMuteStatus
} from '../utils/audio';

// ─────────────────────────────────────────────────────────────────────────────
const stored = (k) => sessionStorage.getItem(k) ?? '';

const hasMonopoly = (properties, playerId, tileId) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile || !tile.group) return false;
  const groupTiles = BOARD_TILES.filter(t => t.group === tile.group).map(t => t.id);
  return groupTiles.every(id => properties[id] && properties[id].ownerId === playerId);
};

const countRailwaysOwned = (properties, playerId) => {
  return BOARD_TILES.filter(t => t.type === 'railway' && properties[t.id]?.ownerId === playerId && !properties[t.id]?.mortgaged).length;
};

const countUtilitiesOwned = (properties, playerId) => {
  return BOARD_TILES.filter(t => t.type === 'utility' && properties[t.id]?.ownerId === playerId && !properties[t.id]?.mortgaged).length;
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

const PlayerCard = React.memo(function PlayerCard({ player, index, isCurrentTurn, isMe, isViewerSpectator = false }) {
  const ownedCount = player.ownedProperties?.length ?? 0;
  const token = player.token || PLAYER_TOKENS[index % PLAYER_TOKENS.length];
  const showMoney = isMe || isViewerSpectator;
  return (
    <div
      id={`player-card-${player.id}`}
      className="flex items-start gap-2 px-2.5 py-2.5 rounded-xl transition-all duration-300"
      style={{
        background: isCurrentTurn ? 'rgba(34,197,94,0.08)' : isMe ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
        border: isCurrentTurn ? '1px solid rgba(34,197,94,0.25)' : isMe ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.05)',
        opacity: player.isBankrupt ? 0.4 : 1,
      }}
    >
      <span className="text-lg flex-shrink-0 mt-0.5"
        style={{ filter: isCurrentTurn ? 'drop-shadow(0 0 6px rgba(34,197,94,0.9))' : 'none' }}>
        {token}
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
        {showMoney && (
          <p className="text-xs font-bold mb-1"
            style={{ color: isCurrentTurn ? 'rgba(74,222,128,0.8)' : 'rgba(212,175,55,0.7)', fontFamily:"'DM Sans',sans-serif" }}>
            ₹{Number(player.money ?? 0).toLocaleString('en-IN')}
          </p>
        )}
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
});

const ActionButton = React.memo(function ActionButton({ label, onClick, disabled, variant = 'primary', loading = false }) {
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
});

const Toast = React.memo(function Toast({ message, type = 'error', onClose }) {
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
});

const QUICK_EMOJIS = ['🎲', '🏠', '💰', '💸', '🔒', '🤝', '☠️', '🎉', '🔥', '👏'];

// A function that parses text and replaces @Username with high-end gold badge
const formatMentions = (text, players = []) => {
  if (!text) return '';
  
  const tokens = text.split(/(\s+)/);
  return tokens.map((token, idx) => {
    if (token.startsWith('@')) {
      const candidate = token.slice(1);
      // Clean candidate of ending punctuation
      const cleanCandidate = candidate.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const matchedPlayer = players.find(p => p.username.toLowerCase() === cleanCandidate.toLowerCase());
      
      if (matchedPlayer) {
        const punctuation = candidate.slice(cleanCandidate.length);
        return (
          <span key={idx} className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide select-all animate-fade-in"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(245,158,11,0.1) 100%)',
                  color: '#fde68a',
                  border: '1.5px solid rgba(212,175,55,0.45)',
                  textShadow: '0 0 4px rgba(245,158,11,0.3)',
                  margin: '0 2px'
                }}>
            @{cleanCandidate}
            {punctuation}
          </span>
        );
      }
    }
    return token;
  });
};

// ── Chat bubble ───────────────────────────────────────────────────────────────
const ChatBubble = React.memo(function ChatBubble({ msg, isMe, players = [] }) {
  if (msg.playerId === 'system' || msg.isSystem) {
    return (
      <div className="w-full my-1 flex justify-center animate-fade-in">
        <div className="px-4 py-2 rounded-xl text-xs text-center border border-dashed"
             style={{
               background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(245,158,11,0.02) 100%)',
               borderColor: 'rgba(212,175,55,0.25)',
               color: '#fde68a',
               maxWidth: '92%',
               fontFamily: "'DM Sans', sans-serif",
               boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
               lineHeight: '1.4'
             }}>
          {msg.text}
        </div>
      </div>
    );
  }

  const isAudio = msg.text && msg.text.startsWith('data:audio/');
  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}>
      <span className="text-[10px]" style={{ color:'rgba(156,163,175,0.55)',
                                          fontFamily:"'DM Sans',sans-serif" }}>
        {msg.username}
      </span>
      {isAudio ? (
        <div className="rounded-xl overflow-hidden"
             style={{
               background: isMe ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
               border: isMe ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.08)',
               padding: '6px 10px',
               width: '100%',
               maxWidth: 200,
             }}>
          <audio src={msg.text} controls style={{ width: '100%', height: 28, filter: 'invert(1) hue-rotate(180deg)' }} />
        </div>
      ) : (
        <div className="text-xs px-2.5 py-1.5 rounded-xl max-w-[85%] break-words"
             style={{ background: isMe ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                      color: isMe ? '#fde68a' : '#d1d5db',
                      border: isMe ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily:"'DM Sans',sans-serif",
                      lineHeight: '1.4' }}>
          {formatMentions(msg.text, players)}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function GameRoom() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();
  // Resolve playerId from localStorage if not in sessionStorage (e.g. copied direct link)
  let resolvedId = stored('mi_playerId');
  if (!resolvedId) {
    try {
      const storedUser = localStorage.getItem('mi_google_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.playerId) {
          resolvedId = parsed.playerId;
          sessionStorage.setItem('mi_playerId', resolvedId);
          sessionStorage.setItem('mi_username', parsed.username || '');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  const myId         = resolvedId;

  const [gameState,     setGameState]     = useState(null);
  const [muted,         setMuted]         = useState(getMuteStatus());
  const [room,          setRoom]          = useState(null);
  const [chatMessages,  setChatMessages]  = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [systemAlert,  setSystemAlert]   = useState('');
  
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [hasDismissedBankruptcy, setHasDismissedBankruptcy] = useState(false);
  
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showRuleBook, setShowRuleBook] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab,     setActiveTab]     = useState('none'); // 'none' | 'lobby' | 'chat' | 'properties'
  
  // Juiciness and visual animation states
  const [showTurnSplash, setShowTurnSplash] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [flyingCoins, setFlyingCoins] = useState([]);
  const [flyingDeed, setFlyingDeed] = useState(null);
  const [rentFloaters, setRentFloaters] = useState([]);
  const prevIsMyTurnRef = useRef(false);

  // Auto trigger onboarding tutorial on first-time entry
  useEffect(() => {
    const isSpectator = sessionStorage.getItem('mi_isSpectator') === 'true';
    const hasCompleted = localStorage.getItem('mi_tutorial_completed') === 'true';
    if (!isSpectator && gameState?.status === 'playing' && !hasCompleted) {
      setShowOnboarding(true);
    }
  }, [gameState?.status]);
  
  // Advanced Chat states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionsDropdown, setShowMentionsDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result;
          try {
            await socketService.sendMessage(base64Data);
          } catch (err) {
            console.error('Failed to send voice message:', err);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecDuration(0);

      timerRef.current = setInterval(() => {
        setRecDuration((prev) => {
          if (prev >= 12) {
            clearInterval(timerRef.current);
            mediaRecorder.stop();
            setIsRecording(false);
            return 12;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Could not access microphone. Please verify browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      clearInterval(timerRef.current);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
        // If spectate parameter is present, bypass player checks and join directly as spectator
        const isForceSpectate = new URLSearchParams(window.location.search).get('spectate') === 'true';
        if (isForceSpectate) {
          const storedUserStr = localStorage.getItem('mi_google_user');
          const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
          const username = storedUser?.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

          try {
            const data = await socketService.joinRoom(roomCode, username, myId, true);
            sessionStorage.setItem('mi_isSpectator', 'true');
            if (data.room) setRoom(data.room);
            const stateData = await socketService.getRoomState();
            if (stateData.room) setRoom(stateData.room);
            if (stateData.gameState) setGameState(stateData.gameState);
            
            try {
              const hist = await socketService.getChatHistory();
              setChatMessages(hist.messages || []);
            } catch { /* no history */ }
            return;
          } catch (specErr) {
            console.error('[GameRoom] Spectate error:', specErr);
            showToast(specErr.message || 'Could not join as spectator', 'error');
            return;
          }
        }

        try {
          const data = await socketService.reconnectRoom(roomCode, myId);
          sessionStorage.setItem('mi_isSpectator', data.isSpectator ? 'true' : 'false');
          if (data.room) setRoom(data.room);
          if (data.gameState) setGameState(data.gameState);
        } catch (err) {
          const isExplicitRejection = err.message?.includes('not found') || err.message?.includes('ended');
          if (!isExplicitRejection) {
            throw err;
          }

          // Player is not in the room yet (copied link join / fresh tab session during play)
          // Since the game is already in progress, join them automatically as a spectator
          const storedUserStr = localStorage.getItem('mi_google_user');
          const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
          const username = storedUser?.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

          try {
            const data = await socketService.joinRoom(roomCode, username, myId, true);
            sessionStorage.setItem('mi_isSpectator', 'true');
            if (data.room) setRoom(data.room);
            // Request room state to fetch gameState
            const stateData = await socketService.getRoomState();
            if (stateData.room) setRoom(stateData.room);
            if (stateData.gameState) setGameState(stateData.gameState);
          } catch (joinErr) {
            throw joinErr;
          }
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

  const handleKickPlayerInGame = useCallback(async (playerId) => {
    const pInRoom = room?.players?.find(p => p.id === playerId);
    const pInState = gameState?.players?.[playerId];
    const isBot = pInRoom?.isBot || pInState?.isBot || pInState?.username?.includes('Bot') || pInState?.username?.includes('🤖') || false;
    
    // Only show confirmation dialog for human players
    if (!isBot) {
      if (!window.confirm('Are you sure you want to kick this player out of the game? All their properties will go back to the market for sale.')) {
        return;
      }
    }
    try {
      await socketService.kickPlayer(playerId);
      showToast('Kicked player from match', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to kick player', 'error');
    }
  }, [room, gameState, showToast]);

  const handleVoteKickHostInitiate = useCallback(async () => {
    if (!window.confirm('Are you sure you want to initiate a vote to kick the host out of the game? All their properties will go back to the market for sale.')) {
      return;
    }
    try {
      await socketService.requestKickHost();
      showToast('Initiated vote to kick host', 'success');
      setShowPlayersModal(false);
    } catch (err) {
      showToast(err.message || 'Failed to initiate kick vote', 'error');
    }
  }, [showToast]);

  const handleVoteKickHostCast = useCallback(async (accept) => {
    try {
      await socketService.voteKickHost(accept);
      showToast(accept ? 'Voted to kick host' : 'Voted to keep host', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to submit vote', 'error');
    }
  }, [showToast]);

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
          playDiceRoll();
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
          const { playerId, from, to, teleport, moveBack } = event.payload;
          // Animate the player's token step-by-step or teleport instantly
          await animateMovement(playerId, from, to, teleport, moveBack);
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
          playCoinSound();
          boardAnimation.setRentInfo({ amount, fromId, toId, partial: partial ?? false });

          // Trigger visual coin flying and rent floater effects
          triggerRentPaidEffects(fromId, toId, amount);

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
          playCoinSound();
          boardAnimation.showToast({ type: 'tax', amount });
          await delay(1500);
          break;
        }

        // ── FREE PARKING ──
        case 'FREE_PARKING_COLLECT': {
          const { amount } = event.payload;
          playCoinSound();
          boardAnimation.showToast({ type: 'collect', amount });
          await delay(1500);
          break;
        }

        // ── PASSED GO ──
        case 'PASSED_GO': {
          const { amount } = event.payload;
          playCoinSound();
          boardAnimation.showToast({ type: 'go', amount });
          await delay(1500);
          break;
        }

        // ── PROPERTY BOUGHT ──
        case 'PROPERTY_BOUGHT': {
          const { tileId, price } = event.payload;
          playCoinSound();
          boardAnimation.flashProperty(tileId);
          boardAnimation.setPendingPurchase(null);
          boardAnimation.showToast({ type: 'buy', amount: price, tileId });
          
          // Trigger visual confetti and flying deed card effects
          triggerBoughtEffects(tileId);

          await delay(1000);
          break;
        }

        // ── HOUSE / HOTEL BUILT ──
        case 'HOUSE_BUILT':
        case 'HOTEL_BUILT': {
          const { tileId, houses, hotel } = event.payload;
          playCoinSound();
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
        case 'TRADE_INITIATED':
        case 'TRADE_COUNTERED': {
          playTradeSound();
          boardAnimation.setActiveTrade(event.payload);
          break;
        }
        case 'TRADE_COMPLETED': {
          playWinnerSound();
          boardAnimation.setActiveTrade(null);
          boardAnimation.showToast({ type: 'trade', message: 'Trade completed!' });
          break;
        }
        case 'TRADE_REJECTED':
        case 'TRADE_CANCELLED': {
          playBankruptcySound();
          boardAnimation.setActiveTrade(null);
          break;
        }

        // ── AUCTION STARTED ──
        case 'AUCTION_STARTED': {
          boardAnimation.showToast({ type: 'auction', tileId: event.payload.tileId });
          boardAnimation.setPendingPurchase(null);
          break;
        }

        // ── BANK REPOSSESSION ──
        case 'BANK_REPOSSESSION': {
          const { tileId } = event.payload;
          const tile = TILE_BY_ID[tileId];
          boardAnimation.flashProperty(tileId);
          boardAnimation.showToast({ type: 'repossession', tileId, tileName: tile?.name });
          await delay(2500);
          break;
        }

        // ── PROPERTY MORTGAGED ──
        case 'PROPERTY_MORTGAGED': {
          const { tileId, amount } = event.payload;
          const tile = TILE_BY_ID[tileId];
          playCoinSound();
          boardAnimation.flashProperty(tileId);
          boardAnimation.showToast({ type: 'mortgage', tileId, tileName: tile?.name, amount });
          await delay(2000);
          break;
        }

        // ── JAIL EVENTS ──
        case 'SENT_TO_JAIL':
        case 'TRIPLE_DOUBLES_JAIL': {
          playJailSound();
          break;
        }

        // ── BANKRUPTCY ──
        case 'PLAYER_BANKRUPTED': {
          playBankruptcySound();
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

    const onRoomUpdated       = ({ data }) => {
      if (data?.room) setRoom(data.room);
    };
    const onPlayerDisconnected = ({ data }) => {
      if (!data) return;
      pushFeedEvent(`${data.username} disconnected`, '⚡');
      showToast(`${data.username} disconnected`, 'warning');
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: false } : p) };
      });
    };
    const onPlayerReconnected = ({ data }) => {
      if (!data) return;
      pushFeedEvent(`${data.username} reconnected`, '✅');
      showToast(`${data.username} reconnected!`, 'success');
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: true } : p) };
      });
    };
    const onReceiveMessage    = ({ data }) => {
      if (data?.message) setChatMessages(prev => [...prev, data.message]);
    };
    const onGameOver          = ({ data }) => {
      const winner = data?.username ?? 'Someone';
      playWinnerSound();
      pushFeedEvent(`Game Over! ${winner} wins! 🏆`, '🎉');
      setTimeout(() => { alert(`🏆 ${winner} wins Monopoly India!`); navigate('/'); }, 800);
    };
    const onKicked            = () => {
      sessionStorage.clear();
      navigate('/');
    };
    const onRoomDestroyed     = () => {
      sessionStorage.clear();
      navigate('/');
    };
    const onSystemAlert       = (data) => {
      if (data && data.message) {
        setSystemAlert(data.message);
      }
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

    const onConnect = () => {
      console.log('[GameRoom] Socket connected/reconnected, restoring match state...');
      let attempts = 0;
      const attemptReconnect = () => {
        if (!socket.connected) return;
        socketService.reconnectRoom(roomCode, myId)
          .then((data) => {
            sessionStorage.setItem('mi_isSpectator', data.isSpectator ? 'true' : 'false');
            if (data.room) setRoom(data.room);
            if (data.gameState) {
              setGameState(data.gameState);
              showToast('Connection restored successfully!', 'success');
            }
          })
          .catch((err) => {
            console.error(`[GameRoom] Reconnection attempt #${attempts} failed:`, err.message);
            const isExplicitRejection = err.message?.includes('not found') || err.message?.includes('ended');
            if (isExplicitRejection) {
              showToast(err.message, 'error');
              return;
            }
            attempts++;
            if (attempts < 5 && socket.connected) {
              setTimeout(attemptReconnect, 2000);
            } else {
              showToast('Reconnection failed. Please check your network or refresh the page.', 'error');
            }
          });
      };
      attemptReconnect();
    };

    socket.on('connect',            onConnect);
    socket.on('game-updated',        onGameUpdated);
    socket.on('game-events',         onGameEvents);
    socket.on('room-updated',        onRoomUpdated);
    socket.on('player-disconnected', onPlayerDisconnected);
    socket.on('player-reconnected',  onPlayerReconnected);
    socket.on('receive-message',     onReceiveMessage);
    socket.on('game-over',           onGameOver);
    socket.on('kicked',              onKicked);
    socket.on('room-destroyed',     onRoomDestroyed);
    socket.on('system-alert',       onSystemAlert);
    socket.on('loan-approved',       onLoanApproved);
    socket.on('loan-rejected',       onLoanRejected);
    socket.on('loan-repayment-due',  onLoanRepaymentDue);
    socket.on('loan-repaid',         onLoanRepaid);
    return () => {
      socket.off('connect',            onConnect);
      socket.off('game-updated',        onGameUpdated);
      socket.off('game-events',         onGameEvents);
      socket.off('room-updated',        onRoomUpdated);
      socket.off('player-disconnected', onPlayerDisconnected);
      socket.off('player-reconnected',  onPlayerReconnected);
      socket.off('receive-message',     onReceiveMessage);
      socket.off('game-over',           onGameOver);
      socket.off('kicked',              onKicked);
      socket.off('room-destroyed',     onRoomDestroyed);
      socket.off('system-alert',       onSystemAlert);
      socket.off('loan-approved',       onLoanApproved);
      socket.off('loan-rejected',       onLoanRejected);
      socket.off('loan-repayment-due',  onLoanRepaymentDue);
      socket.off('loan-repaid',         onLoanRepaid);
    };
  }, [navigate, pushFeedEvent, showToast, runSequencer, roomCode, myId]);


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

  const handleMortgage = useCallback((tileId) =>
    doAction(`mortgage${tileId}`, () => socketService.mortgageProperty(tileId), 'Mortgage Property'), [doAction]);
  const handleUnmortgage = useCallback((tileId) =>
    doAction(`unmortgage${tileId}`, () => socketService.unmortgageProperty(tileId), 'Unmortgage Property'), [doAction]);

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
  const handleCounterTrade  = useCallback((offer, request) =>
    socketService.counterTrade(offer, request), []);
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
  const players = gameState
    ? Object.values(gameState.players).map(p => {
        const roomPlayer = room?.players?.find(rp => rp.id === p.id);
        return {
          ...p,
          isConnected: roomPlayer ? roomPlayer.connected : true,
          autoplay: roomPlayer ? roomPlayer.autoplay : false,
        };
      })
    : [];
  const spectators      = room?.spectators ?? [];
  const filteredPlayers = players.filter(p =>
    p.id !== myId &&
    p.username.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleChatInputChange = (val) => {
    setChatInput(val);
    const lastWord = val.split(' ').pop();
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.slice(1));
      setShowMentionsDropdown(true);
    } else {
      setShowMentionsDropdown(false);
    }
  };

  const selectMention = (p) => {
    const words = chatInput.split(' ');
    words.pop();
    words.push(`@${p.username} `);
    setChatInput(words.join(' '));
    setShowMentionsDropdown(false);
  };
  const currentPlayerId = gameState?.currentPlayerId;
  const isMyTurn        = currentPlayerId === myId;
  const isHost          = room?.hostId === myId;
  const me              = players.find(p => p.id === myId);
  const hasRolled       = gameState?.hasRolled ?? false;
  const canRoll         = isMyTurn && !hasRolled && !me?.isBankrupt;
  const canEnd          = isMyTurn && hasRolled;
  const canPayJail      = isMyTurn && (me?.inJail ?? false);

  // Turn Splash Trigger Effect
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current) {
      setShowTurnSplash(true);
      const timer = setTimeout(() => setShowTurnSplash(false), 2000);
      return () => clearTimeout(timer);
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // Redirect back to lobby if room status is lobby
  useEffect(() => {
    if (room && room.status === 'lobby') {
      navigate(`/lobby/${roomCode}`);
    }
  }, [room, roomCode, navigate]);

  const handleToggleAutoplay = useCallback(async () => {
    if (!me) return;
    const nextVal = !me.autoplay;
    try {
      await socketService.toggleAutoplay(nextVal);
      showToast(nextVal ? 'AI Autoplay enabled!' : 'AI Autoplay disabled.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to toggle autoplay', 'error');
    }
  }, [me, showToast]);

  // Helper: Get player card center for flying elements
  const getCardCenter = useCallback((playerId) => {
    const isMobile = window.innerWidth < 1024;
    let el = document.getElementById(isMobile ? `player-card-mobile-${playerId}` : `player-card-${playerId}`);
    if (!el) {
      el = document.getElementById(`player-card-${playerId}`) || document.getElementById(`player-card-mobile-${playerId}`);
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  // Helper: Trigger property bought confetti and flying deed card
  const triggerBoughtEffects = useCallback((tileId) => {
    // Spawn confetti from center
    const newConfetti = [];
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#f43f5e', '#fbbf24', '#34d399'];
    for (let i = 0; i < 40; i++) {
      const cx = (Math.random() - 0.5) * 450;
      const cy = -Math.random() * 300 - 50;
      const crot = (Math.random() - 0.5) * 720;
      const size = Math.random() * 8 + 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const delay = Math.random() * 0.4;
      newConfetti.push({ id: Date.now() + i, cx, cy, crot, size, color, delay });
    }
    setConfetti(newConfetti);
    setTimeout(() => setConfetti([]), 2500);

    // Spawn flying deed card
    setFlyingDeed({ tileId });
    setTimeout(() => setFlyingDeed(null), 2000);
  }, []);

  // Helper: Trigger rent flying coins and green floating label
  const triggerRentPaidEffects = useCallback((fromId, toId, amount) => {
    const start = getCardCenter(fromId);
    const end = getCardCenter(toId);

    // Spawn flying gold coins
    const coins = [];
    for (let i = 0; i < 12; i++) {
      const delay = i * 0.08;
      coins.push({
        id: Date.now() + i,
        startX: start.x,
        startY: start.y,
        dx: end.x - start.x,
        dy: end.y - start.y,
        delay,
      });
    }
    setFlyingCoins(coins);
    setTimeout(() => setFlyingCoins([]), 2000);

    // Spawn rent floating label at receiver's card position
    const floater = {
      id: Date.now(),
      x: end.x,
      y: end.y - 25,
      amount,
    };
    setRentFloaters(prev => [...prev, floater]);
    setTimeout(() => {
      setRentFloaters(prev => prev.filter(f => f.id !== floater.id));
    }, 2200);
  }, [getCardCenter]);

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

  // Memoized player roster list for sidebar
  const sidebarPlayerRoster = useMemo(() => {
    if (players.length === 0) {
      return <p className="text-xs" style={{ color:'rgba(156,163,175,0.3)' }}>No players found</p>;
    }
    const isViewerSpectator = sessionStorage.getItem('mi_isSpectator') === 'true';
    return players.map((p, i) => (
      <PlayerCard 
        key={p.id} 
        player={p} 
        index={i}
        isCurrentTurn={p.id === currentPlayerId} 
        isMe={p.id === myId}
        isViewerSpectator={isViewerSpectator} 
      />
    ));
  }, [players, currentPlayerId, myId]);

  // Memoized player roster list for mobile tabs
  const mobilePlayerRoster = useMemo(() => {
    const isViewerSpectator = sessionStorage.getItem('mi_isSpectator') === 'true';
    return players.map((p, i) => (
      <PlayerCard 
        key={p.id} 
        player={p} 
        index={i} 
        isCurrentTurn={p.id === currentPlayerId} 
        isMe={p.id === myId}
        isViewerSpectator={isViewerSpectator} 
      />
    ));
  }, [players, currentPlayerId, myId]);

  // Memoized mobile scroll cards
  const mobileScrollCards = useMemo(() => {
    return players.map((p, idx) => {
      const isCurrent = p.id === currentPlayerId;
      const isMe = p.id === myId;
      const token = p.token || PLAYER_TOKENS[idx % PLAYER_TOKENS.length];
      return (
        <div
          key={p.id}
          id={`player-card-mobile-${p.id}`}
          onClick={() => setShowPlayersModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 transition-all border cursor-pointer active:scale-95 hover:border-yellow-500/50"
          style={{
            borderColor: isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.06)',
            background: isCurrent ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
            color: isCurrent ? '#fbbf24' : '#d1d5db'
          }}
        >
          <span>{token}</span>
          <span className="truncate max-w-[80px]">{p.username}</span>
          <span className="opacity-80">₹{Number(p.money ?? 0).toLocaleString('en-IN')}</span>
          {isMe && <span className="text-[7px] px-1 py-0.2 rounded bg-yellow-500/15 text-yellow-500 font-bold uppercase ml-0.5">You</span>}
          {p.isBankrupt && <span className="text-[7px] px-1 py-0.2 rounded bg-red-500/15 text-red-500 font-bold uppercase ml-0.5">☠</span>}
        </div>
      );
    });
  }, [players, currentPlayerId, myId]);

  // Memoized chat list for sidebar
  const sidebarChatMessages = useMemo(() => {
    if (chatMessages.length === 0) {
      return <p className="text-xs text-center mt-4" style={{ color:'rgba(156,163,175,0.25)' }}>No messages yet</p>;
    }
    return chatMessages.map((msg) => (
      <ChatBubble key={msg.id} msg={msg} isMe={msg.playerId === myId} players={players} />
    ));
  }, [chatMessages, myId, players]);

  // Memoized chat list for mobile tabs
  const mobileChatMessages = useMemo(() => {
    if (chatMessages.length === 0) {
      return <p className="text-xs text-center mt-4" style={{ color: 'rgba(156,163,175,0.25)' }}>No messages yet</p>;
    }
    return chatMessages.map((msg) => (
      <ChatBubble key={msg.id} msg={msg} isMe={msg.playerId === myId} players={players} />
    ));
  }, [chatMessages, myId, players]);

  // Memoized MonopolyBoard to block rendering of the entire board grid when unrelated state updates
  const memoizedBoard = useMemo(() => {
    return (
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
        showTradeModal={showTradeModal}
        setShowTradeModal={setShowTradeModal}
        showBuildPanel={showBuildPanel}
        setShowBuildPanel={setShowBuildPanel}
        showLoanModal={showLoanModal}
        setShowLoanModal={setShowLoanModal}
        pendingCardDraw={boardAnimation.pendingCardDraw}
        activeCard={boardAnimation.activeCard}
        onDeckClick={handleDeckClick}
        onDismissCard={handleDismissCard}
        pendingPurchase={boardAnimation.pendingPurchase}
        onDismissPurchase={boardAnimation.dismissPurchase}
        rentInfo={boardAnimation.rentInfo}
        onDismissRent={handleDismissRent}
        activeTrade={boardAnimation.activeTrade}
        onInitiateTrade={handleInitiateTrade}
        onCounterTrade={handleCounterTrade}
        onAcceptTrade={handleAcceptTrade}
        onRejectTrade={handleRejectTrade}
        onCancelTrade={handleCancelTrade}
        onBuildHouse={handleBuildHouse}
        onBuildHotel={handleBuildHotel}
        onSellHouse={handleSellHouse}
        onSellHotel={handleSellHotel}
        onPlaceBid={handlePlaceBid}
        onPassAuction={handlePassAuction}
        onAuctionProperty={handleAuctionProperty}
        onTakeLoan={handleTakeLoan}
        onRepayLoan={handleRepayLoan}
        onDeclareBankruptcy={handleDeclareBankruptcy}
        activeToast={boardAnimation.activeToast}
        flashTile={boardAnimation.flashTile}
        displayPositions={displayPositions}
        arrivingPlayers={arrivingPlayers}
        teleportingPlayers={teleportingPlayers}
      />
    );
  }, [
    gameState,
    myId,
    isMyTurn,
    hasRolled,
    dicePhase,
    displayDice,
    handleRollDice,
    handleBuyProp,
    handleEndTurn,
    showTradeModal,
    showBuildPanel,
    showLoanModal,
    boardAnimation.pendingCardDraw,
    boardAnimation.activeCard,
    handleDeckClick,
    handleDismissCard,
    boardAnimation.pendingPurchase,
    boardAnimation.dismissPurchase,
    boardAnimation.rentInfo,
    handleDismissRent,
    boardAnimation.activeTrade,
    handleInitiateTrade,
    handleCounterTrade,
    handleAcceptTrade,
    handleRejectTrade,
    handleCancelTrade,
    handleBuildHouse,
    handleBuildHotel,
    handleSellHouse,
    handleSellHotel,
    handlePlaceBid,
    handlePassAuction,
    handleAuctionProperty,
    handleTakeLoan,
    handleRepayLoan,
    handleDeclareBankruptcy,
    boardAnimation.activeToast,
    boardAnimation.flashTile,
    displayPositions,
    arrivingPlayers,
    teleportingPlayers
  ]);

  // Keyboard Navigation / Hotkeys (Space to roll, B to buy, E to end turn)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
        return;
      }

      if (e.key === ' ') {
        if (canRoll) {
          e.preventDefault();
          handleRollDice();
        }
      } else if (e.key?.toLowerCase() === 'b') {
        const isPurchasePending = !!boardAnimation.pendingPurchase;
        if (isMyTurn && isPurchasePending) {
          e.preventDefault();
          handleBuyProp();
          boardAnimation.dismissPurchase?.();
        }
      } else if (e.key?.toLowerCase() === 'e') {
        const isPurchasePending = !!boardAnimation.pendingPurchase;
        if (isMyTurn) {
          if (isPurchasePending) {
            e.preventDefault();
            handleEndTurn();
            boardAnimation.dismissPurchase?.();
          } else if (canEnd) {
            e.preventDefault();
            handleEndTurn();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRoll, isMyTurn, canEnd, boardAnimation.pendingPurchase, boardAnimation.dismissPurchase, handleRollDice, handleBuyProp, handleEndTurn]);

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
    <div className="h-screen h-[100dvh] flex flex-col overflow-hidden"
      style={{ background:'#080604', fontFamily:"'DM Sans',sans-serif", color:'#f3f4f6', height: '100vh', maxHeight: '100vh' }}>

      {systemAlert && (
        <div className="w-full py-2 px-4 text-center text-[10px] font-black uppercase tracking-widest relative z-50 flex items-center justify-center gap-1.5 transition-all duration-300 flex-shrink-0"
             style={{
               background: 'linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)',
               borderBottom: '1px solid #fde68a',
               color: '#fde68a',
               boxShadow: '0 4px 12px rgba(217,119,6,0.35)',
               textShadow: '0 1px 1px rgba(0,0,0,0.6)'
             }}>
          <span>📢 SYSTEM ALERT: {systemAlert}</span>
          <button 
            onClick={() => setSystemAlert('')}
            className="ml-2.5 hover:scale-110 active:scale-95 transition-all text-[10px] font-black cursor-pointer text-amber-100 hover:text-white bg-black/10 hover:bg-black/20 w-4.5 h-4.5 rounded-full flex items-center justify-center"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.18); border-radius: 4px }

        @keyframes confettiFall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate3d(var(--cx), var(--cy), 0) rotate(var(--crot)) scale(0.4); opacity: 0; }
        }
        
        :root {
          --board-height: min(100vw - 16px, 52vh);
          --board-width: min(100vw - 16px, 52vh);
          --board-padding: 6px;
          --deck-width: 135px;
          --deck-height: 175px;
          --deck-bottom-offset: 32px;
          --deck-stack-height: 120px;
          --deck-top-card-height: 122px;
          --deck-icon-size: 36px;
          --deck-label-size: 12px;
          --deck-bottom-label-size: 10px;
          --deck-gap: 6px;
          --deck-top: 12%;
          --deck-right: 12%;
          --deck-bottom: 12%;
          --deck-left: 12%;
          --tile-name-vertical: 9.5px;
          --tile-name-horizontal-2line: 9px;
          --tile-name-horizontal-1line: 10.5px;
          --tile-price-size: 14px;
          --tile-price-strip-size: 12px;
          --tile-icon-prop-size: 14px;
          --tile-icon-other-size: 18px;
          --tile-house-size: 8px;
          --tile-hotel-size: 10px;
          --corner-icon-size: 34px;
          --corner-icon-start-size: 38px;
          --corner-icon-margin: 8px;
          --corner-label-size: 16px;
          --corner-sub-size: 11px;
          --corner-sub-margin: 4px;
          --token-size: 28px;
          --token-font-size: 15px;
          --board-title-size: 16px;
          --die-size: 80px;
          --die-border-radius: 16px;
          --dice-arena-gap: 12px;
          --die-font-size: 14px;
          --die-button-padding: 10px 22px;
          --die-button-font: 13px;
          --center-toast-font-size: 11px;
          --center-toast-padding: 7px 16px;
        }
        
        @media (min-width: 1024px) {
          :root {
            --board-width: min(100vw - 580px, 100vh - 65px);
            --board-height: min(100vw - 580px, 100vh - 65px);
          }
        }

        @media (max-width: 768px) {
          :root {
            --board-width: min(100vw - 4px, 80vh);
            --board-height: min(100vw - 4px, 80vh);
            --board-padding: 2px;
            --deck-width: 48px;
            --deck-height: 64px;
            --deck-bottom-offset: 8px;
            --deck-stack-height: 42px;
            --deck-top-card-height: 44px;
            --deck-icon-size: 12.5px;
            --deck-label-size: 6px;
            --deck-bottom-label-size: 5px;
            --deck-gap: 1.5px;
            --deck-top: 10%;
            --deck-right: 10%;
            --deck-bottom: 10%;
            --deck-left: 10%;
            --tile-name-vertical: 7.5px;
            --tile-name-horizontal-2line: 7px;
            --tile-name-horizontal-1line: 8px;
            --tile-price-size: 9px;
            --tile-price-strip-size: 8px;
            --tile-icon-prop-size: 10px;
            --tile-icon-other-size: 12px;
            --tile-house-size: 5px;
            --tile-hotel-size: 6px;
            --corner-icon-size: 18px;
            --corner-icon-start-size: 20px;
            --corner-icon-margin: 2px;
            --corner-label-size: 9px;
            --corner-sub-size: 6.5px;
            --corner-sub-margin: 1px;
            --token-size: 18px;
            --token-font-size: 10px;
            --board-title-size: 10px;
            --die-size: 46px;
            --die-border-radius: 9px;
            --dice-arena-gap: 6px;
            --die-font-size: 10px;
            --die-button-padding: 5px 12px;
            --die-button-font: 9.5px;
            --center-toast-font-size: 8.5px;
            --center-toast-padding: 4px 10px;
          }
        }
      `}</style>

      {/* Turn Splash Overlays */}
      {showTurnSplash && (
        <div className="animate-turnOverlay" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {/* Top Gold Accent Line */}
          <div className="animate-turnLine" style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #ffe082 30%, #fbbf24 50%, #ffe082 70%, transparent)',
            boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)',
            marginBottom: '24px',
          }} />

          {/* Text Container */}
          <div className="animate-turnText" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}>
            {/* Sub-label */}
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              color: '#fbbf24',
              opacity: 0.9,
              marginBottom: '8px',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Your Move
            </span>

            {/* Main title */}
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '44px',
              lineHeight: '1.2',
              fontWeight: '800',
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, #ffffff 0%, #ffe082 50%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
              margin: '0 0 8px 0',
            }}>
              It's Your Turn
            </h1>
          </div>

          {/* Bottom Gold Accent Line */}
          <div className="animate-turnLine" style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #ffe082 30%, #fbbf24 50%, #ffe082 70%, transparent)',
            boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)',
            marginTop: '24px',
          }} />
        </div>
      )}

      {/* Confetti Container */}
      {confetti.map(c => (
        <div
          key={c.id}
          style={{
            position: 'fixed',
            left: '50%',
            top: '45%',
            width: `${c.size}px`,
            height: `${c.size * 1.5}px`,
            background: c.color,
            borderRadius: '2px',
            zIndex: 180,
            pointerEvents: 'none',
            '--cx': `${c.cx}px`,
            '--cy': `${c.cy}px`,
            '--crot': `${c.crot}deg`,
            animation: `confettiFall 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            animationDelay: `${c.delay}s`,
            transformOrigin: 'center',
          }}
        />
      ))}

      {/* Flying Deed Container */}
      {flyingDeed && (
        <div
          className="animate-deedFly"
          style={{
            position: 'fixed',
            width: '130px',
            height: '170px',
            background: '#140c06',
            border: '3px solid #fbbf24',
            borderRadius: '14px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9), inset 0 0 15px rgba(251,191,36,0.1)',
            zIndex: 150,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px',
            '--deed-dest-x': window.innerWidth < 1024 ? '80vw' : '90vw',
            '--deed-dest-y': window.innerWidth < 1024 ? '95vh' : '75vh',
          }}
        >
          <div style={{
            height: '28px',
            background: TILE_BY_ID[flyingDeed.tileId]?.group ? COLOR_GROUP_META[TILE_BY_ID[flyingDeed.tileId].group]?.hex : '#4b5563',
            borderRadius: '6px',
            marginBottom: '8px',
          }} />
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            {TILE_BY_ID[flyingDeed.tileId]?.name}
          </span>
          <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, textAlign: 'center', marginTop: 'auto', fontFamily: "'DM Sans', sans-serif" }}>
            ₹{TILE_BY_ID[flyingDeed.tileId]?.price}
          </span>
        </div>
      )}

      {/* Flying Coins Container */}
      {flyingCoins.map(coin => (
        <div
          key={coin.id}
          className="animate-coinFly"
          style={{
            position: 'fixed',
            left: `${coin.startX}px`,
            top: `${coin.startY}px`,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #ffe082 0%, #f59e0b 60%, #b45309 100%)',
            border: '1px solid #fbbf24',
            boxShadow: '0 4px 10px rgba(245,158,11,0.5)',
            zIndex: 180,
            pointerEvents: 'none',
            '--dx': `${coin.dx}px`,
            '--dy': `${coin.dy}px`,
            animationDelay: `${coin.delay}s`,
          }}
        />
      ))}

      {/* Rent Floaters Container */}
      {rentFloaters.map(f => (
        <div
          key={f.id}
          className="animate-rentFloat"
          style={{
            position: 'fixed',
            left: `${f.x}px`,
            top: `${f.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 185,
            pointerEvents: 'none',
            fontSize: '14px',
            fontWeight: 900,
            color: '#22c55e',
            textShadow: '0 0 10px rgba(34,197,94,0.8), 0 2px 4px rgba(0,0,0,0.8)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          +₹{Number(f.amount).toLocaleString('en-IN')}
        </div>
      ))}

      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-1.5 md:py-2.5 flex-shrink-0"
        style={{ background:'rgba(0,0,0,0.65)', borderBottom:'1px solid rgba(212,175,55,0.1)', backdropFilter:'blur(12px)' }}>
        <span className="font-black text-sm md:text-base"
          style={{ fontFamily:"'Playfair Display',serif", background:'linear-gradient(135deg,#d4af37,#fde68a,#d97706)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Monopoly <em>India</em>
        </span>
        <div className="flex items-center gap-1.5 md:gap-3">
          {isMyTurn && (
            <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full animate-pulse"
              style={{ background:'rgba(34,197,94,0.18)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.3)' }}>
              Your Turn
            </span>
          )}
          {gameState?.activeAuction && (
            <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full"
              style={{ background:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.3)' }}>
              🔨 Auction
            </span>
          )}
          <button
            onClick={() => setShowOnboarding(true)}
            className="hidden md:inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer mr-2"
            style={{
              background: 'rgba(212,175,55,0.08)',
              color: '#f59e0b',
              border: '1px solid rgba(212,175,55,0.25)',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.14)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
            }}
          >
            🎓 Tutorial
          </button>
          <button
            onClick={() => setShowRuleBook(true)}
            className="hidden md:inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            style={{
              background: 'rgba(212,175,55,0.08)',
              color: '#f59e0b',
              border: '1px solid rgba(212,175,55,0.25)',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.14)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
            }}
          >
            📜 Rules
          </button>
          <button
            onClick={() => setShowPlayersModal(true)}
            className="hidden md:inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            style={{
              background: 'rgba(212,175,55,0.08)',
              color: '#f59e0b',
              border: '1px solid rgba(212,175,55,0.25)',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.14)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
            }}
          >
            👥 Players
          </button>
          <button
            onClick={() => {
              const newMute = toggleMute();
              setMuted(newMute);
            }}
            className="px-2 md:px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
            style={{
              background: muted ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: muted ? '#f87171' : '#4ade80',
              border: muted ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
              fontFamily: "'DM Sans', sans-serif",
            }}
            title={muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <ConnectionStatus />
          {gameState?.status === 'playing' && (
            <>
              <button
                onClick={() => setShowEndGameModal(true)}
                className="hidden md:inline-block"
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
              <button
                onClick={() => setShowEndGameModal(true)}
                className="inline-block md:hidden"
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#fca5a5',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🛑 End
              </button>
            </>
          )}
          <button
            onClick={async () => {
              const lobbyLink = `${window.location.origin}/lobby/${roomCode}`;
              try {
                await navigator.clipboard.writeText(lobbyLink);
                showToast?.('Lobby invite link copied to clipboard!', 'success');
              } catch {
                const el = document.createElement('textarea');
                el.value = lobbyLink;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                showToast?.('Lobby invite link copied to clipboard!', 'success');
              }
            }}
            onCopy={(e) => {
              e.preventDefault();
              e.clipboardData.setData('text/plain', `${window.location.origin}/lobby/${roomCode}`);
              showToast?.('Lobby invite link copied to clipboard!', 'success');
            }}
            title="Click or copy to get lobby invite link"
            className="text-[9px] md:text-[11px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border hover:text-yellow-400 select-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(156,163,175,0.7)',
              fontFamily: "'DM Sans', sans-serif"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
              e.currentTarget.style.color = '#f59e0b';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = 'rgba(156,163,175,0.7)';
            }}
          >
            🔗 {roomCode}
          </button>
        </div>
      </header>

      {/* Mobile compact horizontal player scroll bar */}
      <div className="flex lg:hidden overflow-x-auto gap-2 px-3 py-2 flex-shrink-0 scrollbar-none" 
           style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.2)' }}>
        {mobileScrollCards}
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="hidden lg:flex w-60 flex-col gap-0 flex-shrink-0 overflow-hidden"
          style={{ borderRight:'1px solid rgba(255,255,255,0.05)', background: isMyTurn && me?.money < 0 ? 'rgba(239, 68, 68, 0.01)' : 'transparent' }}>
          {isMyTurn && me?.money < 0 ? (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <ShortfallPanel
                me={me}
                myProperties={myProperties}
                gameState={gameState}
                onMortgage={handleMortgage}
                onUnmortgage={handleUnmortgage}
                onSellHouse={handleSellHouse}
                onSellHotel={handleSellHotel}
                onTakeLoan={handleTakeLoan}
                onDeclareBankruptcy={handleDeclareBankruptcy}
              />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

                <h3 className="text-xs font-bold uppercase tracking-widest"
                  style={{ color:'rgba(212,175,55,0.5)' }}>Players</h3>

                {sidebarPlayerRoster}

                {spectators.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2">
                    <span className="text-[10px] font-black text-amber-500/55 uppercase tracking-widest block text-left">
                      👁️ Spectators ({spectators.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {spectators.map(s => (
                        <span key={s.id} className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1"
                              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(212,175,55,0.15)', color: '#9ca3af' }}>
                          👁️ {s.username} {s.connected === false && <span className="text-[8px] text-gray-500 font-bold">(off)</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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

                {/* AI Autoplay Toggle Card */}
                {sessionStorage.getItem('mi_isSpectator') !== 'true' && me && (
                  <div className="mt-1 p-2.5 rounded-xl flex items-center justify-between transition-all duration-300"
                       style={{
                         background: me.autoplay ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                         border: me.autoplay ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.05)',
                       }}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                        🤖 AI Autoplay
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5 leading-tight">
                        Let bot take your turns
                      </span>
                    </div>
                    <button
                      onClick={handleToggleAutoplay}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 cursor-pointer outline-none focus:outline-none"
                      style={{
                        background: me.autoplay ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <span
                        className={`${
                          me.autoplay ? 'translate-x-5' : 'translate-x-1'
                        } inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300`}
                      />
                    </button>
                  </div>
                )}

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
            </>
          )}
        </aside>

        {/* Board */}
        <main className="w-full h-auto lg:h-auto lg:flex-1 flex-shrink-0 flex items-center justify-center p-1 lg:py-2 lg:px-4 lg:overflow-hidden mx-auto" 
              style={{ position:'relative', minWidth:0, width: 'var(--board-width, 100%)', height: 'var(--board-height, auto)' }}>
          {memoizedBoard}


        </main>

        {/* Right: Chat & My Properties */}
        <aside className="hidden lg:flex flex-col flex-shrink-0"
          style={{ width: '280px', borderLeft:'1px solid rgba(255,255,255,0.05)', height: '100%' }}>
          
          {/* Chat Container */}
          <div className="flex flex-col" style={{ height: '55%', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="px-3 py-2 flex-shrink-0"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest"
                style={{ color:'rgba(156,163,175,0.4)' }}>Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-3">
              {sidebarChatMessages}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 flex gap-2 flex-shrink-0 relative"
              style={{ borderTop:'1px solid rgba(255,255,255,0.05)', alignItems: 'center', position: 'relative' }}>
              {/* Mentions Suggestions Dropdown */}
              {showMentionsDropdown && filteredPlayers.length > 0 && (
                <div className="absolute bottom-12 left-0 right-0 p-1.5 rounded-xl flex flex-col gap-1 z-30 backdrop-blur-md animate-fade-in"
                     style={{
                       background: 'rgba(15,10,5,0.95)',
                       border: '1.5px solid rgba(212,175,55,0.35)',
                       boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                       maxHeight: '140px',
                       overflowY: 'auto'
                     }}>
                  {filteredPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectMention(p)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors duration-150 cursor-pointer"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      👤 @{p.username}
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji Reaction Drawer */}
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 right-0 p-2 rounded-xl flex gap-2 justify-around z-20 backdrop-blur-md animate-fade-in"
                     style={{
                       background: 'rgba(15,10,5,0.95)',
                       border: '1.5px solid rgba(212,175,55,0.3)',
                       boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                     }}>
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setChatInput(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-base hover:scale-125 transition-transform duration-150 cursor-pointer p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {isRecording ? (
                <div className="flex-grow flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-semibold"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', animation: 'recPulseGame 2s infinite ease-in-out' }}>
                  <style>{`
                    @keyframes recPulseGame {
                      0%, 100% { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
                      50% { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.16); }
                    }
                  `}</style>
                  <span>🔴 Recording: 0:{recDuration.toString().padStart(2, '0')} / 0:12</span>
                  <button onClick={stopRecording}
                          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-[8px] uppercase tracking-wider transition-all">
                    Stop ⏹️
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative flex-1 flex items-center min-w-0">
                    <input
                      value={chatInput}
                      onChange={e => handleChatInputChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChat(); }}
                      placeholder="Type @name..."
                      maxLength={300}
                      className="w-full pl-3 pr-14 py-1.5 rounded-lg text-xs outline-none"
                      style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#f3f4f6', caretColor:'#f59e0b' }}
                    />
                    <div className="absolute right-1 flex items-center gap-0.5">
                      <button
                        onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowMentionsDropdown(false); }}
                        className="p-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-all"
                        style={{ border: 'none', background: 'transparent' }}
                        title="Insert emoji"
                      >
                        😀
                      </button>
                      <button
                        onClick={startRecording}
                        className="p-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-all"
                        style={{ border: 'none', background: 'transparent' }}
                        title="Record voice message"
                      >
                        🎙️
                      </button>
                    </div>
                  </div>
                  <button onClick={handleChat}
                    className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex-shrink-0"
                    style={{ background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.18)' }}>
                    ↑
                  </button>
                </>
              )}
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
            {gameState?.status === 'playing' && (
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

        {/* Mobile Slide-up Bottom Drawer Sheet (only visible on mobile/tablet) */}
        <div 
          className={`flex lg:hidden fixed inset-x-0 bottom-16 bg-[#0f0a05] border-t border-yellow-500/10 rounded-t-2xl z-40 flex-col p-4 gap-3 transition-transform duration-300 ease-out transform ${
            activeTab !== 'none' ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ 
            height: '42vh', 
            boxShadow: '0 -10px 40px rgba(0,0,0,0.85), inset 0 0 20px rgba(212,175,55,0.02)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Drawer Header & Close Button */}
          <div className="flex items-center justify-between pb-1 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs font-black uppercase tracking-wider text-amber-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {activeTab === 'lobby' && '🎮 Match Lobby & Events'}
              {activeTab === 'chat' && '💬 Live Chat'}
              {activeTab === 'properties' && '🏠 Properties & Assets'}
            </span>
            <button 
              onClick={() => setActiveTab('none')}
              className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-all"
            >
              ✕
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-grow overflow-y-auto pr-1">
            {activeTab === 'lobby' && (
              <div className="flex flex-col gap-4 p-1">
                {/* Players cards */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(212,175,55,0.5)' }}>Players</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOnboarding(true)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 transition-all active:scale-95 cursor-pointer mr-1.5"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        🎓 Tutorial
                      </button>
                      <button
                        onClick={() => setShowRuleBook(true)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 transition-all active:scale-95 cursor-pointer"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        📜 Rules
                      </button>
                      <button
                        onClick={() => setShowPlayersModal(true)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 transition-all active:scale-95 cursor-pointer"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        👥 Manage
                      </button>
                      {gameState?.status === 'playing' && (
                        <button
                          onClick={() => setShowEndGameModal(true)}
                          className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/25 transition-all active:scale-95 cursor-pointer"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          🛑 End Game
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {mobilePlayerRoster}
                  </div>
                </div>

                {/* Primary Actions */}
                {sessionStorage.getItem('mi_isSpectator') === 'true' ? (
                  <div className="p-4 rounded-xl text-center border border-dashed border-yellow-500/20 bg-yellow-500/5 flex flex-col items-center justify-center gap-1">
                    <span className="text-xl">👁️</span>
                    <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mt-1">Spectating Match</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-normal max-w-xs">You are watching the live board. Chat with the landlords and enjoy the game!</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(212,175,55,0.5)' }}>
                      {isMyTurn ? '⚡ Actions' : 'Actions'}
                    </h3>
                    <div className="flex gap-2">
                      <div className="flex-grow">
                        <ActionButton label="🎲 Roll Dice" onClick={handleRollDice} disabled={!canRoll} loading={actionLoading === 'roll'} variant="primary" />
                      </div>
                      {canPayJail && (
                        <div className="flex-grow">
                          <ActionButton label="💸 Pay Jail ₹500" onClick={handlePayJail} disabled={!canPayJail} loading={actionLoading === 'jail'} variant="danger" />
                        </div>
                      )}
                      <div className="flex-grow">
                        <ActionButton label="✔ End Turn" onClick={handleEndTurn} disabled={!canEnd} loading={actionLoading === 'end'} variant="secondary" />
                      </div>
                    </div>

                    {/* AI Autoplay Toggle for Mobile (Lobby Tab) */}
                    {me && (
                      <div className="mt-1 p-2 rounded-lg flex items-center justify-between"
                           style={{
                             background: me.autoplay ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                             border: me.autoplay ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.05)',
                           }}>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                            🤖 AI Autoplay
                          </span>
                          <span className="text-[8px] text-gray-500 mt-0.5 leading-tight">
                            Let bot play on your behalf
                          </span>
                        </div>
                        <button
                          onClick={handleToggleAutoplay}
                          className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-300 cursor-pointer outline-none"
                          style={{
                            background: me.autoplay ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <span
                            className={`${
                              me.autoplay ? 'translate-x-3.5' : 'translate-x-0.5'
                            } inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform duration-300`}
                          />
                        </button>
                      </div>
                    )}

                    {!isMyTurn && gameState && (
                      <p className="text-xs text-center mt-1" style={{ color: 'rgba(156,163,175,0.35)' }}>
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
                )}

                {/* Events feed */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(212,175,55,0.5)' }}>Live Events</h3>
                  <div className="flex flex-col gap-1 overflow-y-auto p-2 rounded-xl" style={{ maxHeight: '180px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.02)' }}>
                    {events.length === 0 ? (
                      <p className="text-xs" style={{ color: 'rgba(156,163,175,0.25)' }}>No events yet…</p>
                    ) : (
                      events.slice(-20).map((ev, i) => (
                        <p key={i} className="text-xs leading-snug"
                          style={{
                            color: ev.type === 'system' ? 'rgba(245,158,11,0.6)' : 'rgba(209,213,219,0.55)',
                            fontFamily: "'DM Sans',sans-serif",
                            borderLeft: ev.type === 'system' ? '2px solid rgba(245,158,11,0.3)' : '2px solid rgba(255,255,255,0.06)',
                            paddingLeft: '6px',
                          }}
                        >
                          {ev.message}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-[33vh] p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                {/* Chat Message feed */}
                <div className="flex-grow overflow-y-auto flex flex-col gap-2 p-2">
                  {mobileChatMessages}
                </div>

                {/* Chat Input */}
                <div className="p-2 flex gap-2 flex-shrink-0 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', position: 'relative' }}>
                  {/* Mentions Suggestions Dropdown */}
                  {showMentionsDropdown && filteredPlayers.length > 0 && (
                    <div className="absolute bottom-12 left-0 right-0 p-1.5 rounded-xl flex flex-col gap-1 z-30 backdrop-blur-md animate-fade-in"
                         style={{
                           background: 'rgba(15,10,5,0.95)',
                           border: '1.5px solid rgba(212,175,55,0.35)',
                           boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                           maxHeight: '140px',
                           overflowY: 'auto'
                         }}>
                      {filteredPlayers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectMention(p)}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors duration-150 cursor-pointer"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          👤 @{p.username}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Emoji Reaction Drawer */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 right-0 p-2 rounded-xl flex gap-2 justify-around z-20 backdrop-blur-md animate-fade-in"
                         style={{
                           background: 'rgba(15,10,5,0.95)',
                           border: '1.5px solid rgba(212,175,55,0.3)',
                           boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                         }}>
                      {QUICK_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setChatInput(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="text-base hover:scale-125 transition-transform duration-150 cursor-pointer p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {isRecording ? (
                    <div className="flex-grow flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                         style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                      <span>🔴 Recording: 0:{recDuration.toString().padStart(2, '0')}</span>
                      <button onClick={stopRecording}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-[8px] uppercase tracking-wider transition-all">
                        Stop ⏹️
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative flex-1 flex items-center min-w-0">
                        <input
                          value={chatInput}
                          onChange={e => handleChatInputChange(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleChat(); }}
                          placeholder="Type @name..."
                          maxLength={300}
                          className="w-full pl-3 pr-14 py-1.5 rounded-lg text-xs outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f3f4f6' }}
                        />
                        <div className="absolute right-1 flex items-center gap-0.5">
                          <button
                            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowMentionsDropdown(false); }}
                            className="p-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-all"
                            style={{ border: 'none', background: 'transparent' }}
                            title="Insert emoji"
                          >
                            😀
                          </button>
                          <button
                            onClick={startRecording}
                            className="p-1 text-sm cursor-pointer hover:bg-white/10 rounded transition-all"
                            style={{ border: 'none', background: 'transparent' }}
                            title="Record voice message"
                          >
                            🎙️
                          </button>
                        </div>
                      </div>
                      <button onClick={handleChat}
                        className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.18)' }}>
                        ↑
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'properties' && (
              <div className="flex flex-col gap-3 p-1">
                {/* Asset Action Controls */}
                {gameState?.status === 'playing' && (
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <button
                      onClick={() => setShowTradeModal(true)}
                      className="py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                      style={{
                        background: 'rgba(59,130,246,0.12)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        color: '#93c5fd',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      🤝 Trade
                    </button>
                    <button
                      onClick={() => setShowBuildPanel(true)}
                      className="py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                      style={{
                        background: 'rgba(34,197,94,0.12)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        color: '#4ade80',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      🏠 Build
                    </button>
                    <button
                      onClick={() => setShowLoanModal(true)}
                      disabled={me?.loanActive}
                      className="col-span-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                      style={{
                        background: me?.loanActive ? 'rgba(100,100,100,0.08)' : 'rgba(212,175,55,0.12)',
                        border: me?.loanActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(212,175,55,0.3)',
                        color: me?.loanActive ? '#6b7280' : '#fbf5b7',
                        fontFamily: "'DM Sans',sans-serif",
                        cursor: me?.loanActive ? 'not-allowed' : 'pointer',
                      }}
                    >
                      🏦 Take Loan
                    </button>
                    {me?.loanActive && (
                      <button
                        onClick={handleRepayLoan}
                        className="col-span-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                        style={{
                          background: 'rgba(34,197,94,0.15)',
                          border: '1px solid rgba(34,197,94,0.35)',
                          color: '#4ade80',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        💰 Repay Loan
                      </button>
                    )}
                  </div>
                )}

                {/* My properties list */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(212,175,55,0.5)' }}>My Properties ({myProperties.length})</h3>
                  <div className="flex flex-col gap-2">
                    {myProperties.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'rgba(156,163,175,0.45)' }}>
                        🏠 No properties owned yet. Land on buyable properties to purchase!
                      </p>
                    ) : (
                      myProperties.map(({ id, tile, mortgaged, houses, hotel }) => {
                        const groupColor = tile.group ? (COLOR_GROUP_META[tile.group]?.hex ?? '#9ca3af') : '#4b5563';
                        const currentRent = calculateRent(gameState.properties, gameState.players, id, '', 7);
                        const fmtNum = (val) => Number(val ?? 0).toLocaleString('en-IN');
                        return (
                          <div
                            key={id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: 10,
                              position: 'relative',
                              overflow: 'hidden',
                              opacity: mortgaged ? 0.6 : 1,
                            }}
                          >
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: groupColor }} />
                            <div style={{ fontSize: 14, marginLeft: 4 }}>{tile.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tile.name}
                                </span>
                                {mortgaged && (
                                  <span style={{ fontSize: 7, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', padding: '0 3px', borderRadius: 3 }}>
                                    M
                                  </span>
                                )}
                              </div>
                              {(houses > 0 || hotel) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                                  {hotel ? (
                                    <span style={{ fontSize: 8, color: '#a855f7', fontWeight: 800 }}>🏨 Hotel</span>
                                  ) : (
                                    <span style={{ fontSize: 8, color: '#22c55e', fontWeight: 800 }}>
                                      {'🟢'.repeat(houses)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 7, color: 'rgba(156,163,175,0.4)', textTransform: 'uppercase' }}>Rent</div>
                              <div style={{ fontSize: 10, fontWeight: 800, color: mortgaged ? 'rgba(156,163,175,0.4)' : '#fbbf24' }}>
                                {mortgaged ? '₹0' : `₹${fmtNum(currentRent)}`}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Action Bar */}
      {sessionStorage.getItem('mi_isSpectator') !== 'true' && gameState?.status === 'playing' && activeTab === 'none' && (
        <div className="flex lg:hidden fixed bottom-16 inset-x-0 z-30 justify-around items-center px-3 py-1.5 border-t border-white/5"
             style={{
               background: 'rgba(7, 5, 3, 0.95)',
               backdropFilter: 'blur(8px)',
               height: '48px',
               boxShadow: '0 -4px 12px rgba(0,0,0,0.35)'
             }}>
          {isMyTurn && canRoll && (
            <button
              onClick={handleRollDice}
              disabled={actionLoading === 'roll'}
              className="flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 active:scale-95 transition-all cursor-pointer text-center truncate"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              🎲 Roll
            </button>
          )}
          {isMyTurn && canPayJail && (
            <button
              onClick={handlePayJail}
              disabled={actionLoading === 'jail'}
              className="flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-500 hover:brightness-110 active:scale-95 transition-all cursor-pointer text-center truncate"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              💸 Jail
            </button>
          )}
          {isMyTurn && canEnd && (
            <button
              onClick={handleEndTurn}
              disabled={actionLoading === 'end'}
              className="flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/25 bg-emerald-500/10 active:scale-95 transition-all cursor-pointer text-center truncate"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              ✔ End
            </button>
          )}
          <button
            onClick={() => setShowBuildPanel(p => !p)}
            className={`flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer text-center truncate ${
              showBuildPanel 
                ? 'bg-green-500/15 text-green-400 border border-green-500/30' 
                : 'bg-white/5 text-gray-300 border border-white/10'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            🏠 Build
          </button>
          <button
            onClick={() => setShowTradeModal(true)}
            className="flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 active:scale-95 transition-all cursor-pointer text-center truncate"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            🤝 Trade
          </button>
          <button
            onClick={() => setShowLoanModal(true)}
            disabled={me?.loanActive}
            className="flex-1 mx-0.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-300 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer text-center truncate"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            🏦 Loan
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="flex lg:hidden fixed bottom-0 inset-x-0 h-16 bg-[#070503] border-t border-white/5 z-50 justify-around items-center mobile-safe-bottom"
           style={{
             background: 'linear-gradient(0deg, #070503 0%, #0c0805 100%)',
             backdropFilter: 'blur(10px)',
             boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
           }}>
        <button
          onClick={() => setActiveTab('none')}
          className="flex flex-col items-center justify-center w-16 h-full gap-1 transition-all cursor-pointer bg-transparent border-none"
          style={{ color: activeTab === 'none' ? '#f59e0b' : 'rgba(156,163,175,0.45)' }}
        >
          <span className="text-base">🎲</span>
          <span className="text-[9px] font-extrabold uppercase tracking-wider">Board</span>
        </button>

        <button
          onClick={() => setActiveTab(prev => prev === 'lobby' ? 'none' : 'lobby')}
          className="flex flex-col items-center justify-center w-16 h-full gap-1 transition-all cursor-pointer bg-transparent border-none"
          style={{ color: activeTab === 'lobby' ? '#f59e0b' : 'rgba(156,163,175,0.45)' }}
        >
          <span className="text-base">🎮</span>
          <span className="text-[9px] font-extrabold uppercase tracking-wider">Lobby</span>
        </button>

        <button
          onClick={() => setActiveTab(prev => prev === 'chat' ? 'none' : 'chat')}
          className="flex flex-col items-center justify-center w-16 h-full gap-1 transition-all cursor-pointer relative bg-transparent border-none"
          style={{ color: activeTab === 'chat' ? '#f59e0b' : 'rgba(156,163,175,0.45)' }}
        >
          <span className="text-base">💬</span>
          <span className="text-[9px] font-extrabold uppercase tracking-wider">Chat</span>
          {chatMessages.length > 0 && (
            <span className="absolute top-2.5 right-3 bg-yellow-500 text-black text-[8px] font-black px-1 rounded-full min-w-3.5 h-3.5 flex items-center justify-center">
              {chatMessages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab(prev => prev === 'properties' ? 'none' : 'properties')}
          className="flex flex-col items-center justify-center w-16 h-full gap-1 transition-all cursor-pointer bg-transparent border-none"
          style={{ color: activeTab === 'properties' ? '#f59e0b' : 'rgba(156,163,175,0.45)' }}
        >
          <span className="text-base">🏠</span>
          <span className="text-[9px] font-extrabold uppercase tracking-wider">Assets</span>
        </button>
      </nav>

      {/* Mobile Shortfall Bottom Sheet Drawer */}
      {isMyTurn && me?.money < 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-16 bg-[#0c0805] border-t-2 border-red-500/40 p-4 z-40 overflow-y-auto max-h-[45vh] rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.8)]"
             style={{ background: 'radial-gradient(circle at top left, #120505 0%, #060303 100%)' }}>
          <ShortfallPanel
            me={me}
            myProperties={myProperties}
            gameState={gameState}
            onMortgage={handleMortgage}
            onUnmortgage={handleUnmortgage}
            onSellHouse={handleSellHouse}
            onSellHotel={handleSellHotel}
            onTakeLoan={handleTakeLoan}
            onDeclareBankruptcy={handleDeclareBankruptcy}
            isMobile={true}
          />
        </div>
      )}

      {/* Players Management Modal */}
      {showPlayersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4 animate-scaleIn"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #1e140a 0%, #0c0805 100%)',
              borderColor: 'rgba(212,175,55,0.3)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.1) inset',
            }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: '#f59e0b', fontFamily: "'DM Sans', sans-serif" }}>
                👥 Players List
              </h2>
              <button
                onClick={() => setShowPlayersModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 py-2 overflow-y-auto max-h-[300px]">
              {players.map((p, i) => {
                const token = p.token || PLAYER_TOKENS[i % PLAYER_TOKENS.length];
                const isMe = p.id === myId;
                const showKick = isHost && !isMe && !p.isBankrupt;
                const showVoteKickHost = !isHost && (p.id === room?.hostId) && !p.isBankrupt;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 border"
                    style={{
                      background: isMe ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.02)',
                      borderColor: isMe ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{token}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: isMe ? '#fde68a' : '#f3f4f6' }}>
                          {p.username}
                          {isMe && <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-bold uppercase">You</span>}
                          {p.id === room?.hostId && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold uppercase">Host</span>}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          ₹{Number(p.money ?? 0).toLocaleString('en-IN')} • {p.isBankrupt ? 'Bankrupt' : 'Active'}
                        </span>
                      </div>
                    </div>

                    {showKick && (
                      <button
                        onClick={() => {
                          handleKickPlayerInGame(p.id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/25"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        ❌ Kick
                      </button>
                    )}

                    {showVoteKickHost && (
                      <button
                        onClick={() => {
                          handleVoteKickHostInitiate();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/25"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        ⚠️ Vote Kick
                      </button>
                    )}
                  </div>
                );
              })}

              {spectators.length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-col gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500/70">
                    👁️ Spectators ({spectators.length})
                  </h3>
                  <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto">
                    {spectators.map(s => {
                      const isMe = s.id === myId;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-xl transition-all duration-200 border"
                          style={{
                            background: isMe ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.02)',
                            borderColor: isMe ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👁️</span>
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                              {s.username}
                              {isMe && <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-500 font-bold uppercase">You</span>}
                              {s.connected === false && <span className="text-[8px] text-gray-500 font-bold">(offline)</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button
                onClick={() => setShowPlayersModal(false)}
                className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer border hover:bg-white/5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  color: '#d1d5db',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Rule Book Modal */}
      <RuleBookModal
        isOpen={showRuleBook}
        onClose={() => setShowRuleBook(false)}
      />

      {/* Onboarding Tutorial Modal */}
      <OnboardingTutorial
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          localStorage.setItem('mi_tutorial_completed', 'true');
        }}
      />

      {/* Vote Kick Host Modal Overlay */}
      {gameState?.kickHostVote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4 animate-scaleIn"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #291212 0%, #0d0606 100%)',
              borderColor: 'rgba(239,68,68,0.35)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.85), 0 0 30px rgba(239,68,68,0.1) inset',
            }}>
            <div className="flex items-center gap-2.5 border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <span className="text-xl">⚠️</span>
              <h2 className="text-base font-bold uppercase tracking-wider text-red-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Vote to Kick Host
              </h2>
            </div>

            <div className="text-sm text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">
                {gameState.players[gameState.kickHostVote.initiatorId]?.username ?? 'A player'}
              </span>{' '}
              has initiated a vote to kick host{' '}
              <span className="font-semibold text-white">
                {gameState.players[gameState.kickHostVote.targetId]?.username ?? 'the host'}
              </span>{' '}
              out of the game. If approved, the host's properties will be unowned and put back on sale.
            </div>

            {/* Players Vote Status */}
            <div className="flex flex-col gap-2 my-2 max-h-[200px] overflow-y-auto pr-1">
              {Object.values(gameState.players)
                .filter(p => !p.isBankrupt && p.id !== gameState.kickHostVote.targetId)
                .map((p) => {
                  const voteVal = gameState.kickHostVote.votes[p.id];
                  let badge = (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 font-bold uppercase">
                      ⏳ Pending
                    </span>
                  );
                  if (voteVal === true) {
                    badge = (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold uppercase">
                        ✅ Yes
                      </span>
                    );
                  } else if (voteVal === false) {
                    badge = (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 font-bold uppercase">
                        ❌ No
                      </span>
                    );
                  }
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                      <span className="text-xs font-bold text-gray-200">{p.username}</span>
                      {badge}
                    </div>
                  );
                })}
            </div>

            {/* Action Buttons */}
            <div className="mt-2 flex flex-col gap-2.5">
              {myId === gameState.kickHostVote.targetId ? (
                <div className="text-xs text-center py-2 text-red-300 font-semibold animate-pulse">
                  ⚠️ A vote is currently in progress to kick you.
                </div>
              ) : gameState.kickHostVote.votes[myId] !== undefined ? (
                <div className="text-xs text-center py-2 text-gray-400">
                  You voted <span className="font-semibold text-white">{gameState.kickHostVote.votes[myId] ? 'YES' : 'NO'}</span>. Waiting for other players...
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVoteKickHostCast(true)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Yes, Kick
                  </button>
                  <button
                    onClick={() => handleVoteKickHostCast(false)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    No, Keep
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}