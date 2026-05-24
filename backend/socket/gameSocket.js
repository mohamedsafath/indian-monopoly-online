/* backend/socket/gameSocket.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * MONOPOLY INDIA — Socket.IO Game Handler
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Responsibilities:
 *   - Room lifecycle  (create / join / leave / reconnect)
 *   - Lobby & ready   (player-ready / start-game)
 *   - Game events     (roll, buy, build, trade, auction, jail, …)
 *   - Chat            (send-message / receive-message)
 *   - Anti-cheat      (server-authoritative; all actions validated here)
 *   - AFK timeouts    (TURN_TIMEOUT_SECONDS from engine)
 *   - Disconnect /    (graceful handling + reconnect restore)
 *     reconnect
 *
 * Usage (in server entry-point / app.js):
 *
 *   const { Server } = require('socket.io');
 *   const io = new Server(httpServer, { cors: { origin: '*' } });
 *   require('./socket/gameSocket')(io);
 *
 * ── Conventions ──────────────────────────────────────────────────────────────
 *
 *   Client → Server  events are "verb-noun"   e.g. 'roll-dice'
 *   Server → Client  events are "noun-verb-d" e.g. 'game-updated'
 *
 *   Every server → client payload wraps data in:
 *   { ok: boolean, data?: any, error?: string }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const {
  // Lifecycle
  initializeGame,
  getClientState,
  getPlayerState,
  currentPlayer,

  // Actions
  rollDice,
  buyProperty,
  endTurn,
  mortgageProperty,
  unmortgageProperty,
  buildHouse,
  buildHotel,
  sellHouse,
  sellHotel,
  payJailFine,
  useJailCard,
  takeLoan,
  repayLoan,
  declareBankruptcy,
  requestEndGame,
  voteEndGame,
  skipAfkTurn,

  // Trade
  initiateTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,

  // Auction
  placeBid,
  passAuction,
  auctionProperty,

  // Constants
  EVENT_TYPES,
  TURN_TIMEOUT_SECONDS,
} = require('../game-engine/gameEngine');

// ─────────────────────────────────────────────────────────────────────────────
// ROOM STORE  (in-memory; swap for Redis when scaling horizontally)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * rooms  Map<roomCode, RoomObject>
 *
 * RoomObject shape:
 * {
 *   code:         string,        // 6-char uppercase room code
 *   hostId:       string,        // socket.id of the host
 *   status:       string,        // 'lobby' | 'playing' | 'finished'
 *   players: [                   // ordered by join time
 *     { id: string, username: string, socketId: string, ready: boolean,
 *       connected: boolean, disconnectedAt: number|null }
 *   ],
 *   gameState:    Object|null,   // live gameEngine state while playing
 *   afkTimer:     NodeJS.Timeout|null,
 *   chatHistory:  ChatMessage[], // last 200 messages
 * }
 */
const rooms = new Map();

/**
 * socketToRoom  Map<socketId, roomCode>
 * Reverse-lookup: given a socket.id find which room it belongs to.
 */
const socketToRoom = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PLAYERS        = 8;
const MIN_PLAYERS        = 2;
const RECONNECT_GRACE_MS = 60_000;   // 60 s to reconnect before being removed
const MAX_CHAT_HISTORY   = 200;
const ROOM_CODE_LENGTH   = 6;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a random uppercase alphanumeric room code. */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no ambiguous 0/O/1/I
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

/** Generate a unique room code not already in use. */
const uniqueRoomCode = () => {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));
  return code;
};

/**
 * Wrap a value in the standard server-response envelope.
 * @param {boolean} ok
 * @param {any}     data
 * @param {string}  [error]
 */
const envelope = (ok, data = null, error = undefined) =>
  error !== undefined ? { ok, error } : { ok, data };

/** Emit an error acknowledgement back to the requesting socket. */
const ackError = (cb, msg) => {
  if (typeof cb === 'function') cb(envelope(false, null, msg));
};

