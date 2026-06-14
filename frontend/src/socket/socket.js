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
 *   socket.disconnect()
 *
 * Transport strategy:
 *   Render.com free tier uses an HTTP reverse proxy that can drop WebSocket
 *   upgrades after ~1 second if the connection is not perfectly formed,
 *   causing a permanent 1-second reconnect storm.
 *   We use polling-only (`upgrade: false`) which is rock-solid on Render's
 *   proxy and avoids the upgrade dance entirely.  The latency trade-off is
 *   negligible for turn-based board-game traffic.
 */

import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

// ── Reconnect-loop guard ────────────────────────────────────────────────────
// If we reconnect more than MAX_RAPID_RECONNECTS times within RAPID_WINDOW_MS
// we back off for BACKOFF_MS before allowing further reconnects.
// This prevents a crashed component or bad server state from flooding the server.
let _reconnectTimestamps = [];
const MAX_RAPID_RECONNECTS = 5;
const RAPID_WINDOW_MS      = 8000;   // 5 reconnects in 8 seconds → back off
const BACKOFF_MS           = 15000;  // cool down for 15 seconds
let _isBackingOff          = false;

const _isRapidReconnecting = () => {
  const now = Date.now();
  _reconnectTimestamps = _reconnectTimestamps.filter(t => now - t < RAPID_WINDOW_MS);
  return _reconnectTimestamps.length >= MAX_RAPID_RECONNECTS;
};

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

  // ── Transport ──────────────────────────────────────────────────────────────
  // Use polling only on Render free tier — avoids WebSocket upgrade failures
  // that cause the 1-second reconnect death loop.
  transports: ['polling'],
  upgrade:    false,   // never attempt WebSocket upgrade

  // ── Reconnection ───────────────────────────────────────────────────────────
  reconnection:         true,
  reconnectionAttempts: Infinity,
  reconnectionDelay:    2000,      // start at 2s (was 1s — too aggressive)
  reconnectionDelayMax: 20000,     // max 20s (covers Render ~50s cold start)
  randomizationFactor:  0.5,       // adds jitter so clients don't pile on

  // Timeout before a connection attempt is considered failed
  timeout: 25_000,  // allow for Render cold-start

  query: getInitialQuery(),
});

// ── Update handshake query on every connect ──────────────────────────────────
// The initial query is computed once at import time. When the socket reconnects
// (e.g. after a Render cold-start), the playerId / roomCode may have changed or
// not been available yet. Re-set them before each connect attempt.
socket.on('connect', () => {
  const q = getInitialQuery();
  if (q.roomCode) socket.io.opts.query = q;
});

// ── Reconnect-loop guard ─────────────────────────────────────────────────────
socket.io.on('reconnect_attempt', () => {
  _reconnectTimestamps.push(Date.now());

  if (_isBackingOff) {
    console.warn('[socket] reconnect_attempt suppressed — in backoff period');
    return;
  }

  if (_isRapidReconnecting()) {
    _isBackingOff = true;
    console.warn(`[socket] Rapid reconnect loop detected (${MAX_RAPID_RECONNECTS}+ in ${RAPID_WINDOW_MS}ms) — backing off ${BACKOFF_MS}ms`);
    socket.io.reconnectionDelay(BACKOFF_MS);
    setTimeout(() => {
      _isBackingOff = false;
      _reconnectTimestamps = [];
      socket.io.reconnectionDelay(2000); // restore normal delay
      console.log('[socket] Backoff period over — reconnect attempts resumed');
    }, BACKOFF_MS);
  }
});

// ── Page-visibility reconnect trigger ──────────────────────────────────────
// If the tab was in the background when the server spun down, the OS may have
// throttled the reconnect attempts. Force a fresh attempt when the user returns.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected && !_isBackingOff) {
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
  socket.io.on('reconnect_attempt', (n) => console.log(`[socket] reconnect attempt #${n}`));
  socket.io.on('reconnect',         (n) => console.log(`[socket] reconnected after ${n} attempt(s)`));
  socket.io.on('reconnect_failed',  () => console.error('[socket] reconnect failed permanently'));
}

export default socket;
