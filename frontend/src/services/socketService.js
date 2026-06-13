/**
 * frontend/src/services/socketService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Promise-wrapped Socket.IO calls.
 *
 * Every method returns a Promise that resolves with the server's ack payload
 * or rejects with an error string.
 *
 * The service layer handles:
 *   - Ensuring the socket is connected before emitting
 *   - Uniform error extraction from the { ok, data, error } envelope
 *   - Timeout guards (10 s) so callers never hang forever
 *
 * Usage:
 *   import socketService from '@/services/socketService';
 *   const { room, playerId } = await socketService.createRoom('Arjun');
 */

import socket from '@/socket/socket';

const EMIT_TIMEOUT_MS = 10_000;

/**
 * Update query parameters dynamically on the socket object.
 * Used for auto-healing connections on reconnection handshakes.
 */
export const updateSocketQuery = (roomCode, playerId) => {
  if (!socket.io.opts.query) {
    socket.io.opts.query = {};
  }
  if (roomCode) socket.io.opts.query.roomCode = roomCode.toUpperCase();
  if (playerId) socket.io.opts.query.playerId = playerId;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure socket is connected, then emit an event with an acknowledgement.
 * Wraps the raw callback-style ack in a Promise with a timeout.
 *
 * @param {string} event    — socket event name
 * @param {any}    payload  — data to send
 * @returns {Promise<any>}  — resolves with ack.data on ok, rejects on error
 */
const emit = (event, payload = {}) =>
  new Promise((resolve, reject) => {
    // Connect if not already connected
    if (!socket.connected) socket.connect();

    const timer = setTimeout(() => {
      reject(new Error(`Request timed out (${event})`));
    }, EMIT_TIMEOUT_MS);

    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);

      if (!ack) {
        return reject(new Error('No response from server'));
      }
      if (!ack.ok) {
        return reject(new Error(ack.error || 'Unknown server error'));
      }
      resolve(ack.data ?? ack);
    });
  });

// ─────────────────────────────────────────────────────────────────────────────
// ROOM LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new room. Returns { room, playerId }.
 * @param {string} username
 */
const createRoom = async (username, playerId) => {
  updateSocketQuery(null, playerId);
  const data = await emit('create-room', { username, playerId });
  if (data && data.room) {
    updateSocketQuery(data.room.code, data.playerId);
  }
  return data;
};

/**
 * Join an existing room by code. Returns { room, playerId }.
 * @param {string} code
 * @param {string} username
 * @param {string} playerId
 * @param {boolean} asSpectator
 */
const joinRoom = async (code, username, playerId, asSpectator = false) => {
  updateSocketQuery(code, playerId);
  const data = await emit('join-room', { code, username, playerId, asSpectator });
  if (data) {
    updateSocketQuery(data.room?.code || code, data.playerId);
  }
  return data;
};

/**
 * Voluntarily leave the current room.
 */
const leaveRoom = () => emit('leave-room');

/**
 * Attempt to reconnect to a room after a disconnect.
 * @param {string} code      — room code
 * @param {string} playerId  — the persistent player id issued on join/create
 */
const reconnectRoom = async (code, playerId) => {
  updateSocketQuery(code, playerId);
  const data = await emit('reconnect-room', { code, playerId });
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// LOBBY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle the calling player's ready status.
 * @param {boolean} ready
 */
const setPlayerReady = (ready = true) => emit('player-ready', { ready });

/**
 * Select a character token (emoji) in the lobby.
 * @param {string} token
 */
const selectToken = (token) => emit('select-token', { token });

/**
 * Start the game (host only).
 */
const startGame = () => emit('start-game');

/**
 * Request the current room + game state snapshot.
 * Returns { room, gameState? }.
 */
const getRoomState = () => emit('get-room-state');

/** Add a new bot (host only) */
const addBot = (options) => emit('add-bot', options);

/** Remove a bot (host only) */
const removeBot = (playerId) => emit('remove-bot', { playerId });

/** Kick a player (host only) */
const kickPlayer = (playerId) => emit('kick-player', { playerId });

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a chat message.
 * @param {string} text
 */
const sendMessage = (text) => emit('send-message', { text });

/**
 * Fetch the chat history for the current room (used on reconnect).
 */
const getChatHistory = () => emit('get-chat-history');

// ─────────────────────────────────────────────────────────────────────────────
// GAMEPLAY  (wired for later phases)
// ─────────────────────────────────────────────────────────────────────────────

const rollDice            = ()           => emit('roll-dice');
const buyProperty         = ()           => emit('buy-property');
const endTurn             = ()           => emit('end-turn');
const mortgageProperty    = (tileId)     => emit('mortgage-property',   { tileId });
const unmortgageProperty  = (tileId)     => emit('unmortgage-property', { tileId });
const buildHouse          = (tileId)     => emit('build-house',         { tileId });
const buildHotel          = (tileId)     => emit('build-hotel',         { tileId });
const sellHouse           = (tileId)     => emit('sell-house',          { tileId });
const sellHotel           = (tileId)     => emit('sell-hotel',          { tileId });
const payJailFine         = ()           => emit('pay-jail-fine');
const useJailCard         = ()           => emit('use-jail-card');
const takeLoan            = (amount)     => emit('take-loan', { amount });
const repayLoan           = ()           => emit('repay-loan');
const declareBankruptcy   = ()           => emit('declare-bankruptcy');
const requestEndGame      = ()           => emit('request-end-game');
const voteEndGame         = (accept)     => emit('vote-end-game', { accept });
const requestKickHost     = ()           => emit('request-kick-host');
const voteKickHost        = (accept)     => emit('vote-kick-host', { accept });

// Trade
const initiateTrade = (targetId, offer, request) =>
  emit('initiate-trade', { targetId, offer, request });
const counterTrade = (offer, request) =>
  emit('counter-trade', { offer, request });
const acceptTrade  = ()  => emit('accept-trade');
const rejectTrade  = ()  => emit('reject-trade');
const cancelTrade  = ()  => emit('cancel-trade');
const toggleAutoplay = (autoplay) => emit('toggle-autoplay', { autoplay });

// Auction
const placeBid            = (amount) => emit('place-bid',    { amount });
const passAuction         = ()       => emit('pass-auction');
const startPropertyAuction = (tileId) => emit('start-property-auction', { tileId });

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const socketService = {
  // Connection
  connect:    ()  => socket.connect(),
  disconnect: ()  => socket.disconnect(),
  updateSocketQuery,

  // Room
  createRoom,
  joinRoom,
  leaveRoom,
  reconnectRoom,

  // Lobby
  setPlayerReady,
  selectToken,
  startGame,
  getRoomState,
  addBot,
  removeBot,
  kickPlayer,

  // Chat
  sendMessage,
  getChatHistory,

  // Gameplay
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
  requestKickHost,
  voteKickHost,
  initiateTrade,
  counterTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  toggleAutoplay,
  placeBid,
  passAuction,
  startPropertyAuction,
};

export default socketService;