/** Emit a success acknowledgement back to the requesting socket. */
const ackOk = (cb, data) => {
  if (typeof cb === 'function') cb(envelope(true, data));
};

/**
 * Find a player entry in a room by socketId.
 * @returns {Object|undefined}
 */
const findPlayerBySocket = (room, socketId) =>
  room.players.find((p) => p.socketId === socketId);

/**
 * Find a player entry in a room by persistent player id.
 * @returns {Object|undefined}
 */
const findPlayerById = (room, playerId) =>
  room.players.find((p) => p.id === playerId);

/**
 * Build the lobby snapshot to broadcast on room-updated.
 * Safe to share with all clients.
 */
const lobbySnapshot = (room) => ({
  code:    room.code,
  status:  room.status,
  hostId:  room.hostId,
  players: room.players.map((p) => ({
    id:        p.id,
    username:  p.username,
    ready:     p.ready,
    connected: p.connected,
  })),
});

/**
 * Broadcast the current lobby snapshot to every socket in the room.
 * Logged temporarily for lobby sync debugging.
 */
const emitRoomUpdated = (io, room) => {
  const snapshot = lobbySnapshot(room);
  console.log('[emit] room-updated ->', room.code, snapshot.players.length);
  io.to(room.code).emit('room-updated', envelope(true, snapshot));
};

/**
 * Broadcast the current game state to every socket in the room,
 * using the player-specific projection (includes _myId).
 */
const broadcastGameState = (io, room) => {
  if (!room.gameState) return;
  room.players.forEach((p) => {
    if (p.connected && p.socketId) {
      const state = getPlayerState(room.gameState, p.id);
      io.to(p.socketId).emit('game-updated', envelope(true, state));
    }
  });
};

/**
 * Broadcast game events array to all sockets in the room.
 * Events drive client animations / toast notifications.
 */
