/**
 * frontend/src/pages/Lobby.jsx
 *
 * Live multiplayer lobby.
 * Subscribes to socket room events and renders the current room state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate }                   from 'react-router-dom';
import socket                                        from '@/socket/socket';
import socketService                                 from '@/services/socketService';
import PlayerCard from "@/components/PlayerPanel/PlayerCard";
import RoomCode from "@/components/Lobby/RoomCode";
import ConnectionStatus from "@/components/GameHUD/ConnectionStatus";
import RuleBookModal from '@/components/RuleBookModal';
import { PLAYER_TOKENS } from '@/utils/boardLayout';
import CreatorFooter from '@/components/CreatorFooter';
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const stored = (key) => sessionStorage.getItem(key) ?? '';

// ── Gold button ───────────────────────────────────────────────────────────────
function Button({ children, onClick, disabled = false, variant = 'gold', className = '' }) {
  const styles = {
    gold:    { bg: disabled ? 'rgba(180,83,9,0.2)' : 'linear-gradient(135deg,#d97706,#f59e0b,#d97706)',
               color: '#0a0805', shadow: '0 4px 20px rgba(245,158,11,0.35)', border: 'none' },
    green:   { bg: 'linear-gradient(135deg,#15803d,#22c55e,#15803d)', color: '#fff',
               shadow: '0 4px 20px rgba(34,197,94,0.35)', border: 'none' },
    ghost:   { bg: 'rgba(255,255,255,0.04)', color: '#9ca3af',
               shadow: 'none', border: '1px solid rgba(255,255,255,0.1)' },
    danger:  { bg: 'rgba(239,68,68,0.1)', color: '#f87171',
               shadow: 'none', border: '1px solid rgba(239,68,68,0.25)' },
  };
  const s = styles[variant] || styles.gold;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest
                  transition-all duration-200 cursor-pointer disabled:opacity-40
                  disabled:cursor-not-allowed ${className}`}
      style={{ fontFamily:"'DM Sans',sans-serif", background: s.bg,
               color: s.color, boxShadow: s.shadow, border: s.border }}>
      {children}
    </button>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────
function Section({ title, children, accent }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
         style={{ background:'rgba(255,255,255,0.02)',
                  border: accent ? `1px solid ${accent}30` : '1px solid rgba(255,255,255,0.06)' }}>
      {title && (
        <h3 className="text-xs font-bold uppercase tracking-widest"
            style={{ color: accent || 'rgba(212,175,55,0.55)',
                     fontFamily:"'DM Sans',sans-serif" }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

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
function ChatBubble({ msg, isMe, players = [] }) {
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
               width: 240,
               maxWidth: '100%',
             }}>
          <audio src={msg.text} controls style={{ width: '100%', height: 32, filter: 'invert(1) hue-rotate(180deg)' }} />
        </div>
      ) : (
        <div className="text-xs px-3 py-1.5 rounded-xl max-w-xs break-words"
             style={{ background: isMe ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                      color: isMe ? '#fde68a' : '#e5e7eb',
                      border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily:"'DM Sans',sans-serif",
                      lineHeight: '1.4' }}>
          {formatMentions(msg.text, players)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Lobby() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();
  const [showRuleBook, setShowRuleBook] = useState(false);

  // Resolve playerId/username from localStorage if not in sessionStorage (e.g. copied direct link)
  let resolvedId = stored('mi_playerId');
  let resolvedUsername = stored('mi_username');
  if (!resolvedId) {
    try {
      const storedUser = localStorage.getItem('mi_google_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.playerId) {
          resolvedId = parsed.playerId;
          resolvedUsername = parsed.username || '';
          sessionStorage.setItem('mi_playerId', resolvedId);
          sessionStorage.setItem('mi_username', resolvedUsername);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  const myId       = resolvedId;
  const myUsername = resolvedUsername;

  // Room state
  const [room,         setRoom]        = useState(null);
  const [myReady,      setMyReady]     = useState(false);
  const [systemAlert,  setSystemAlert] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput,    setChatInput]   = useState('');
  
  // Advanced Chat states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionsDropdown, setShowMentionsDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const filteredPlayers = (room?.players ?? []).filter(p =>
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
    words.pop(); // remove partial mention
    words.push(`@${p.username} `);
    setChatInput(words.join(' '));
    setShowMentionsDropdown(false);
  };
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(true);
  const [startLoading, setStartLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);

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

  const chatEndRef = useRef(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isHost     = room?.hostId === myId;
  const players    = room?.players ?? [];
  const spectators = room?.spectators ?? [];
  const allReady   = players.length >= 2 && players.every((p) => p.ready);
  const myPlayer   = players.find((p) => p.id === myId) || spectators.find((p) => p.id === myId);

  // ── Scroll chat to bottom ──────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages]);

  // ── Initial load — connect + fetch state ───────────────────────────────────
  useEffect(() => {
    if (!myId) {
      navigate('/');
      return;
    }

    // If socket not connected, attempt reconnect
    const init = async () => {
      try {
        if (!socket.connected) {
          socket.connect();
          await new Promise((res) => socket.once('connect', res));
        }

        // If spectate parameter is present, bypass player checks and join directly as spectator
        const isForceSpectate = new URLSearchParams(window.location.search).get('spectate') === 'true';
        if (isForceSpectate) {
          const storedUserStr = localStorage.getItem('mi_google_user');
          const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
          const username = storedUser?.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

          try {
            const data = await socketService.joinRoom(roomCode, username, myId, true);
            setRoom(data.room);
            sessionStorage.setItem('mi_isSpectator', 'true');
            return;
          } catch (specErr) {
            console.error('[Lobby] Spectate error:', specErr);
            showToast(specErr.message || 'Could not join as spectator', 'error');
            return;
          }
        }

        // Try reconnect-room first (handles page refresh)
        try {
          const data = await socketService.reconnectRoom(roomCode, myId);
          setRoom(data.room);
          sessionStorage.setItem('mi_isSpectator', data.isSpectator ? 'true' : 'false');
          const me = data.room.players.find((p) => p.id === myId);
          if (me) setMyReady(me.ready);
        } catch (err) {
          const isExplicitRejection = err.message?.includes('not found') || err.message?.includes('ended');
          if (!isExplicitRejection) {
            throw err;
          }

          // Player is not in the room yet (copied link join / fresh tab session)
          const storedUserStr = localStorage.getItem('mi_google_user');
          const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
          const username = storedUser?.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

          try {
            // Attempt to join as player first
            const data = await socketService.joinRoom(roomCode, username, myId, false);
            setRoom(data.room);
            sessionStorage.setItem('mi_isSpectator', 'false');
            const me = data.room.players.find((p) => p.id === myId);
            if (me) setMyReady(me.ready);
          } catch (joinErr) {
            // If lobby is full or game already started, try joining as spectator
            if (joinErr.message?.includes('full') || joinErr.message?.includes('started')) {
              try {
                const data = await socketService.joinRoom(roomCode, username, myId, true);
                setRoom(data.room);
                sessionStorage.setItem('mi_isSpectator', 'true');
              } catch (specErr) {
                throw specErr;
              }
            } else {
              throw joinErr;
            }
          }
        }

        // Load chat history
        try {
          const hist = await socketService.getChatHistory();
          setChatMessages(hist.messages || []);
        } catch { /* no chat yet */ }

      } catch (err) {
        setError(err.message || 'Could not connect to room');
      } finally {
        setLoading(false);
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myId]);

  // Redirect to game room if game has already started
  useEffect(() => {
    if (room && room.status === 'playing') {
      navigate(`/game/${roomCode}`);
    }
  }, [room, roomCode, navigate]);

  // ── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const onRoomUpdated      = ({ data }) => {
      console.log('[room-updated]', data);
      if (!data) return;
      setRoom(data.room ?? data);
    };
    const onPlayerJoined     = ({ data }) => {
      if (data?.room) setRoom(data.room);
    };
    const onPlayerLeft       = ({ data }) => { if (data?.room) setRoom(data.room); };
    const onPlayerReconnected= ({ data }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: true } : p) };
      });
    };
    const onPlayerDisconnected = ({ data }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.map(p =>
          p.id === data.playerId ? { ...p, connected: false } : p) };
      });
    };
    const onGameStarted = ({ data }) => {
      if (data?.room) setRoom(data.room);
      navigate(`/game/${roomCode}`);
    };
    const onReceiveMessage = ({ data }) => {
      if (data?.message) setChatMessages((prev) => [...prev, data.message]);
    };
    const onKicked = () => {
      sessionStorage.clear();
      navigate('/');
    };
    const onRoomDestroyed = () => {
      sessionStorage.clear();
      navigate('/');
    };
    const onSystemAlert = (data) => {
      if (data && data.message) {
        setSystemAlert(data.message);
      }
    };
    const onConnect = () => {
      console.log('[Lobby] Socket connected/reconnected, restoring lobby state...');
      let attempts = 0;
      const attemptReconnect = () => {
        if (!socket.connected) return;
        socketService.reconnectRoom(roomCode, myId)
          .then((data) => {
            setRoom(data.room ?? data);
            sessionStorage.setItem('mi_isSpectator', data.isSpectator ? 'true' : 'false');
            const me = data.room?.players?.find((p) => p.id === myId);
            if (me) setMyReady(me.ready);
          })
          .catch((err) => {
            console.error(`[Lobby] Reconnection attempt #${attempts} failed:`, err.message);
            const isExplicitRejection = err.message?.includes('not found') || err.message?.includes('ended');
            if (isExplicitRejection) return;
            attempts++;
            if (attempts < 5 && socket.connected) {
              setTimeout(attemptReconnect, 2000);
            }
          });
      };
      attemptReconnect();
    };

    socket.on('connect',            onConnect);
    socket.on('room-updated',       onRoomUpdated);
    socket.on('player-joined',      onPlayerJoined);
    socket.on('player-left',        onPlayerLeft);
    socket.on('player-reconnected', onPlayerReconnected);
    socket.on('player-disconnected',onPlayerDisconnected);
    socket.on('game-started',       onGameStarted);
    socket.on('receive-message',    onReceiveMessage);
    socket.on('kicked',             onKicked);
    socket.on('room-destroyed',     onRoomDestroyed);
    socket.on('system-alert',       onSystemAlert);

    return () => {
      socket.off('connect',            onConnect);
      socket.off('room-updated',       onRoomUpdated);
      socket.off('player-joined',      onPlayerJoined);
      socket.off('player-left',        onPlayerLeft);
      socket.off('player-reconnected', onPlayerReconnected);
      socket.off('player-disconnected',onPlayerDisconnected);
      socket.off('game-started',       onGameStarted);
      socket.off('receive-message',    onReceiveMessage);
      socket.off('kicked',             onKicked);
      socket.off('room-destroyed',     onRoomDestroyed);
      socket.off('system-alert',       onSystemAlert);
    };
  }, [roomCode, navigate, myId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleReady = useCallback(async () => {
    setReadyLoading(true);
    const next = !myReady;
    try {
      await socketService.setPlayerReady(next);
      setMyReady(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setReadyLoading(false);
    }
  }, [myReady]);

  const handleStart = useCallback(async () => {
    setStartLoading(true);
    try {
      await socketService.startGame();
    } catch (err) {
      setError(err.message);
      setStartLoading(false);
    }
  }, []);

  const handleAddBot = useCallback(async () => {
    try {
      await socketService.addBot();
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleRemoveBot = useCallback(async (playerId) => {
    try {
      await socketService.removeBot(playerId);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleKickPlayer = useCallback(async (playerId) => {
    try {
      await socketService.kickPlayer(playerId);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleLeave = useCallback(async () => {
    try {
      await socketService.leaveRoom();
    } catch { /* ignore */ }
    sessionStorage.clear();
    socket.disconnect();
    navigate('/');
  }, [navigate]);

  const handleSendChat = useCallback(async (e) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    try {
      await socketService.sendMessage(text);
    } catch { /* ignore */ }
  }, [chatInput]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background:'#0a0805', fontFamily:"'DM Sans',sans-serif" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl animate-spin" style={{ animationDuration:'1.2s' }}>🎲</div>
          <p style={{ color:'rgba(212,175,55,0.6)', letterSpacing:'0.15em', fontSize:'0.8rem',
                      textTransform:'uppercase', fontWeight:600 }}>
            Connecting…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background:'radial-gradient(ellipse at 20% 0%,#1c0f00 0%,#0a0805 60%,#050302 100%)',
                  fontFamily:"'DM Sans',sans-serif" }}>

      {systemAlert && (
        <div className="w-full py-2.5 px-4 text-center text-xs font-bold uppercase tracking-widest relative z-50 flex items-center justify-center gap-2 transition-all duration-300"
             style={{
               background: 'linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)',
               borderBottom: '1px solid #fde68a',
               color: '#fde68a',
               boxShadow: '0 4px 15px rgba(217,119,6,0.3)',
               textShadow: '0 1px 2px rgba(0,0,0,0.5)'
             }}>
          <span>📢 SYSTEM ALERT: {systemAlert}</span>
          <button 
            onClick={() => setSystemAlert('')}
            className="ml-3 hover:scale-110 active:scale-95 transition-all text-xs font-black cursor-pointer text-amber-100 hover:text-white bg-black/10 hover:bg-black/20 w-5 h-5 rounded-full flex items-center justify-center"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 4px; }
      `}</style>

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position:'absolute', top:'-10%', right:'-5%', width:'40vw', height:'40vw',
                      borderRadius:'50%', background:'radial-gradient(circle,rgba(4,120,87,0.07) 0%,transparent 70%)',
                      filter:'blur(40px)' }} />
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom:'1px solid rgba(212,175,55,0.1)' }}>
        <div>
          <h1 className="font-black text-lg leading-none"
              style={{ fontFamily:"'Playfair Display',serif",
                       background:'linear-gradient(135deg,#d4af37,#fde68a,#d97706)',
                       WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Monopoly <span style={{ fontStyle:'italic' }}>India</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color:'rgba(156,163,175,0.45)' }}>
            Waiting for players…
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRuleBook(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
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
          <ConnectionStatus />
          <Button variant="danger" onClick={handleLeave}>Leave</Button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-y-auto lg:overflow-hidden">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:w-80 flex-shrink-0">

          {/* Room code */}
          <Section accent="#d4af37">
            <RoomCode code={roomCode} />
          </Section>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm"
                 style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                          color:'#f87171' }}>
              ⚠ {error}
            </div>
          )}

          {/* Ready / Start controls */}
          <Section>
            {sessionStorage.getItem('mi_isSpectator') === 'true' ? (
              <div className="p-4 rounded-xl text-center border border-dashed border-yellow-500/20 bg-yellow-500/5">
                <span className="text-xl">👁️</span>
                <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mt-1">Spectator Mode</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">You are watching this match. Sit back, relax, and cheer on the landlords!</p>
              </div>
            ) : (
              <>
                {!myPlayer?.isBankrupt && (
                  <Button
                    variant={myReady ? 'ghost' : 'green'}
                    onClick={toggleReady}
                    disabled={readyLoading}
                    className="w-full">
                    {readyLoading ? '…' : myReady ? '✓ Ready  (click to unready)' : '🟢 Mark as Ready'}
                  </Button>
                )}

                {isHost && (
                  <Button
                    variant="gold"
                    onClick={handleStart}
                    disabled={!allReady || startLoading}
                    className="w-full mt-1">
                    {startLoading ? 'Starting…' : players.length < 2
                      ? `Need ${2 - players.length} more player${2 - players.length !== 1 ? 's' : ''}`
                      : !allReady ? 'Waiting for all to ready up'
                      : '🚀 Start Game'}
                  </Button>
                )}

                {!isHost && (
                  <p className="text-xs text-center" style={{ color:'rgba(156,163,175,0.4)' }}>
                    Waiting for the host to start the game
                  </p>
                )}
              </>
            )}
          </Section>

          {/* Token Selector */}
          {sessionStorage.getItem('mi_isSpectator') !== 'true' && (
            <Section title="Select Your Token" accent="#f59e0b">
              <div className="grid grid-cols-6 gap-2 justify-items-center">
                {PLAYER_TOKENS.map((token) => {
                  const myPlayerIdx = players.findIndex(p => p.id === myId);
                  const myActiveToken = myPlayer?.token || (myPlayerIdx !== -1 ? PLAYER_TOKENS[myPlayerIdx % PLAYER_TOKENS.length] : null);
                  const isSelected = myActiveToken === token;
                  
                  // A token is taken if another player has it as their active token
                  const isTaken = players.some((p, idx) => {
                    if (p.id === myId) return false;
                    const activeToken = p.token || PLAYER_TOKENS[idx % PLAYER_TOKENS.length];
                    return activeToken === token;
                  });

                  return (
                    <button
                      key={token}
                      disabled={isTaken}
                      onClick={async () => {
                        try {
                          await socketService.selectToken(token);
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      className={`h-9 w-9 text-lg flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200
                                  ${isTaken ? 'opacity-20 cursor-not-allowed bg-transparent' : 'hover:scale-110 active:scale-95 bg-white/5 border'}
                                  ${isSelected ? 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] bg-amber-500/10' : 'border-white/5'}`}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {token}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Rules reminder */}
          <Section title="About">
            <ul className="text-xs flex flex-col gap-1.5" style={{ color:'rgba(156,163,175,0.5)' }}>
              <li>• 2–8 players</li>
              <li>• All players must be ready</li>
              <li>• Host starts the game</li>
              <li>• Indian cities &amp; properties</li>
              <li>• Standard Monopoly rules</li>
            </ul>
          </Section>
        </div>

        {/* ── Centre: player list ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <Section>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'rgba(212,175,55,0.55)', fontFamily: "'DM Sans',sans-serif" }}>
                Players in room ({players.length}/8)
              </span>
              {isHost && players.length < 8 && (
                <button
                  onClick={handleAddBot}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer hover:bg-yellow-500/20"
                  style={{
                    background: 'rgba(212,175,55,0.08)',
                    color: '#f59e0b',
                    border: '1px solid rgba(212,175,55,0.25)',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  🤖 Add AI Bot
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <p className="text-sm" style={{ color:'rgba(156,163,175,0.35)' }}>
                No players yet…
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {players.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 w-full">
                    <div className="flex-1 min-w-0">
                      <PlayerCard
                        player={p}
                        isHost={p.id === room?.hostId}
                        isMe={p.id === myId}
                        showReady={true}
                        index={i}
                      />
                    </div>
                    {isHost && p.id !== myId && (
                      <button
                        onClick={() => p.isBot ? handleRemoveBot(p.id) : handleKickPlayer(p.id)}
                        className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        ❌ Kick
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`}
                   className="flex items-center gap-3 px-4 py-3 rounded-xl"
                   style={{ border:'1px dashed rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-full"
                     style={{ background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.1)' }} />
                <span className="text-sm" style={{ color:'rgba(156,163,175,0.25)' }}>
                  Waiting for player…
                </span>
              </div>
            ))}

            {spectators.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                <span className="text-[10px] font-black text-amber-500/55 uppercase tracking-widest block text-left">
                  👁️ Spectators ({spectators.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {spectators.map(s => (
                    <span key={s.id} className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5"
                          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(212,175,55,0.2)', color: '#d1d5db' }}>
                      👁️ {s.username} {s.connected === false && <span className="text-[10px] text-gray-500 font-bold">(offline)</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ── Right: chat ───────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:w-72 flex-shrink-0" style={{ minHeight:0 }}>
          <Section title="Chat" accent="rgba(99,102,241,0.6)">
            {/* Messages */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1"
                 style={{ height:'320px', minHeight:0 }}>
              {chatMessages.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color:'rgba(156,163,175,0.3)' }}>
                  No messages yet. Say hi! 👋
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} isMe={msg.playerId === myId} players={players} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 mt-1 relative" style={{ alignItems: 'center', position: 'relative' }}>
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
                <div className="flex-grow flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', animation: 'recPulseLobby 2s infinite ease-in-out' }}>
                  <style>{`
                    @keyframes recPulseLobby {
                      0%, 100% { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
                      50% { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.16); }
                    }
                  `}</style>
                  <span>🔴 Recording Voice: 0:{recDuration.toString().padStart(2, '0')} / 0:12</span>
                  <button onClick={stopRecording}
                          className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer text-[10px] uppercase tracking-wider transition-all">
                    Stop & Send ⏹️
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative flex-1 flex items-center min-w-0">
                    <input
                      value={chatInput}
                      onChange={e => handleChatInputChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                      placeholder="Type @name or message…"
                      maxLength={300}
                      className="w-full pl-3 pr-14 py-2 rounded-lg text-sm outline-none"
                      style={{ background:'rgba(255,255,255,0.04)',
                               border:'1px solid rgba(99,102,241,0.2)',
                               color:'#f3f4f6', caretColor:'#818cf8',
                               fontFamily:"'DM Sans',sans-serif" }}
                      onFocus={e => e.target.style.border='1px solid rgba(99,102,241,0.5)'}
                      onBlur={e  => e.target.style.border='1px solid rgba(99,102,241,0.2)'}
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
                  <button
                    onClick={handleSendChat}
                    className="px-3 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all flex-shrink-0"
                    style={{ background:'rgba(99,102,241,0.15)', color:'#a5b4fc',
                             border:'1px solid rgba(99,102,241,0.25)' }}>
                    ↑
                  </button>
                </>
              )}
            </div>
          </Section>
        </div>

      </div>
      <RuleBookModal isOpen={showRuleBook} onClose={() => setShowRuleBook(false)} />
      <CreatorFooter />
    </div>
  );
}
