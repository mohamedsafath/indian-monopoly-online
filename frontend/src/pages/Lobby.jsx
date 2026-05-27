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

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg, isMe }) {
  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
      <span className="text-xs" style={{ color:'rgba(156,163,175,0.55)',
                                          fontFamily:"'DM Sans',sans-serif" }}>
        {msg.username}
      </span>
      <div className="text-sm px-3 py-1.5 rounded-xl max-w-xs break-words"
           style={{ background: isMe ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isMe ? '#fde68a' : '#e5e7eb',
                    border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    fontFamily:"'DM Sans',sans-serif" }}>
        {msg.text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Lobby() {
  const { roomCode } = useParams();
  const navigate     = useNavigate();

  // Identity (restored from sessionStorage on hard refresh)
  const myId       = stored('mi_playerId');
  const myUsername = stored('mi_username');

  // Room state
  const [room,         setRoom]        = useState(null);
  const [myReady,      setMyReady]     = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput,    setChatInput]   = useState('');
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(true);
  const [startLoading, setStartLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);

  const chatEndRef = useRef(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isHost     = room?.hostId === myId;
  const players    = room?.players ?? [];
  const allReady   = players.length >= 2 && players.every((p) => p.ready);
  const myPlayer   = players.find((p) => p.id === myId);

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

        // Try reconnect-room first (handles page refresh)
        try {
          const data = await socketService.reconnectRoom(roomCode, myId);
          setRoom(data.room);
          const me = data.room.players.find((p) => p.id === myId);
          if (me) setMyReady(me.ready);
        } catch {
          // Wasn't in a room (fresh join from Home already handled)
          const data = await socketService.getRoomState();
          setRoom(data.room);
          const me = data.room.players.find((p) => p.id === myId);
          if (me) setMyReady(me.ready);
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

    socket.on('room-updated',       onRoomUpdated);
    socket.on('player-joined',      onPlayerJoined);
    socket.on('player-left',        onPlayerLeft);
    socket.on('player-reconnected', onPlayerReconnected);
    socket.on('player-disconnected',onPlayerDisconnected);
    socket.on('game-started',       onGameStarted);
    socket.on('receive-message',    onReceiveMessage);
    socket.on('kicked',             onKicked);
    socket.on('room-destroyed',     onRoomDestroyed);

    return () => {
      socket.off('room-updated',       onRoomUpdated);
      socket.off('player-joined',      onPlayerJoined);
      socket.off('player-left',        onPlayerLeft);
      socket.off('player-reconnected', onPlayerReconnected);
      socket.off('player-disconnected',onPlayerDisconnected);
      socket.off('game-started',       onGameStarted);
      socket.off('receive-message',    onReceiveMessage);
      socket.off('kicked',             onKicked);
      socket.off('room-destroyed',     onRoomDestroyed);
    };
  }, [roomCode, navigate]);

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
          </Section>

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
          <Section title={`Players in room (${players.length}/8)`}>
            {players.length === 0 ? (
              <p className="text-sm" style={{ color:'rgba(156,163,175,0.35)' }}>
                No players yet…
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {players.map((p, i) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isHost={p.id === room?.hostId}
                    isMe={p.id === myId}
                    showReady={true}
                    index={i}
                  />
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
                  <ChatBubble key={msg.id} msg={msg} isMe={msg.playerId === myId} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 mt-1" onSubmit={handleSendChat}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Type a message…"
                maxLength={300}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background:'rgba(255,255,255,0.04)',
                         border:'1px solid rgba(99,102,241,0.2)',
                         color:'#f3f4f6', caretColor:'#818cf8',
                         fontFamily:"'DM Sans',sans-serif" }}
                onFocus={e => e.target.style.border='1px solid rgba(99,102,241,0.5)'}
                onBlur={e  => e.target.style.border='1px solid rgba(99,102,241,0.2)'}
              />
              <button
                onClick={handleSendChat}
                className="px-3 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all"
                style={{ background:'rgba(99,102,241,0.15)', color:'#a5b4fc',
                         border:'1px solid rgba(99,102,241,0.25)' }}>
                ↑
              </button>
            </div>
          </Section>
        </div>

      </div>
    </div>
  );
}