const broadcastEvents = (io, room, events) => {
  if (!events || events.length === 0) return;
  io.to(room.code).emit('game-events', envelope(true, { events }));

  // Emit specialized socket events for loans to specific players
  events.forEach((ev) => {
    if (ev.type === 'LOAN_APPROVED') {
      const p = room.players.find((player) => player.id === ev.payload.playerId);
      if (p && p.socketId) {
        io.to(p.socketId).emit('loan-approved', envelope(true, { amount: ev.payload.amount }));
      }
    } else if (ev.type === 'LOAN_REPAYMENT_DUE') {
      const p = room.players.find((player) => player.id === ev.payload.playerId);
      if (p && p.socketId) {
        io.to(p.socketId).emit('loan-repayment-due', envelope(true, { turnsRemaining: ev.payload.turnsRemaining }));
      }
    } else if (ev.type === 'LOAN_REPAID') {
      const p = room.players.find((player) => player.id === ev.payload.playerId);
      if (p && p.socketId) {
        io.to(p.socketId).emit('loan-repaid', envelope(true, { playerId: ev.payload.playerId }));
      }
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// AFK TIMER
// ─────────────────────────────────────────────────────────────────────────────

/** Clear any existing AFK timer for the room. */
const clearAfkTimer = (room) => {
  if (room.afkTimer) {
    clearTimeout(room.afkTimer);
    room.afkTimer = null;
  }
};

/**
 * Start (or restart) the AFK timer for the current player.
 * If it fires, we call skipAfkTurn() and advance the game.
 */
const startAfkTimer = (io, room) => {
  clearAfkTimer(room);
  if (!room.gameState || room.gameState.status !== 'playing') return;

  room.afkTimer = setTimeout(() => {
    if (!room.gameState || room.gameState.status !== 'playing') return;

    const cp = currentPlayer(room.gameState);
    if (!cp) return;

    const result = skipAfkTurn(room.gameState, cp.id);
    if (result.ok) {
      broadcastEvents(io, room, result.events);
      broadcastGameState(io, room);
      startAfkTimer(io, room);   // restart for next player
    }
  }, TURN_TIMEOUT_SECONDS * 1000);
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOM CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

/** Remove a room and clear all associated mappings + timers. */
const destroyRoom = (io, room) => {
  clearAfkTimer(room);
  room.players.forEach((p) => socketToRoom.delete(p.socketId));
  rooms.delete(room.code);
  io.to(room.code).emit('room-destroyed', envelope(true, { code: room.code }));
};

// ─────────────────────────────────────────────────────────────────────────────
// GAME ACTION DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _dispatch — Execute a game engine function and, on success, broadcast state.
 *
 * @param {Object}   io
 * @param {Object}   socket     — originating socket
 * @param {Object}   room
 * @param {string}   playerId
 * @param {Function} engineFn   — e.g. rollDice, buyProperty …
 * @param {Array}    args       — additional args after (gameState, playerId)
 * @param {Function} [ack]      — optional socket.io acknowledgement callback
 * @returns {boolean}           — true when action succeeded
 */
const _dispatch = (io, socket, room, playerId, engineFn, args = [], ack) => {
  if (!room.gameState) {
    ackError(ack, 'Game has not started');
    return false;
  }

  const result = engineFn(room.gameState, playerId, ...args);

  if (!result.ok) {
    ackError(ack, result.error || 'Action rejected');
    return false;
  }

  ackOk(ack, { events: result.events });

  broadcastEvents(io, room, result.events);
  broadcastGameState(io, room);

  // Restart AFK timer after every successful action
  startAfkTimer(io, room);

  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-CHEAT GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guard: socket must be in a room.
 * Returns { ok: boolean, room?: RoomObject }
 */
const guardInRoom = (socket) => {
  const code = socketToRoom.get(socket.id);
  if (!code) return { ok: false, error: 'You are not in a room' };
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };
  return { ok: true, room };
};

/**
 * Guard: room must be in 'playing' state.
 */
const guardPlaying = (room) => {
  if (room.status !== 'playing') return { ok: false, error: 'Game is not in progress' };
  return { ok: true };
};

/**
 * Guard: socket must belong to the identified player in this room.
 * Returns { ok: boolean, player?: Object }
 */
const guardPlayer = (socket, room) => {
  const player = findPlayerBySocket(room, socket.id);
  if (!player) return { ok: false, error: 'You are not a member of this room' };
  return { ok: true, player };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach all game socket handlers to an existing Socket.IO Server instance.
 * @param {import('socket.io').Server} io
 */
module.exports = (io) => {

  io.on('connection', (socket) => {

    // ─── Log connection ─────────────────────────────────────────────────────
    console.log(`[socket] connected: ${socket.id}`);

    // =========================================================================
    // 1.  ROOM LIFECYCLE
    // =========================================================================

    // ── create-room ──────────────────────────────────────────────────────────
    /**
     * Client payload: { username: string }
     * Ack:            { ok, data: { room: lobbySnapshot, playerId: string } }
     */
   socket.on('create-room', ({ username } = {}, ack) => {
  console.log('🔥 create-room event received');

  if (!username || typeof username !== 'string' || !username.trim()) {
    console.log('❌ Invalid username');
    return ackError(ack, 'username is required');
  }

  const trimmed = username.trim().slice(0, 20);
  const code = uniqueRoomCode();
  const playerId = socket.id;

  const room = {
    code,
    hostId: socket.id,
    status: 'lobby',
    players: [
      {
        id: playerId,
        username: trimmed,
        socketId: socket.id,
        ready: false,
        connected: true,
        disconnectedAt: null,
      },
    ],
    gameState: null,
    afkTimer: null,
    chatHistory: [],
  };

  rooms.set(code, room);
  socketToRoom.set(socket.id, code);
  socket.join(code);

  console.log(`✅ Room created: ${code}`);
  console.log(`👤 Host: ${trimmed}`);

  // Immediately sync lobby
  emitRoomUpdated(io, room);

  ackOk(ack, {
    room: lobbySnapshot(room),
    playerId,
  });
});

    // ── join-room ─────────────────────────────────────────────────────────────
    /**
     * Client payload: { code: string, username: string }
     * Ack:            { ok, data: { room, playerId } }
     * Broadcast:      'player-joined' → room
     */
    socket.on('join-room', ({ code, username } = {}, ack) => {
  console.log('🔥 join-room event received');

  if (!code || !username) {
    return ackError(ack, 'code and username are required');
  }

  const trimmedCode = String(code).trim().toUpperCase();
  const trimmedUser = String(username).trim().slice(0, 20);

  const room = rooms.get(trimmedCode);

  if (!room) {
    console.log('❌ Room not found');
    return ackError(ack, 'Room not found');
  }

  if (room.status !== 'lobby') {
    return ackError(ack, 'Game already started');
  }

  if (room.players.length >= MAX_PLAYERS) {
    return ackError(ack, 'Room is full');
  }

  const playerId = socket.id;

  const playerEntry = {
    id: playerId,
    username: trimmedUser,
    socketId: socket.id,
    ready: false,
    connected: true,
    disconnectedAt: null,
  };

  room.players.push(playerEntry);

  socketToRoom.set(socket.id, trimmedCode);
  socket.join(trimmedCode);

  console.log(`✅ ${trimmedUser} joined ${trimmedCode}`);

  // Sync whole room to everyone
  emitRoomUpdated(io, room);

  io.to(trimmedCode).emit(
    'player-joined',
    envelope(true, {
      player: playerEntry,
    })
  );

  ackOk(ack, {
    room: lobbySnapshot(room),
    playerId,
  });
});

    // ── leave-room ────────────────────────────────────────────────────────────
    /**
     * Client payload: {} (identity derived from socket)
     * Ack:            { ok }
     * Broadcast:      'player-left' → room
     */
    socket.on('leave-room', (_, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      _handlePlayerLeave(io, socket, room, /* intentional */ true);
      ackOk(ack, {});
    });

    // ── reconnect ─────────────────────────────────────────────────────────────
    /**
     * Client payload: { code: string, playerId: string }
     * Ack:            { ok, data: { room?, gameState? } }
     *
     * The client must supply the original playerId it received when it first
     * created/joined the room.  We match on that id, update the socketId,
     * and restore full state.
     */
    socket.on('reconnect-room', ({ code, playerId } = {}, ack) => {
      if (!code || !playerId) return ackError(ack, 'code and playerId are required');

      const trimmedCode = (code + '').trim().toUpperCase();
      const room = rooms.get(trimmedCode);
      if (!room) return ackError(ack, 'Room not found or has ended');

      const player = findPlayerById(room, playerId);
      if (!player) return ackError(ack, 'Player not found in this room');

      // Update socket mapping
      socketToRoom.delete(player.socketId);
      player.socketId      = socket.id;
      player.connected     = true;
      player.disconnectedAt = null;
      socketToRoom.set(socket.id, trimmedCode);
      socket.join(trimmedCode);

      // Update socketId in game state if game is running
      if (room.gameState && room.gameState.players[playerId]) {
        room.gameState.players[playerId].socketId    = socket.id;
        room.gameState.players[playerId].isConnected = true;
      }

      console.log(`[room] ${player.username} reconnected to ${trimmedCode}`);

      // Notify others
      socket.to(trimmedCode).emit('player-reconnected', envelope(true, {
        playerId,
        username: player.username,
      }));

      // Send full room + game state to reconnecting player
      const responseData = { room: lobbySnapshot(room) };
      if (room.gameState) {
        responseData.gameState = getPlayerState(room.gameState, playerId);
      }

      ackOk(ack, responseData);
    });

    // =========================================================================
    // 2.  LOBBY SYSTEM
    // =========================================================================

    // ── player-ready ──────────────────────────────────────────────────────────
    /**
     * Client payload: { ready: boolean }
     * Broadcast:      'room-updated' → room
     */
    socket.on('player-ready', ({ ready = true } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      if (room.status !== 'lobby') return ackError(ack, 'Game already started');

      const player = findPlayerBySocket(room, socket.id);
      if (!player) return ackError(ack, 'Player not found');

      player.ready = Boolean(ready);

      emitRoomUpdated(io, room);
      ackOk(ack, { ready: player.ready });
    });

    // ── start-game ────────────────────────────────────────────────────────────
    /**
     * Only the host may start.  All players must be ready.
     * Minimum MIN_PLAYERS required.
     * Broadcast:  'game-started' → room
     */
    socket.on('start-game', (_, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      if (room.status !== 'lobby')          return ackError(ack, 'Game already started');
      if (room.hostId !== socket.id)        return ackError(ack, 'Only the host can start the game');
      if (room.players.length < MIN_PLAYERS) return ackError(ack, `Need at least ${MIN_PLAYERS} players`);

      const notReady = room.players.filter((p) => !p.ready).map((p) => p.username);
      if (notReady.length > 0) {
        return ackError(ack, `Waiting for players to be ready: ${notReady.join(', ')}`);
      }

      // Build engine player list
      const enginePlayers = room.players.map((p) => ({
        id:       p.id,
        username: p.username,
        socketId: p.socketId,
      }));

      const initResult = initializeGame(room.code, enginePlayers);
      if (!initResult.ok) return ackError(ack, initResult.error);

      room.gameState = initResult.gameState;
      room.status    = 'playing';

      console.log(`[game] started in room ${room.code} with ${room.players.length} players`);

      io.to(room.code).emit('game-started', envelope(true, {
        room: lobbySnapshot(room),
      }));

      // Send each player their personalised state
      broadcastGameState(io, room);

      // Start AFK watchdog for first player
      startAfkTimer(io, room);

      ackOk(ack, {});
    });

    // =========================================================================
    // 3.  GAMEPLAY — DICE + MOVEMENT
    // =========================================================================

    // ── roll-dice ─────────────────────────────────────────────────────────────
    socket.on('roll-dice', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const { room } = gr;
      const player = findPlayerBySocket(room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, room, player.id, rollDice, [], ack);
    });

    // ─── buy-property ─────────────────────────────────────────────────────────
    socket.on('buy-property', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, buyProperty, [], ack);
    });

    // ─── end-turn ─────────────────────────────────────────────────────────────
    socket.on('end-turn', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, endTurn, [], ack);
    });

    // =========================================================================
    // 4.  PROPERTIES — MORTGAGE / BUILD / SELL
    // =========================================================================

    // ── mortgage-property ─────────────────────────────────────────────────────
    /**
     * Client payload: { tileId: number }
     */
    socket.on('mortgage-property', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, mortgageProperty, [Number(tileId)], ack);
    });

    // ── unmortgage-property ───────────────────────────────────────────────────
    socket.on('unmortgage-property', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, unmortgageProperty, [Number(tileId)], ack);
    });

    // ── build-house ───────────────────────────────────────────────────────────
    socket.on('build-house', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, buildHouse, [Number(tileId)], ack);
    });

    // ── build-hotel ───────────────────────────────────────────────────────────
    socket.on('build-hotel', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, buildHotel, [Number(tileId)], ack);
    });

    // ── sell-house ────────────────────────────────────────────────────────────
    socket.on('sell-house', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, sellHouse, [Number(tileId)], ack);
    });

    // ── sell-hotel ────────────────────────────────────────────────────────────
    socket.on('sell-hotel', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId required');

      _dispatch(io, socket, gr.room, player.id, sellHotel, [Number(tileId)], ack);
    });

    // =========================================================================
    // 5.  JAIL SYSTEM
    // =========================================================================

    // ── pay-jail-fine ─────────────────────────────────────────────────────────
    socket.on('pay-jail-fine', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, payJailFine, [], ack);
    });

    // ── use-jail-card ─────────────────────────────────────────────────────────
    socket.on('use-jail-card', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, useJailCard, [], ack);
    });

    // ── take-loan ────────────────────────────────────────────────────────────
    socket.on('take-loan', ({ amount } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (amount === undefined || amount === null) return ackError(ack, 'amount required');

      const result = takeLoan(gr.room.gameState, player.id, Number(amount));
      if (!result.ok) {
        socket.emit('loan-rejected', envelope(false, null, result.error));
        return ackError(ack, result.error);
      }

      ackOk(ack, { events: result.events });
      socket.emit('loan-approved', envelope(true, { amount: Number(amount) }));
      broadcastEvents(io, gr.room, result.events);
      broadcastGameState(io, gr.room);
      startAfkTimer(io, gr.room);
    });

    // ── repay-loan ───────────────────────────────────────────────────────────
    socket.on('repay-loan', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      const result = repayLoan(gr.room.gameState, player.id);
      if (!result.ok) {
        return ackError(ack, result.error);
      }

      ackOk(ack, { events: result.events });
      socket.emit('loan-repaid', envelope(true, { playerId: player.id }));
      broadcastEvents(io, gr.room, result.events);
      broadcastGameState(io, gr.room);
      startAfkTimer(io, gr.room);
    });

    // ── declare-bankruptcy ───────────────────────────────────────────────────
    socket.on('declare-bankruptcy', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, declareBankruptcy, [], ack);
    });

    // ── request-end-game ──────────────────────────────────────────────────────
    socket.on('request-end-game', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, requestEndGame, [], ack);
    });

    // ── vote-end-game ────────────────────────────────────────────────────────
    socket.on('vote-end-game', ({ accept } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, voteEndGame, [Boolean(accept)], ack);
    });

    // =========================================================================
    // 6.  TRADING
    // =========================================================================

    // ── initiate-trade ────────────────────────────────────────────────────────
    /**
     * Client payload:
     * {
     *   targetId:      string,   // player id of the other party
     *   offer: {
     *     money?:      number,
     *     tileIds?:    number[],
     *     jailCard?:   boolean,
     *   },
     *   request: {
     *     money?:      number,
     *     tileIds?:    number[],
     *     jailCard?:   boolean,
     *   }
     * }
     */
    socket.on('initiate-trade', ({ targetId, offer, request } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (!targetId) return ackError(ack, 'targetId is required');

      _dispatch(io, socket, gr.room, player.id, initiateTrade,
        [targetId, offer || {}, request || {}], ack);
    });

    // ── accept-trade ──────────────────────────────────────────────────────────
    socket.on('accept-trade', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, acceptTrade, [], ack);
    });

    // ── reject-trade ──────────────────────────────────────────────────────────
    socket.on('reject-trade', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, rejectTrade, [], ack);
    });

    // ── cancel-trade ──────────────────────────────────────────────────────────
    socket.on('cancel-trade', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, cancelTrade, [], ack);
    });

    // =========================================================================
    // 7.  AUCTION
    // =========================================================================

    // ── place-bid ─────────────────────────────────────────────────────────────
    /**
     * Client payload: { amount: number }
     */
    socket.on('place-bid', ({ amount } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (amount === undefined || amount === null) return ackError(ack, 'amount is required');
      if (typeof amount !== 'number' || amount < 1) return ackError(ack, 'amount must be a positive number');

      _dispatch(io, socket, gr.room, player.id, placeBid, [Math.floor(amount)], ack);
    });

    // ── pass-auction ──────────────────────────────────────────────────────────
    socket.on('pass-auction', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, passAuction, [], ack);
    });

    // ── start-property-auction ───────────────────────────────────────────────
    socket.on('start-property-auction', ({ tileId } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');
      if (tileId === undefined || tileId === null) return ackError(ack, 'tileId is required');

      _dispatch(io, socket, gr.room, player.id, auctionProperty, [Number(tileId)], ack);
    });

    // =========================================================================
    // 8.  CHAT
    // =========================================================================

    // ── send-message ──────────────────────────────────────────────────────────
    /**
     * Client payload: { text: string }
     * Broadcast:      'receive-message' → room
     *
     * Message shape broadcast:
     * {
     *   id:        string,   // unique message id
     *   playerId:  string,
     *   username:  string,
     *   text:      string,
     *   ts:        number,   // Date.now()
     * }
     */
    socket.on('send-message', ({ text } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      const player = findPlayerBySocket(room, socket.id);
      if (!player) return ackError(ack, 'You are not in this room');

      if (!text || typeof text !== 'string') return ackError(ack, 'text is required');

      const cleaned = text.trim().slice(0, 300);   // max 300 chars
      if (!cleaned) return ackError(ack, 'Message cannot be empty');

      const message = {
        id:       `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerId: player.id,
        username: player.username,
        text:     cleaned,
        ts:       Date.now(),
      };

      // Persist in room history
      room.chatHistory.push(message);
      if (room.chatHistory.length > MAX_CHAT_HISTORY) {
        room.chatHistory.splice(0, room.chatHistory.length - MAX_CHAT_HISTORY);
      }

      // Broadcast to everyone in the room (including sender)
      io.to(room.code).emit('receive-message', envelope(true, { message }));

      ackOk(ack, { message });
    });

    // ── get-chat-history ──────────────────────────────────────────────────────
    /**
     * Sent on reconnect so client can repopulate chat.
     * Ack: { ok, data: { messages: ChatMessage[] } }
     */
    socket.on('get-chat-history', (_, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);

      ackOk(ack, { messages: gr.room.chatHistory });
    });

    // =========================================================================
    // 9.  MISC ROOM UTILITIES
    // =========================================================================

    // ── get-room-state ────────────────────────────────────────────────────────
    /**
     * Lets a client re-request full state at any time (tab restore, etc.)
     */
    socket.on('get-room-state', (_, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      const player = findPlayerBySocket(room, socket.id);
      const response = { room: lobbySnapshot(room) };

      if (room.gameState && player) {
        response.gameState = getPlayerState(room.gameState, player.id);
      }

      ackOk(ack, response);
    });

    // ── kick-player ───────────────────────────────────────────────────────────
    /**
     * Host only. Lobby only.
     * Client payload: { playerId: string }
     */
    socket.on('kick-player', ({ playerId } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      if (room.hostId !== socket.id) return ackError(ack, 'Only the host can kick players');
      if (room.status !== 'lobby')   return ackError(ack, 'Cannot kick once game has started');
      if (!playerId)                 return ackError(ack, 'playerId is required');
      if (playerId === room.hostId)  return ackError(ack, 'Host cannot kick themselves');

      const target = findPlayerById(room, playerId);
      if (!target) return ackError(ack, 'Player not found');

      // Remove from room
      room.players = room.players.filter((p) => p.id !== playerId);
      socketToRoom.delete(target.socketId);

      // Notify kicked socket
      io.to(target.socketId).emit('kicked', envelope(true, { code: room.code }));

      // Make them leave the Socket.IO room
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) targetSocket.leave(room.code);

      // Broadcast updated lobby
      io.to(room.code).emit('player-left', envelope(true, {
        playerId,
        room: lobbySnapshot(room),
      }));

      ackOk(ack, {});
    });

    // =========================================================================
    // 10.  DISCONNECT HANDLING
    // =========================================================================

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} — ${reason}`);

      const code = socketToRoom.get(socket.id);
      if (!code) return;

      const room = rooms.get(code);
      if (!room) return;

      _handlePlayerLeave(io, socket, room, /* intentional */ false);
    });

  }); // end io.on('connection')

  // ===========================================================================
  // INTERNAL HELPERS (module-private)
  // ===========================================================================

  /**
   * _handlePlayerLeave — Shared logic for disconnect and leave-room.
   *
   * In lobby: remove player; destroy room if empty or host left.
   * In game:  mark disconnected and start grace timer;
   *           if the disconnecting player had the turn, skip it after grace.
   *
   * @param {Object}  io
   * @param {Object}  socket
   * @param {Object}  room
   * @param {boolean} intentional  true = voluntary leave, false = disconnect
   */
  const _handlePlayerLeave = (io, socket, room, intentional) => {
    const player = findPlayerBySocket(room, socket.id);
    if (!player) return;

    socketToRoom.delete(socket.id);
    socket.leave(room.code);

    // ── LOBBY: just remove them ─────────────────────────────────────────────
    if (room.status === 'lobby') {
      room.players = room.players.filter((p) => p.socketId !== socket.id);

      if (room.players.length === 0) {
        // Empty room — destroy
        destroyRoom(io, room);
        return;
      }

      // If host left, reassign host to next player
      if (room.hostId === socket.id && room.players.length > 0) {
        room.hostId = room.players[0].socketId;
        console.log(`[room] host left ${room.code}; new host: ${room.players[0].username}`);
      }

      io.to(room.code).emit('player-left', envelope(true, {
        playerId: player.id,
        username: player.username,
        room:     lobbySnapshot(room),
      }));
      return;
    }

    // ── PLAYING / FINISHED ──────────────────────────────────────────────────

    if (intentional) {
      // Voluntary leave during a game: treat as bankruptcy forfeit
      player.connected = false;
      player.disconnectedAt = Date.now();

      io.to(room.code).emit('player-left', envelope(true, {
        playerId: player.id,
        username: player.username,
        room:     lobbySnapshot(room),
      }));

      // If only one player left — they win by default
      const activePlayers = room.players.filter(
        (p) => p.connected || (room.gameState && !room.gameState.players[p.id]?.isBankrupt)
      );
      if (activePlayers.length <= 1) {
        _endGameByDefault(io, room);
      }
    } else {
      // Unintentional disconnect: grace period
      player.connected      = false;
      player.disconnectedAt = Date.now();

      if (room.gameState && room.gameState.players[player.id]) {
        room.gameState.players[player.id].isConnected = false;
      }

      io.to(room.code).emit('player-disconnected', envelope(true, {
        playerId:  player.id,
        username:  player.username,
        graceMs:   RECONNECT_GRACE_MS,
      }));

      console.log(`[room] ${player.username} disconnected from ${room.code}; grace ${RECONNECT_GRACE_MS}ms`);

      // Start grace timer
      player._graceTimer = setTimeout(() => {
        // Grace expired — remove player permanently
        const stillDisconnected = !player.connected;
        if (!stillDisconnected) return;  // they reconnected in time

        player._graceTimer = null;
        room.players = room.players.filter((p) => p.id !== player.id);

        io.to(room.code).emit('player-removed', envelope(true, {
          playerId: player.id,
          username: player.username,
          reason:   'reconnect timeout',
          room:     lobbySnapshot(room),
        }));

        console.log(`[room] ${player.username} removed from ${room.code} after grace timeout`);

        // Check end condition
        const remaining = room.players.filter(
          (p) => p.connected && room.gameState && !room.gameState.players[p.id]?.isBankrupt
        );
        if (remaining.length <= 1) {
          _endGameByDefault(io, room);
        }
      }, RECONNECT_GRACE_MS);
    }
  };

  /**
   * _endGameByDefault — Declare the last remaining connected player the winner
   * and clean up the room.
   */
  const _endGameByDefault = (io, room) => {
    clearAfkTimer(room);

    const remaining = room.players.filter((p) => p.connected);
    const winner = remaining.length === 1 ? remaining[0] : null;

    room.status = 'finished';

    io.to(room.code).emit('game-over', envelope(true, {
      reason:   'players-left',
      winnerId: winner ? winner.id : null,
      username: winner ? winner.username : null,
    }));

    console.log(`[game] ended by default in ${room.code}; winner: ${winner?.username ?? 'none'}`);

    // Schedule room destruction after 30 s so clients can read the result
    setTimeout(() => destroyRoom(io, room), 30_000);
  };

};
