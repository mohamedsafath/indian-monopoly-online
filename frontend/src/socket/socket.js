/**
 * frontend/src/socket/socket.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton Socket.IO client instance.
 *
 * Import this file anywhere in the app to get the same socket connection.
 * The socket does NOT auto-connect on import — call socket.connect() when
 * the user enters a room. This avoids orphaned connections on the landing page.
 *
 * Usage:
 *   import socket from '@/socket/socket';
 *   socket.connect();
 *   socket.on('game-updated', handler);
 *   socket.disconnect();
 */

import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

const getInitialQuery = () => {
  const query = {};
  try {
    const match = window.location.pathname.match(/\/(game|lobby)\/([A-Z0-9]+)/i);
    if (match && match[2]) {
      query.roomCode = match[2].toUpperCase();
    }
    const playerId = sessionStorage.getItem('mi_playerId');
    if (playerId) {
      query.playerId = playerId;
    }
  } catch (e) {
    console.error('[socket] Failed to compute initial query options:', e);
  }
  return query;
};

const socket = io(BACKEND_URL, {
  // Do not connect immediately — we connect explicitly on room create/join
  autoConnect: false,

  // Reconnection settings — retry forever so Render cold-starts (50s+) don't
  // permanently disconnect the game. Max delay is 15s so it's still snappy.
  reconnection:          true,
  reconnectionAttempts:  Infinity,   // was 10 — keep trying through cold starts
  reconnectionDelay:     1000,       // 1 s initial delay
  reconnectionDelayMax:  15000,      // max 15 s between attempts (Render ~50s boot)
  randomizationFactor:   0.4,

  // Transport: WebSocket preferred, fall back to polling
  transports: ['websocket', 'polling'],

  // Timeout before a connection attempt is considered failed
  timeout: 20_000,   // was 10s — allow longer for cold-start

  query: getInitialQuery(),
});

// ── Page-visibility reconnect trigger ──────────────────────────────────────
// If the tab was in the background when the server spun down, the OS may have
// throttled the reconnect attempts. Force a fresh attempt when the user returns.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected) {
      console.log('[socket] tab became visible — forcing reconnect attempt');
      socket.connect();
    }
  });
}

// ── Dev-mode lifecycle logging ──────────────────────────────────────────────
if (import.meta.env.DEV) {
  socket.on('connect',            () => console.log('[socket] connected:', socket.id));
  socket.on('disconnect',  (reason) => console.log('[socket] disconnected:', reason));
  socket.on('connect_error', (err) => console.warn('[socket] connect_error:', err.message));
  socket.on('reconnect_attempt', (n) => console.log(`[socket] reconnect attempt #${n}`));
  socket.on('reconnect',         (n) => console.log(`[socket] reconnected after ${n} attempt(s)`));
  socket.on('reconnect_failed',  () => console.error('[socket] reconnect failed permanently'));
}

export default socket;
