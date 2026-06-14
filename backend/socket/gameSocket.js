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
  requestKickHost,
  voteKickHost,
  skipAfkTurn,

  // Trade
  initiateTrade,
  counterTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,

  // Auction
  placeBid,
  passAuction,
  auctionProperty,
  concludeActiveAuction,

  // Constants
  EVENT_TYPES,
  TURN_TIMEOUT_SECONDS,
  PLAYER_TOKENS,
} = require('../game-engine/gameEngine');

const { saveRoom, deleteRoom, loadActiveRooms } = require('./roomModel');
const { BOARD_TILES, TILE_BY_ID, hasMonopoly, canBuildHouse, canBuildHotel } = require('../game-engine/boardData');

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
  room.players.find((p) => p.socketId === socketId) ||
  (room.spectators || []).find((p) => p.socketId === socketId);

/**
 * Find a player entry in a room by persistent player id.
 * @returns {Object|undefined}
 */
const findPlayerById = (room, playerId) =>
  room.players.find((p) => p.id === playerId) ||
  (room.spectators || []).find((p) => p.id === playerId);

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
    token:     p.token,
    isBot:     Boolean(p.isBot),
    autoplay:  Boolean(p.autoplay),
    difficulty: p.difficulty || 'medium',
  })),
  spectators: (room.spectators || []).map((p) => ({
    id:        p.id,
    username:  p.username,
    connected: p.connected,
  })),
});

/**
 * Broadcast the current lobby snapshot to every socket in the room.
 * Logged temporarily for lobby sync debugging.
 */
const emitRoomUpdated = (io, room) => {
  const snapshot = lobbySnapshot(room);
  io.to(room.code).emit('room-updated', envelope(true, snapshot));
  saveRoom(room);
};

/**
 * Broadcast the current game state to every socket in the room,
 * using the player-specific projection (includes _myId).
 */
const _recordCompletedMatch = (room) => {
  try {
    const { saveMatch } = require('./matchModel');
    
    // Compile players list
    const players = room.players.map(p => p.username);
    
    // Determine winner
    const winnerId = room.gameState.winnerId || room.gameState.ranking?.[0]?.playerId;
    const winnerPlayer = room.players.find(p => p.id === winnerId);
    const winnerName = winnerPlayer ? winnerPlayer.username : (room.gameState.winnerName || 'Unknown Landlord');
    
    // Final rankings
    const rankings = room.gameState.ranking || [];
    
    // Duration
    const duration = Math.floor((Date.now() - (room.createdAt || Date.now())) / 1000);
    
    const matchData = {
      matchId: `${room.code}_${Date.now()}`,
      date: new Date(),
      duration: Math.max(0, duration),
      players,
      winner: winnerName,
      rankings
    };
    
    saveMatch(matchData);

    // Automatically update lifetime statistics for all registered human players
    const { findUserById, updateUserStats } = require('./userModel');
    for (const member of room.players) {
      if (member.isBot || !member.id.startsWith('google_')) continue;
      
      const myRank = rankings.find(r => r.playerId === member.id);
      if (!myRank) continue;
      
      findUserById(member.id).then(async (user) => {
        if (!user) return;
        
        const isWinner = winnerId === member.id;
        const newGames = (user.games ?? 0) + 1;
        const newWins = (user.wins ?? 0) + (isWinner ? 1 : 0);
        const newLosses = (user.losses ?? 0) + (isWinner ? 0 : 1);
        const newLoans = (user.loansTaken ?? 0) + (myRank.loansTaken ?? 0);
        const newProps = (user.propertiesPurchased ?? 0) + (myRank.propertiesPurchased ?? 0);
        const newNetWorth = (user.totalNetWorthEarned ?? 0) + (myRank.netWorth ?? 0);
        const newMortgages = (user.propertiesMortgaged ?? 0) + (myRank.propertiesMortgaged ?? 0);
        const newRepossessed = (user.propertiesRepossessed ?? 0) + (myRank.propertiesRepossessed ?? 0);
        const newAuctions = (user.auctionsWon ?? 0) + (myRank.auctionsWon ?? 0);
        const newRentPaid = (user.rentPaid ?? 0) + (myRank.rentPaid ?? 0);
        const newRentEarned = (user.rentEarned ?? 0) + (myRank.rentEarned ?? 0);
        const newBankruptcies = (user.bankruptcies ?? 0) + (myRank.isBankrupt ? 1 : 0);
        const newHotels = (user.hotelsBuilt ?? 0) + (myRank.hotelsBuiltCount ?? 0);
        
        await updateUserStats(
          member.id,
          newWins,
          newGames,
          newLosses,
          newLoans,
          newProps,
          newNetWorth,
          newMortgages,
          newRepossessed,
          newAuctions,
          newRentPaid,
          newRentEarned,
          newBankruptcies,
          newHotels
        );
        console.log(`[gameSocket] Server auto-updated lifetime stats for player ${member.id} (${member.username})`);
      }).catch(err => {
        console.error(`[gameSocket] Failed to auto-update stats for ${member.id}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[gameSocket] Failed to record completed match:', err.message);
  }
};

const syncAuctionTimer = (io, room) => {
  if (room.auctionTimer) {
    clearTimeout(room.auctionTimer);
    room.auctionTimer = null;
  }

  if (room.gameState && room.gameState.activeAuction) {
    const endsAt = room.gameState.activeAuction.endsAt;
    const delay = Math.max(0, endsAt - Date.now());

    room.auctionTimer = setTimeout(() => {
      if (room.gameState && room.gameState.activeAuction) {
        console.log(`⏰ [Auction Timer] Auction expired in room ${room.code}. Concluding.`);
        try {
          const events = concludeActiveAuction(room.gameState);
          broadcastEvents(io, room, events);
          broadcastGameState(io, room);
          triggerBotCycle(io, room);
        } catch (e) {
          console.error('[Auction Timer Expiry Error]', e);
        }
      }
      room.auctionTimer = null;
    }, delay);
  }
};

const broadcastGameState = (io, room) => {
  if (!room.gameState) return;
  room.players.forEach((p) => {
    if (p.connected && p.socketId) {
      const state = getPlayerState(room.gameState, p.id);
      io.to(p.socketId).emit('game-updated', envelope(true, state));
    }
  });

  // Automatically record match history exactly once when match is finished
  if (room.gameState.status === 'finished' && !room.matchSaved) {
    room.matchSaved = true;
    _recordCompletedMatch(room);
  }

  saveRoom(room);

  // Sync Auction Timer
  syncAuctionTimer(io, room);
};

/**
 * Dynamically maps a game event type and message text to a premium emoji indicator.
 */
const getEventEmoji = (type, message) => {
  if (!message) return '🔔';

  const trimmed = message.trim();
  const firstCode = trimmed.codePointAt(0);
  if (firstCode > 127) {
    return ''; // Message already starts with an emoji
  }

  const t = String(type || '').toUpperCase();
  const m = String(message || '').toLowerCase();

  if (t.includes('DICE') || t.includes('ROLL') || m.includes('rolled')) return '🎲';
  if (t.includes('BUY') || t.includes('PURCHASE') || m.includes('purchased')) return '🏠';
  if (t.includes('RENT') || m.includes('rent')) return '💸';
  if (t.includes('JAIL_FINE') || m.includes('paid fine') || m.includes('paid ₹500')) return '🔓';
  if (t.includes('JAIL') || m.includes('jail') || m.includes('arrested')) return '🔒';
  if (m.includes('loan approved') || m.includes('took loan')) return '💰';
  if (m.includes('loan repaid')) return '💵';
  if (t.includes('BANKRUPTCY') || m.includes('bankrupt')) return '☠️';
  if (t.includes('GAME_OVER') || m.includes('winner') || m.includes('ended')) return '🏆';
  if (t.includes('TRADE') || m.includes('trade')) return '🤝';
  if (t.includes('BUILD') || m.includes('built')) return '🏗️';
  if (t.includes('MORTGAGE') || m.includes('mortgaged')) return '🏦';
  if (t.includes('UNMORTGAGE') || m.includes('unmortgaged')) return '🔓';

  return '🔔';
};

/**
 * Broadcast game events array to all sockets in the room.
 * Events drive client animations / toast notifications.
 * Additionally convert gameplay event logs into system chat messages.
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

  // Dynamic bot reactive commentaries
  try {
    handleBotChatInteractions(io, room, events);
  } catch (err) {
    console.error("[Bot Chat Interactions Error]", err);
  }
};

const handleBotChatInteractions = (io, room, events) => {
  if (!events || events.length === 0) return;

  events.forEach((ev) => {
    // 1. Rent Paid Hook
    if (ev.type === 'RENT_PAID') {
      const { payerId, ownerId, amount } = ev.payload;
      const payer = room.players.find(p => p.id === payerId);
      const owner = room.players.find(p => p.id === ownerId);

      if (payer && owner) {
        if (owner.isBot && !payer.isBot) {
          // Bot is receiving rent from human
          const botQuotes = [
            `Thanks for the rent, @${payer.username}! Please visit again! 💸`,
            `A pleasure doing business with you, @${payer.username}! That really boosts my reserves! 💰`,
            `A premium location deserves premium rent, @${payer.username}! 😉`
          ];
          const quote = botQuotes[Math.floor(Math.random() * botQuotes.length)];
          setTimeout(() => {
            sendBotChatMessage(io, room, owner.id, quote);
          }, 1500);
        } else if (payer.isBot && !owner.isBot) {
          // Bot is paying rent to human
          const botQuotes = [
            `Ouch! That really hurt my balance sheet, @${owner.username}... 😭`,
            `₹${amount} is a steep price for a single night! 🏨`,
            `Well played, @${owner.username}. You built a fine trap here! 👏`
          ];
          const quote = botQuotes[Math.floor(Math.random() * botQuotes.length)];
          setTimeout(() => {
            sendBotChatMessage(io, room, payer.id, quote);
          }, 1500);
        }
      }
    }
    
    // 2. Bankruptcy Hook
    else if (ev.type === 'BANKRUPTCY') {
      const { playerId } = ev.payload;
      const bankruptPlayer = room.players.find(p => p.id === playerId);
      if (bankruptPlayer) {
        if (bankruptPlayer.isBot) {
          setTimeout(() => {
            sendBotChatMessage(io, room, bankruptPlayer.id, "Alas, my business empire has collapsed. Well played, everyone! 🏳️");
          }, 2000);
        } else {
          // human player went bankrupt, let an active bot comment
          const activeBot = room.players.find(p => p.isBot && !p.isBankrupt && room.gameState?.players[p.id] && !room.gameState.players[p.id].isBankrupt);
          if (activeBot) {
            setTimeout(() => {
              sendBotChatMessage(io, room, activeBot.id, `Ah, the harsh reality of the Indian market. Tough luck, @${bankruptPlayer.username}! You played well. 🤝`);
            }, 2000);
          }
        }
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

    const player = room.players.find(p => p.id === cp.id);
    if (player && !player.isBot) {
      player.autoplay = true;
      saveRoom(room);
      io.to(room.code).emit('room-updated', envelope(true, { room: lobbySnapshot(room) }));

      const sysMsg = {
        id:       `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerId: 'system',
        username: 'System',
        text:     `🤖 ${player.username} is AFK. AI Autoplay has been enabled.`,
        ts:       Date.now(),
        isSystem: true
      };
      room.chatHistory.push(sysMsg);
      io.to(room.code).emit('receive-message', envelope(true, { message: sysMsg }));
    }

    const result = skipAfkTurn(room.gameState, cp.id);
    if (result.ok) {
      broadcastEvents(io, room, result.events);
      broadcastGameState(io, room);
      startAfkTimer(io, room);   // restart for next player
      triggerBotCycle(io, room); // trigger bot cycle
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
  (room.spectators || []).forEach((p) => socketToRoom.delete(p.socketId));
  rooms.delete(room.code);
  io.to(room.code).emit('room-destroyed', envelope(true, { code: room.code }));
  deleteRoom(room.code);
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

  // CHECK IF HOST WAS KICKED BY VOTE
  if (room.gameState && room.gameState.hostKickedPending) {
    const hostId = room.hostId;
    const hostPlayer = room.players.find((p) => p.id === hostId);
    if (hostPlayer) {
      // Find the next human player to assign host privilege to
      const nextHost = room.players.find((p) => p.id !== hostId && !p.isBot);
      if (nextHost) {
        room.hostId = nextHost.id;
        console.log(`[room] Host kicked. Reassigned host role to ${nextHost.username}`);
      }

      // Remove kicked host from room players
      room.players = room.players.filter((p) => p.id !== hostId);
      socketToRoom.delete(hostPlayer.socketId);

      // Notify host socket they were kicked
      io.to(hostPlayer.socketId).emit('kicked', envelope(true, { code: room.code }));

      // Make host socket leave Socket.io room
      const hostSocket = io.sockets.sockets.get(hostPlayer.socketId);
      if (hostSocket) hostSocket.leave(room.code);

      // Send a separate player-left event to other players
      io.to(room.code).emit('player-left', envelope(true, {
        playerId: hostId,
        username: hostPlayer.username,
        room: lobbySnapshot(room),
      }));
    }
    room.gameState.hostKickedPending = false;
  }

  broadcastEvents(io, room, result.events);
  broadcastGameState(io, room);

  // Restart AFK timer after every successful action
  startAfkTimer(io, room);

  triggerBotCycle(io, room);

  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// BOT DECISIONS & HEURISTICS
// ─────────────────────────────────────────────────────────────────────────────

const _completesMonopolyForPlayer = (gameState, playerId, tileId) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile || !tile.group) return false;
  const groupTiles = BOARD_TILES.filter(t => t.group === tile.group);
  return groupTiles.every(t => t.id === tileId || gameState.properties[t.id].ownerId === playerId);
};

// Realistic Bot Helpers
const _isGroupHotForOthers = (gameState, botId, group) => {
  if (!group) return false;
  const groupTiles = BOARD_TILES.filter(t => t.group === group);
  const ownerCounts = {};
  for (const t of groupTiles) {
    const ownerId = gameState.properties[t.id]?.ownerId;
    if (ownerId && ownerId !== botId) {
      ownerCounts[ownerId] = (ownerCounts[ownerId] || 0) + 1;
    }
  }
  for (const [ownerId, count] of Object.entries(ownerCounts)) {
    const totalInGroup = groupTiles.length;
    if (count === totalInGroup - 1) {
      return true;
    }
  }
  return false;
};

const sendBotChatMessage = (io, room, botId, text) => {
  const botPlayer = room.players.find(p => p.id === botId);
  if (!botPlayer) return;

  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerId: botId,
    username: botPlayer.username,
    text: text,
    ts: Date.now()
  };

  room.chatHistory.push(message);
  if (room.chatHistory.length > MAX_CHAT_HISTORY) {
    room.chatHistory.splice(0, room.chatHistory.length - MAX_CHAT_HISTORY);
  }

  io.to(room.code).emit('receive-message', envelope(true, { message }));
  saveRoom(room);
};

const proposeBotTradeProactive = (io, room, botId) => {
  const gameState = room.gameState;
  if (!gameState) return false;

  // Avoid proposing trades if a trade is already active
  if (gameState.activeTrade) return false;

  // Reset or check turn flag
  if (room.lastProposedTradeTurnIdx === gameState.currentTurnIdx) {
    return false;
  }

  const player = gameState.players[botId];
  if (!player || player.isBankrupt || player.money < 500) return false;

  const difficulty = player.difficulty || 'medium';

  // 1. Proactive property-for-property swap (Hard bots only)
  if (difficulty === 'hard') {
    for (const opponentId of Object.keys(gameState.players)) {
      const opponent = gameState.players[opponentId];
      if (opponentId !== botId && !opponent.isBankrupt && !opponent.isBot) {
        // Find properties bot owns that completes opponent's monopoly
        const botPropsToGive = Object.keys(gameState.properties).filter(id => {
          const propState = gameState.properties[id];
          return propState.ownerId === botId && _completesMonopolyForPlayer(gameState, opponentId, Number(id));
        }).map(Number);

        // Find properties opponent owns that completes bot's monopoly
        const opponentPropsToGet = Object.keys(gameState.properties).filter(id => {
          const propState = gameState.properties[id];
          return propState.ownerId === opponentId && _completesMonopolyForPlayer(gameState, botId, Number(id));
        }).map(Number);

        if (botPropsToGive.length > 0 && opponentPropsToGet.length > 0) {
          const giveTileId = botPropsToGive[0];
          const getTileId = opponentPropsToGet[0];
          const giveTile = TILE_BY_ID[giveTileId];
          const getTile = TILE_BY_ID[getTileId];

          room.lastProposedTradeTurnIdx = gameState.currentTurnIdx;
          console.log(`🤖 Bot ${player.username} proposing property swap to ${opponent.username}: giving ${giveTile.name} for ${getTile.name}`);
          
          sendBotChatMessage(io, room, botId, `Hey @${opponent.username}, let's make a win-win deal! I'll swap my ${giveTile.name} for your ${getTile.name}. It completes a set for both of us! 🤝`);

          _dispatch(io, null, room, botId, initiateTrade, [
            opponentId,
            { money: 0, propertyIds: [giveTileId] },
            { money: 0, propertyIds: [getTileId] }
          ]);
          return true;
        }
      }
    }
  }

  // 2. Proactive cash-for-property trade (Medium & Hard bots)
  if (difficulty !== 'easy') {
    // Find color groups we want to complete
    const groups = {};
    for (const tile of BOARD_TILES) {
      if (tile.group) {
        if (!groups[tile.group]) groups[tile.group] = [];
        groups[tile.group].push(tile.id);
      }
    }

    // Analyze each group
    for (const [groupName, tileIds] of Object.entries(groups)) {
      const ownedByBot = tileIds.filter(id => gameState.properties[id]?.ownerId === botId);
      const totalInGroup = tileIds.length;

      // We own part of the group, but not all (not a monopoly yet)
      if (ownedByBot.length > 0 && ownedByBot.length < totalInGroup) {
        // Find the missing tile(s)
        const missingIds = tileIds.filter(id => {
          const pState = gameState.properties[id];
          return pState && pState.ownerId && pState.ownerId !== botId;
        });

        if (missingIds.length === 1) {
          const missingId = missingIds[0];
          const targetOwnerId = gameState.properties[missingId].ownerId;
          const targetOwner = gameState.players[targetOwnerId];

          if (targetOwner && !targetOwner.isBankrupt && !targetOwner.isBot) {
            // We can propose to this human player!
            const missingTile = TILE_BY_ID[missingId];
            const cashOffer = Math.floor(missingTile.price * 1.35);

            if (player.money >= cashOffer + 400) {
              // Propose trade!
              room.lastProposedTradeTurnIdx = gameState.currentTurnIdx;
              console.log(`🤖 Bot ${player.username} proposing trade to ${targetOwner.username}: offering ${cashOffer} for ${missingTile.name}`);

              // Broadcast trade commentary
              sendBotChatMessage(io, room, botId, `Hey @${targetOwner.username}, I really want to complete my ${groupName} set. I'll offer you ₹${cashOffer} for ${missingTile.name}. What do you say? 🤝`);

              _dispatch(io, null, room, botId, initiateTrade, [
                targetOwnerId,
                { money: cashOffer, propertyIds: [] },
                { money: 0, propertyIds: [missingId] }
              ]);
              return true;
            }
          }
        }
      }
    }
  }

  return false;
};

const raiseBotCash = (io, room, botId) => {
  const gameState = room.gameState;
  const player = gameState.players[botId];
  if (player.money >= 0) return false;

  // 1. Sell hotels
  for (const tileId of Object.keys(gameState.properties)) {
    const prop = gameState.properties[tileId];
    if (prop.ownerId === botId && prop.hotel) {
      console.log(`🤖 Bot ${player.username} selling hotel on tile ${tileId}`);
      const success = _dispatch(io, null, room, botId, sellHotel, [Number(tileId)]);
      if (success) return true;
    }
  }

  // 2. Sell houses
  for (const tileId of Object.keys(gameState.properties)) {
    const prop = gameState.properties[tileId];
    if (prop.ownerId === botId && prop.houses > 0) {
      console.log(`🤖 Bot ${player.username} selling house on tile ${tileId}`);
      const success = _dispatch(io, null, room, botId, sellHouse, [Number(tileId)]);
      if (success) return true;
    }
  }

  // 3. Mortgage properties not part of a monopoly first
  const myProperties = Object.keys(gameState.properties).filter(tileId => {
    const prop = gameState.properties[tileId];
    return prop.ownerId === botId && !prop.mortgaged;
  }).map(Number);

  if (myProperties.length > 0) {
    myProperties.sort((a, b) => {
      const monA = hasMonopoly(gameState.properties, botId, a);
      const monB = hasMonopoly(gameState.properties, botId, b);
      if (monA && !monB) return 1;
      if (!monA && monB) return -1;
      return 0;
    });

    for (const targetTileId of myProperties) {
      console.log(`🤖 Bot ${player.username} mortgaging tile ${targetTileId}`);
      const success = _dispatch(io, null, room, botId, mortgageProperty, [targetTileId]);
      if (success) return true;
    }
  }

  // 4. Take loan if not active (strategic/emergency necessity)
  if (!player.loanActive) {
    const debt = -player.money;
    const amount = Math.min(5000, Math.max(500, Math.ceil(debt / 500) * 500));
    console.log(`🤖 Bot ${player.username} taking loan of ${amount} to resolve debt of ${debt}`);
    const success = _dispatch(io, null, room, botId, takeLoan, [amount]);
    if (success) return true;
  }

  // 5. Declare bankruptcy if no assets left
  console.log(`🤖 Bot ${player.username} declaring bankruptcy`);
  return _dispatch(io, null, room, botId, declareBankruptcy, []);
};

const _getDynamicUpgradeReserve = (gameState, player) => {
  const difficulty = player.difficulty || 'medium';
  if (difficulty === 'easy') {
    return 3000;
  }
  // Hard/Medium bots maintain ₹3000 - ₹5000 reserve cash dynamically
  let baseReserve = difficulty === 'hard' ? 4000 : 3000;
  let opponentRentMultiplier = difficulty === 'hard' ? 0.35 : 0.50;

  // Find the highest current rent of any active opponent's properties to protect against immediate bankruptcy
  let maxOpponentRent = 0;
  for (const [tileId, propState] of Object.entries(gameState.properties)) {
    if (propState.ownerId && propState.ownerId !== player.id && !propState.mortgaged) {
      const tile = TILE_BY_ID[tileId];
      if (tile) {
        let rent = 0;
        if (tile.houseCost) {
          const houses = propState.houses || 0;
          const hotel = propState.hotel || false;
          if (hotel) {
            rent = tile.rent[5];
          } else {
            rent = tile.rent[houses];
          }
        }
        if (rent > maxOpponentRent) {
          maxOpponentRent = rent;
        }
      }
    }
  }

  return Math.min(5000, baseReserve + Math.floor(maxOpponentRent * opponentRentMultiplier));
};

const upgradeBotProperties = (io, room, botId) => {
  const gameState = room.gameState;
  const player = gameState.players[botId];
  if (!player) return false;

  const reserve = _getDynamicUpgradeReserve(gameState, player);
  if (player.money < reserve) return false;

  // Evaluate candidate properties to upgrade and sort by highest rent increase first (Positive ROI optimization)
  const upgradeCandidates = [];

  for (const tileId of Object.keys(gameState.properties)) {
    const tile = TILE_BY_ID[tileId];
    if (!tile || !tile.houseCost) continue;

    const propId = Number(tileId);
    const checkHotel = canBuildHotel(gameState.properties, botId, propId, player.position);
    if (checkHotel.canBuild && player.money >= reserve + tile.houseCost) {
      // Rent increase from 4 houses to hotel
      const rentDiff = tile.rent[5] - tile.rent[4];
      upgradeCandidates.push({ tileId: propId, type: 'hotel', cost: tile.houseCost, rentDiff, roi: rentDiff / tile.houseCost });
    }

    const checkHouse = canBuildHouse(gameState.properties, botId, propId, player.position);
    if (checkHouse.canBuild && player.money >= reserve + tile.houseCost) {
      const currentHouses = gameState.properties[tileId].houses || 0;
      const rentDiff = tile.rent[currentHouses + 1] - tile.rent[currentHouses];
      upgradeCandidates.push({ tileId: propId, type: 'house', cost: tile.houseCost, rentDiff, roi: rentDiff / tile.houseCost });
    }
  }

  if (upgradeCandidates.length === 0) return false;

  // Prioritize highest rent difference/ROI first
  upgradeCandidates.sort((a, b) => b.rentDiff - a.rentDiff);

  const bestUpgrade = upgradeCandidates[0];
  if (bestUpgrade.type === 'hotel') {
    console.log(`🤖 Bot ${player.username} upgrading to hotel on tile ${bestUpgrade.tileId} (rent diff: ${bestUpgrade.rentDiff}, reserve: ${reserve})`);
    return _dispatch(io, null, room, botId, buildHotel, [bestUpgrade.tileId]);
  } else {
    console.log(`🤖 Bot ${player.username} building house on tile ${bestUpgrade.tileId} (rent diff: ${bestUpgrade.rentDiff}, reserve: ${reserve})`);
    return _dispatch(io, null, room, botId, buildHouse, [bestUpgrade.tileId]);
  }
};

const executeBotAuctionDecision = async (io, room, botId) => {
  const gameState = room.gameState;
  const auction = gameState.activeAuction;
  if (!auction) return;

  const player = gameState.players[botId];
  if (!player || player.isBankrupt) return;

  const tile = TILE_BY_ID[auction.tileId];
  
  // Dynamic strategic ceiling calculations based on bot difficulty
  const difficulty = player.difficulty || 'medium';
  let ceilingFactor = 0.80 + Math.random() * 0.10; // Default Medium
  let completesBoost = 1.25;
  let defensiveBoost = 1.05;

  if (difficulty === 'easy') {
    ceilingFactor = 0.50 + Math.random() * 0.15;
    completesBoost = 0.75;
    defensiveBoost = 0.65;
  } else if (difficulty === 'hard') {
    ceilingFactor = 0.95 + Math.random() * 0.15;
    completesBoost = 1.60;
    defensiveBoost = 1.35;
    // Cash-rich extra aggressive bidding
    if (player.money > 3000) {
      const cashBoost = Math.min(0.35, (player.money / 20000) * 0.20);
      ceilingFactor += cashBoost;
    }
  }

  let isSpecialBid = false;
  let chatComment = '';

  if (_completesMonopolyForPlayer(gameState, botId, auction.tileId)) {
    ceilingFactor = Math.max(ceilingFactor, completesBoost);
    isSpecialBid = true;
    chatComment = `This completes my monopoly on ${tile.group}! I am going all in! 🚀`;
  } else if (_isGroupHotForOthers(gameState, botId, tile.group)) {
    ceilingFactor = Math.max(ceilingFactor, defensiveBoost);
    isSpecialBid = true;
    chatComment = `Not so fast! I can't let you get a monopoly on ${tile.group} that easily! 😉`;
  }

  // Cap auction ceiling to ensure bot retains reserve cash unless completing a monopoly
  let targetCeiling = Math.floor(tile.price * ceilingFactor);
  if (!isSpecialBid && player.money - targetCeiling < 2000) {
    // If not completing monopoly or defensive block, keep a basic cash buffer
    targetCeiling = Math.max(0, player.money - 2000);
  }

  // Random human-like increments: 50, 100, 150, or 200
  const possibleIncrements = [50, 100, 150, 200];
  const randInc = possibleIncrements[Math.floor(Math.random() * possibleIncrements.length)];
  const nextBid = auction.highBid + randInc;

  if (auction.highBid < targetCeiling && player.money >= nextBid) {
    console.log(`🤖 Bot ${player.username} placing auction bid of ${nextBid} for ${tile.name} (ceiling: ${targetCeiling})`);
    
    // Post chat commentary occasionally or during high stakes
    if (isSpecialBid && Math.random() < 0.6) {
      sendBotChatMessage(io, room, botId, chatComment);
    } else if (Math.random() < 0.15) {
      sendBotChatMessage(io, room, botId, `I'll raise to ₹${nextBid} for ${tile.name}! 📈`);
    }

    _dispatch(io, null, room, botId, placeBid, [nextBid]);
  } else {
    console.log(`🤖 Bot ${player.username} passing on auction for ${tile.name} (highBid: ${auction.highBid}, ceiling: ${targetCeiling})`);
    if (Math.random() < 0.15) {
      sendBotChatMessage(io, room, botId, `I'm out of this auction for ${tile.name}. Too rich for my blood! 💸`);
    }
    _dispatch(io, null, room, botId, passAuction, []);
  }
};

const _getTileTradeValue = (gameState, viewerId, otherPlayerId, tileId, isGivingAway) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile) return 0;
  
  let val = tile.price;
  const propState = gameState.properties[tileId];
  if (propState && propState.houses > 0) {
    val += (propState.houses * tile.houseCost) / 2;
  }

  if (tile.type === 'railway') {
    const otherRailwaysCount = BOARD_TILES.filter(t => t.id !== tileId && t.type === 'railway' && gameState.properties[t.id]?.ownerId === viewerId).length;
    if (otherRailwaysCount === 1) val *= 1.25;
    else if (otherRailwaysCount === 2) val *= 1.6;
    else if (otherRailwaysCount === 3) val *= 2.0;
  } else if (tile.type === 'utility') {
    const otherUtilitiesCount = BOARD_TILES.filter(t => t.id !== tileId && t.type === 'utility' && gameState.properties[t.id]?.ownerId === viewerId).length;
    if (otherUtilitiesCount === 1) val *= 1.8;
  } else if (tile.group) {
    if (isGivingAway) {
      if (hasMonopoly(gameState.properties, viewerId, tileId)) {
        val *= 2.0;
      } else if (_completesMonopolyForPlayer(gameState, otherPlayerId, tileId)) {
        val *= 1.8;
      }
    } else {
      if (_completesMonopolyForPlayer(gameState, viewerId, tileId)) {
        val *= 1.8;
      } else {
        const inSameGroup = BOARD_TILES.some(t => t.id !== tileId && t.group === tile.group && gameState.properties[t.id]?.ownerId === viewerId);
        if (inSameGroup) {
          val *= 1.35;
        }
      }
    }
  }

  return val;
};

const evaluateBotTradeDecision = async (io, room, botId) => {
  const gameState = room.gameState;
  const trade = gameState.activeTrade;
  if (!trade || trade.status !== 'pending') return;

  const player = gameState.players[botId];
  if (!player || player.isBankrupt) return;

  // Proposer gives to bot:
  let receiveVal = trade.offer.money ?? 0;
  for (const propId of (trade.offer.propertyIds ?? [])) {
    receiveVal += _getTileTradeValue(gameState, botId, trade.fromPlayerId, propId, false);
  }

  // Bot gives to proposer:
  let giveVal = trade.request.money ?? 0;
  for (const propId of (trade.request.propertyIds ?? [])) {
    giveVal += _getTileTradeValue(gameState, botId, trade.fromPlayerId, propId, true);
  }

  console.log(`🤖 Bot ${player.username} trade evaluation: receiveVal = ${receiveVal}, giveVal = ${giveVal}`);

  if (receiveVal >= 0.90 * giveVal) {
    console.log(`🤖 Bot ${player.username} accepting trade proposal`);
    sendBotChatMessage(io, room, botId, "This looks like a fair deal! I accept. Let's make progress! 🤝");
    _dispatch(io, null, room, botId, acceptTrade, []);
  } else {
    console.log(`🤖 Bot ${player.username} rejecting trade proposal`);

    // Determine specific reason for rejection
    let breaksMonopolyTile = null;
    let completesProposerMonopolyTile = null;
    let botWantsToKeepTile = null;

    for (const propId of (trade.request.propertyIds ?? [])) {
      const tile = TILE_BY_ID[propId];
      if (!tile) continue;
      if (hasMonopoly(gameState.properties, botId, propId)) {
        breaksMonopolyTile = tile;
        break;
      }
      if (_completesMonopolyForPlayer(gameState, trade.fromPlayerId, propId)) {
        completesProposerMonopolyTile = tile;
      }
      const inSameGroup = tile.group ? BOARD_TILES.some(t => t.id !== propId && t.group === tile.group && gameState.properties[t.id]?.ownerId === botId) : false;
      if (inSameGroup) {
        botWantsToKeepTile = tile;
      }
    }

    let rejectReason = "Sorry, that trade doesn't make sense for me. I'll have to reject. ❌";
    if (breaksMonopolyTile) {
      rejectReason = `I cannot accept this trade because giving away ${breaksMonopolyTile.name} would break my monopoly on that color group! ❌`;
    } else if (completesProposerMonopolyTile && receiveVal < 1.5 * giveVal) {
      rejectReason = `Giving you ${completesProposerMonopolyTile.name} would complete a Monopoly for you! You'll need to offer a much larger cash premium for me to consider that. ❌`;
    } else if (botWantsToKeepTile && receiveVal < giveVal) {
      rejectReason = `I am currently trying to collect the rest of the properties in the color group for ${botWantsToKeepTile.name}, so I'd need a much better offer to let it go. ❌`;
    } else if (receiveVal < giveVal) {
      const ratio = Math.round((receiveVal / (giveVal || 1)) * 100);
      const fmtVal = (v) => Math.round(v).toLocaleString('en-IN');
      rejectReason = `This trade is too lopsided. The value I receive is only about ${ratio}% of what I'm giving away (giving value ₹${fmtVal(giveVal)} vs receiving ₹${fmtVal(receiveVal)}). ❌`;
    }

    sendBotChatMessage(io, room, botId, rejectReason);
    _dispatch(io, null, room, botId, rejectTrade, []);
  }
};

const executeBotTurn = async (io, room, botId) => {
  const gameState = room.gameState;
  const player = gameState.players[botId];
  if (!player || player.isBankrupt) return;

  const currentTile = TILE_BY_ID[player.position] || { name: 'Start/Unknown' };

  // 1. Debt raising check
  if (player.money < 0) {
    console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Raise Cash\n`);
    raiseBotCash(io, room, botId);
    return;
  }

  // 2. Jail handling: evaluate staying jailed based on game stage
  if (player.inJail) {
    if (!gameState.hasRolled) {
      // Escape jail heuristics
      const totalPropertiesOwnedByAll = Object.values(gameState.properties).filter(p => p.ownerId).length;
      const isEarlyGame = totalPropertiesOwnedByAll < 15; // Stay jailed is strategic in late game, escape is priority early game

      if (player.jailCard) {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Escape Jail (Jail Card)\n`);
        _dispatch(io, null, room, botId, useJailCard, []);
      } else if (isEarlyGame && player.money >= 1000) {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Escape Jail (Pay Fine)\n`);
        _dispatch(io, null, room, botId, payJailFine, []);
      } else {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Escape Jail (Stay Jailed & Roll Dice)\n`);
        _dispatch(io, null, room, botId, rollDice, []);
      }
    } else {
      console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: End Turn (Still in Jail)\n`);
      _dispatch(io, null, room, botId, endTurn, []);
    }
    return;
  }

  // 3. Normal turn execution
  if (!gameState.hasRolled) {
    console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Roll Dice\n`);
    _dispatch(io, null, room, botId, rollDice, []);
  } else {
    // Already rolled
    if (gameState.pendingAction === 'buy_decision') {
      const tile = TILE_BY_ID[player.position];
      
      // Property purchase AI decision scoring
      let shouldBuy = false;
      if (tile && player.money >= tile.price) {
        const difficulty = player.difficulty || 'medium';
        const completesMonopoly = _completesMonopolyForPlayer(gameState, botId, player.position);
        
        // Always buy if it completes a monopoly, or if player has a healthy cash reserve after purchase
        const minReserveLimit = difficulty === 'easy' ? 1000 : 3000;
        if (completesMonopoly || (player.money - tile.price >= minReserveLimit)) {
          shouldBuy = true;
        } else if (tile.type === 'railway' || tile.type === 'utility') {
          // Railways and utilities are good passive income generators, buy if money is above ₹1500
          if (player.money - tile.price >= 1500) {
            shouldBuy = true;
          }
        }
      }

      if (shouldBuy) {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Buy Property (${tile.name})\n`);
        _dispatch(io, null, room, botId, buyProperty, []);
      } else {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Decline Property & End Turn\n`);
        _dispatch(io, null, room, botId, endTurn, []);
      }
    } else if (gameState.pendingAction === null) {
      const upgraded = upgradeBotProperties(io, room, botId);
      if (upgraded) {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Build/Upgrade Property\n`);
        return;
      }

      // Proactive trade check
      const tradeProposed = proposeBotTradeProactive(io, room, botId);
      if (tradeProposed) {
        console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Propose Trade\n`);
        return;
      }

      console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: End Turn\n`);
      _dispatch(io, null, room, botId, endTurn, []);
    } else {
      console.log(`\n🤖 [BOT]\nName: ${player.username}\nMoney: ₹${player.money}\nTile: ${currentTile.name}\nDecision: Unhandled state (Pending Action: ${gameState.pendingAction}). Watchdog will handle if stuck.\n`);
    }
  }
};

const triggerBotCycle = (io, room) => {
  if (!room.gameState || room.gameState.status !== 'playing') return;

  // 0. Check if there is an active end game vote
  const endGameVote = room.gameState.endGameVote;
  if (endGameVote) {
    if (room.botExecutingEndGameVote) return;
    const botToAct = room.players.find(p => 
      (p.isBot || p.autoplay || !p.connected) && 
      !room.gameState.players[p.id]?.isBankrupt &&
      endGameVote.votes[p.id] === undefined
    );

    if (botToAct) {
      // 0.1 Watchdog for End Game Vote
      if (!room.botEndGameVoteStartAt || room.botEndGameVoteActivePlayerId !== botToAct.id) {
        room.botEndGameVoteStartAt = Date.now();
        room.botEndGameVoteActivePlayerId = botToAct.id;
        room.botEndGameVoteAttempts = 0;
      }
      room.botEndGameVoteAttempts = (room.botEndGameVoteAttempts || 0) + 1;

      if (Date.now() - room.botEndGameVoteStartAt > 5000 || room.botEndGameVoteAttempts > 5) {
        console.error(`🚨 [Bot Watchdog] Bot/Autoplay player ${botToAct.username} end-game vote exceeded limit! Forcing YES vote.`);
        
        try {
          const result = voteEndGame(room.gameState, botToAct.id, true);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
          }
        } catch (e) {
          console.error('[Bot Watchdog End Game Vote Recovery Error]', e);
        }
        
        room.botEndGameVoteStartAt = null;
        room.botEndGameVoteActivePlayerId = null;
        room.botEndGameVoteAttempts = 0;
        room.botExecutingEndGameVote = false;
        triggerBotCycle(io, room);
        return;
      }

      room.botExecutingEndGameVote = true;
      setTimeout(async () => {
        try {
          const curr = room.players.find(p => p.id === botToAct.id);
          if (curr && (curr.isBot || curr.autoplay || !curr.connected)) {
            console.log(`🤖 Bot ${botToAct.username} automatically voting YES to end game request`);
            _dispatch(io, null, room, botToAct.id, voteEndGame, [true]);
          } else {
            console.log(`[Bot End Game Vote] Player ${botToAct.id} reconnected. Aborting YES vote.`);
          }
        } catch (err) {
          console.error('[Bot End Game Vote Error]', err);
          try {
            const result = voteEndGame(room.gameState, botToAct.id, true);
            if (result.ok) {
              broadcastEvents(io, room, result.events);
              broadcastGameState(io, room);
            }
          } catch (recoveryErr) {
            console.error('[Bot End Game Vote Recovery Error]', recoveryErr);
          }
        } finally {
          room.botExecutingEndGameVote = false;
          room.botEndGameVoteStartAt = null;
          room.botEndGameVoteActivePlayerId = null;
          room.botEndGameVoteAttempts = 0;
          triggerBotCycle(io, room);
        }
      }, 1500);
      return;
    }
  }

  // 0.1. Check if there is an active kick host vote
  const kickHostVote = room.gameState.kickHostVote;
  if (kickHostVote) {
    if (room.botExecutingKickHostVote) return;
    const botToAct = room.players.find(p => 
      (p.isBot || p.autoplay || !p.connected) && 
      !room.gameState.players[p.id]?.isBankrupt &&
      p.id !== kickHostVote.targetId &&
      kickHostVote.votes[p.id] === undefined
    );

    if (botToAct) {
      // 0.2 Watchdog for Kick Host Vote
      if (!room.botKickHostVoteStartAt || room.botKickHostVoteActivePlayerId !== botToAct.id) {
        room.botKickHostVoteStartAt = Date.now();
        room.botKickHostVoteActivePlayerId = botToAct.id;
        room.botKickHostVoteAttempts = 0;
      }
      room.botKickHostVoteAttempts = (room.botKickHostVoteAttempts || 0) + 1;

      if (Date.now() - room.botKickHostVoteStartAt > 5000 || room.botKickHostVoteAttempts > 5) {
        console.error(`🚨 [Bot Watchdog] Bot/Autoplay player ${botToAct.username} kick-host vote exceeded limit! Forcing YES vote.`);
        
        try {
          const result = voteKickHost(room.gameState, botToAct.id, true);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
          }
        } catch (e) {
          console.error('[Bot Watchdog Kick Host Vote Recovery Error]', e);
        }
        
        room.botKickHostVoteStartAt = null;
        room.botKickHostVoteActivePlayerId = null;
        room.botKickHostVoteAttempts = 0;
        room.botExecutingKickHostVote = false;
        triggerBotCycle(io, room);
        return;
      }

      room.botExecutingKickHostVote = true;
      setTimeout(async () => {
        try {
          const curr = room.players.find(p => p.id === botToAct.id);
          if (curr && (curr.isBot || curr.autoplay || !curr.connected)) {
            console.log(`🤖 Bot ${botToAct.username} automatically voting YES to kick host request`);
            _dispatch(io, null, room, botToAct.id, voteKickHost, [true]);
          } else {
            console.log(`[Bot Kick Host Vote] Player ${botToAct.id} reconnected. Aborting YES vote.`);
          }
        } catch (err) {
          console.error('[Bot Kick Host Vote Error]', err);
          try {
            const result = voteKickHost(room.gameState, botToAct.id, true);
            if (result.ok) {
              broadcastEvents(io, room, result.events);
              broadcastGameState(io, room);
            }
          } catch (recoveryErr) {
            console.error('[Bot Kick Host Vote Recovery Error]', recoveryErr);
          }
        } finally {
          room.botExecutingKickHostVote = false;
          room.botKickHostVoteStartAt = null;
          room.botKickHostVoteActivePlayerId = null;
          room.botKickHostVoteAttempts = 0;
          triggerBotCycle(io, room);
        }
      }, 1500);
      return;
    }
  }

  if (room.botExecutingAction) return;

  // 1. Check if there is an active auction and a bot needs to act
  const auction = room.gameState.activeAuction;
  if (auction) {
    const botToAct = room.players.find(p => 
      (p.isBot || p.autoplay || !p.connected) && 
      auction.participants.includes(p.id) && 
      !auction.passedPlayers.includes(p.id) && 
      auction.highBidderId !== p.id
    );

    if (botToAct) {
      // 1.1 Watchdog for Auction
      if (!room.botAuctionStartAt || room.botAuctionActivePlayerId !== botToAct.id) {
        room.botAuctionStartAt = Date.now();
        room.botAuctionActivePlayerId = botToAct.id;
        room.botAuctionAttempts = 0;
      }
      room.botAuctionAttempts = (room.botAuctionAttempts || 0) + 1;

      if (Date.now() - room.botAuctionStartAt > 5000 || room.botAuctionAttempts > 5) {
        console.error(`🚨 [Bot Watchdog] Bot/Autoplay player ${botToAct.username} auction decision exceeded limit! Forcing pass.`);
        
        try {
          const result = passAuction(room.gameState, botToAct.id);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
          }
        } catch (e) {
          console.error('[Bot Watchdog Auction Recovery Error]', e);
        }

        room.botAuctionStartAt = null;
        room.botAuctionActivePlayerId = null;
        room.botAuctionAttempts = 0;
        room.botExecutingAction = false;
        triggerBotCycle(io, room);
        return;
      }

      room.botExecutingAction = true;
      setTimeout(async () => {
        try {
          const curr = room.players.find(p => p.id === botToAct.id);
          if (curr && (curr.isBot || curr.autoplay || !curr.connected)) {
            await executeBotAuctionDecision(io, room, botToAct.id);
          } else {
            console.log(`[Bot Auction] Player ${botToAct.id} reconnected. Aborting bot auction decision.`);
          }
        } catch (err) {
          console.error('[Bot Auction Error]', err);
          try {
            const result = passAuction(room.gameState, botToAct.id);
            if (result.ok) {
              broadcastEvents(io, room, result.events);
              broadcastGameState(io, room);
            }
          } catch (recoveryErr) {
            console.error('[Bot Auction Recovery Pass Error]', recoveryErr);
          }
        } finally {
          room.botExecutingAction = false;
          room.botAuctionStartAt = null;
          room.botAuctionActivePlayerId = null;
          room.botAuctionAttempts = 0;
          triggerBotCycle(io, room);
        }
      }, 1500);
      return;
    }
  }

  // 2. Check if there is an active pending trade proposed to a bot
  const trade = room.gameState.activeTrade;
  if (trade && trade.status === 'pending') {
    const botToAct = room.players.find(p => (p.isBot || p.autoplay || !p.connected) && p.id === trade.toPlayerId);
    if (botToAct) {
      // 2.1 Watchdog for Trade
      if (!room.botTradeStartAt || room.botTradeActivePlayerId !== botToAct.id) {
        room.botTradeStartAt = Date.now();
        room.botTradeActivePlayerId = botToAct.id;
        room.botTradeAttempts = 0;
      }
      room.botTradeAttempts = (room.botTradeAttempts || 0) + 1;

      if (Date.now() - room.botTradeStartAt > 5000 || room.botTradeAttempts > 5) {
        console.error(`🚨 [Bot Watchdog] Bot/Autoplay player ${botToAct.username} trade decision exceeded limit! Forcing reject.`);
        
        try {
          const result = rejectTrade(room.gameState, botToAct.id);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
          }
        } catch (e) {
          console.error('[Bot Watchdog Trade Recovery Error]', e);
        }

        room.botTradeStartAt = null;
        room.botTradeActivePlayerId = null;
        room.botTradeAttempts = 0;
        room.botExecutingAction = false;
        triggerBotCycle(io, room);
        return;
      }

      room.botExecutingAction = true;
      setTimeout(async () => {
        try {
          const curr = room.players.find(p => p.id === botToAct.id);
          if (curr && (curr.isBot || curr.autoplay || !curr.connected)) {
            await evaluateBotTradeDecision(io, room, botToAct.id);
          } else {
            console.log(`[Bot Trade] Player ${botToAct.id} reconnected. Aborting bot trade decision.`);
          }
        } catch (err) {
          console.error('[Bot Trade Error]', err);
          try {
            const result = rejectTrade(room.gameState, botToAct.id);
            if (result.ok) {
              broadcastEvents(io, room, result.events);
              broadcastGameState(io, room);
            }
          } catch (recoveryErr) {
            console.error('[Bot Trade Recovery Reject Error]', recoveryErr);
          }
        } finally {
          room.botExecutingAction = false;
          room.botTradeStartAt = null;
          room.botTradeActivePlayerId = null;
          room.botTradeAttempts = 0;
          triggerBotCycle(io, room);
        }
      }, 1500);
      return;
    }
  }

  // 3. Check if it's a bot's standard turn
  const activePlayer = currentPlayer(room.gameState);
  if (activePlayer) {
    const matchingPlayer = room.players.find(p => p.id === activePlayer.id);
    if (matchingPlayer && (matchingPlayer.isBot || matchingPlayer.autoplay || !matchingPlayer.connected)) {
      const botId = activePlayer.id;

      // 3.1 Watchdog for Standard Turn
      if (!room.botTurnStartAt || room.botTurnActivePlayerId !== botId) {
        room.botTurnStartAt = Date.now();
        room.botTurnActivePlayerId = botId;
        room.botTurnAttempts = 0;
      }
      room.botTurnAttempts = (room.botTurnAttempts || 0) + 1;

      if (Date.now() - room.botTurnStartAt > 5000 || room.botTurnAttempts > 5) {
        console.error(`🚨 [Bot Watchdog] Bot/Autoplay player ${activePlayer.username} turn exceeded timeout limit or maximum attempts! Forcing turn advancement.`);

        const sysMsg = {
          id: `sys-watchdog-${Date.now()}`,
          playerId: 'system',
          username: 'System',
          text: `⚠️ [Watchdog] Forced turn transition for ${activePlayer.username} to keep the match moving.`,
          ts: Date.now(),
          isSystem: true
        };
        room.chatHistory.push(sysMsg);
        io.to(room.code).emit('receive-message', envelope(true, { message: sysMsg }));

        try {
          const result = skipAfkTurn(room.gameState);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
            startAfkTimer(io, room);
          }
        } catch (e) {
          console.error('[Bot Watchdog Turn Recovery Error]', e);
        }

        room.botTurnStartAt = null;
        room.botTurnActivePlayerId = null;
        room.botTurnAttempts = 0;
        room.botExecutingAction = false;
        triggerBotCycle(io, room);
        return;
      }

      room.botExecutingAction = true;
      const isDisconnectedHuman = !matchingPlayer.isBot && !matchingPlayer.autoplay && !matchingPlayer.connected;
      const delayMs = isDisconnectedHuman ? 8000 : 1500;

      setTimeout(async () => {
        try {
          const curr = room.players.find(p => p.id === botId);
          if (curr && (curr.isBot || curr.autoplay || !curr.connected)) {
            await executeBotTurn(io, room, botId);
          } else {
            console.log(`[Bot Turn] Player ${botId} reconnected in time. Aborting bot turn.`);
          }
        } catch (err) {
          console.error('[Bot Turn Error]', err);
          try {
            const result = skipAfkTurn(room.gameState);
            if (result.ok) {
              broadcastEvents(io, room, result.events);
              broadcastGameState(io, room);
              startAfkTimer(io, room);
            }
          } catch (recoveryErr) {
            console.error('[Bot Turn Recovery Skip Error]', recoveryErr);
          }
        } finally {
          room.botExecutingAction = false;
          room.botTurnStartAt = null;
          room.botTurnActivePlayerId = null;
          room.botTurnAttempts = 0;
          triggerBotCycle(io, room);
        }
      }, delayMs);
      return;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-CHEAT GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guard: socket must be in a room.
 * Returns { ok: boolean, room?: RoomObject }
 */
const guardInRoom = (socket) => {
  let code = socketToRoom.get(socket.id);
  if (!code) {
    // FALLBACK: Search all active rooms for a player or spectator with this socket.id
    for (const [roomCode, room] of rooms.entries()) {
      const p = findPlayerBySocket(room, socket.id);
      if (p) {
        code = roomCode;
        socketToRoom.set(socket.id, roomCode); // heal the mapping
        console.log(`[guardInRoom] Healed missing socketToRoom mapping for socket ${socket.id} in room ${roomCode}`);
        break;
      }
    }
  }
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
const mountGameSocket = (io) => {
  // Load active rooms from MongoDB at startup to recover from server reboots
  loadActiveRooms().then((loadedRooms) => {
    loadedRooms.forEach((r) => {
      rooms.set(r.code, r);
      console.log(`[db] Restored active room ${r.code} with ${r.players.length} players from database`);

      // Restore socket associations for connected players
      r.players.forEach((p) => {
        if (p.socketId && p.connected) {
          socketToRoom.set(p.socketId, r.code);
        }
      });

      // Reconstruct AFK turn timers for active matches
      if (r.status === 'playing') {
        startAfkTimer(io, r);
        triggerBotCycle(io, r);
        console.log(`[db] Restarted AFK turn timer and bot cycle for restored room ${r.code}`);
      }
    });
  }).catch((err) => {
    console.error("[db] Failed to restore active rooms on startup:", err.message);
  });

  io.on('connection', (socket) => {

    // ─── Log connection ─────────────────────────────────────────────────────
    console.log(`[socket] connected: ${socket.id}`);

    // Auto-heal socket room mapping during connection handshake if query params exist
    const handshakeRoomCode = socket.handshake.query?.roomCode;
    const handshakePlayerId = socket.handshake.query?.playerId;
    if (handshakePlayerId) {
      let trimmedCode = handshakeRoomCode ? (handshakeRoomCode + '').trim().toUpperCase() : null;
      let room = trimmedCode ? rooms.get(trimmedCode) : null;

      if (!room) {
        // Fallback: Search all active rooms for this playerId
        for (const [rCode, r] of rooms.entries()) {
          const p = r.players.find(pl => pl.id === handshakePlayerId) ||
                    (r.spectators || []).find(sp => sp.id === handshakePlayerId);
          if (p) {
            room = r;
            trimmedCode = rCode;
            break;
          }
        }
      }

      if (room) {
        const player = findPlayerById(room, handshakePlayerId);
        if (player) {
          // Clear active grace timer if it exists
          if (player._graceTimer) {
            clearTimeout(player._graceTimer);
            player._graceTimer = null;
            console.log(`[socket-connect] Cleared grace timer for ${player.username} in room ${trimmedCode}`);
          }
          // Remove old socket mapping
          if (player.socketId) {
            socketToRoom.delete(player.socketId);
          }
          // Update socket details
          player.socketId = socket.id;
          player.connected = true;
          player.disconnectedAt = null;
          player.autoplay = false;
          socketToRoom.set(socket.id, trimmedCode);
          socket.join(trimmedCode);

          // Update socketId in game state if game is running
          if (room.gameState && room.gameState.players[handshakePlayerId]) {
            room.gameState.players[handshakePlayerId].socketId = socket.id;
            room.gameState.players[handshakePlayerId].isConnected = true;
          }

          saveRoom(room);
          console.log(`[socket-connect] Auto-reconnected player ${player.username} to room ${trimmedCode}`);

          // Notify others in room
          socket.to(trimmedCode).emit('player-reconnected', envelope(true, {
            playerId: handshakePlayerId,
            username: player.username,
          }));
        }
      }
    }

    // =========================================================================
    // 1.  ROOM LIFECYCLE
    // =========================================================================

    // ── create-room ──────────────────────────────────────────────────────────
    /**
     * Client payload: { username: string }
     * Ack:            { ok, data: { room: lobbySnapshot, playerId: string } }
     */
   socket.on('create-room', async ({ username, playerId: clientPlayerId } = {}, ack) => {
  console.log('🔥 create-room event received');

  if (!username || typeof username !== 'string' || !username.trim()) {
    console.log('❌ Invalid username');
    return ackError(ack, 'username is required');
  }

  const playerId = clientPlayerId || socket.id;

  // Validate player is not banned
  const { findUserById } = require('./userModel');
  const dbUser = await findUserById(playerId);
  if (dbUser && dbUser.isBanned) {
    return ackError(ack, dbUser.banReason || 'Your profile has been suspended by the administrator.');
  }

  const trimmed = username.trim().slice(0, 20);
  const code = uniqueRoomCode();

  const room = {
    code,
    hostId: playerId,
    status: 'lobby',
    players: [
      {
        id: playerId,
        username: trimmed,
        socketId: socket.id,
        ready: false,
        connected: true,
        disconnectedAt: null,
        token: PLAYER_TOKENS[0],
      },
    ],
    gameState: null,
    afkTimer: null,
    chatHistory: [],
    createdAt: Date.now(),
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
    socket.on('join-room', async ({ code, username, playerId: clientPlayerId, asSpectator } = {}, ack) => {
      console.log('🔥 join-room event received', { asSpectator });

      if (!code || !username) {
        return ackError(ack, 'code and username are required');
      }

      const playerId = clientPlayerId || socket.id;

      // Validate player is not banned
      const { findUserById } = require('./userModel');
      const dbUser = await findUserById(playerId);
      if (dbUser && dbUser.isBanned) {
        return ackError(ack, dbUser.banReason || 'Your profile has been suspended by the administrator.');
      }

      const trimmedCode = String(code).trim().toUpperCase();
      const trimmedUser = String(username).trim().slice(0, 20);

      const room = rooms.get(trimmedCode);

      if (!room) {
        console.log('❌ Room not found');
        return ackError(ack, 'Room not found');
      }

      if (room.status !== 'lobby' && !asSpectator) {
        return ackError(ack, 'Game already started');
      }

      if (!asSpectator && room.players.length >= MAX_PLAYERS) {
        return ackError(ack, 'Room is full');
      }


      // Check if player already exists in players or spectators
      let existingPlayer = room.players.find(p => p.id === playerId);
      let existingSpectator = (room.spectators || []).find(p => p.id === playerId);

      if (!asSpectator && existingPlayer) {
        const oldSocketId = existingPlayer.socketId;
        if (oldSocketId) {
          socketToRoom.delete(oldSocketId);
        }
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        existingPlayer.disconnectedAt = null;
        existingPlayer.username = trimmedUser; // Update name just in case

        socketToRoom.set(socket.id, trimmedCode);
        socket.join(trimmedCode);
        saveRoom(room);
        emitRoomUpdated(io, room);

        console.log(`✅ ${trimmedUser} re-joined/restored connection to ${trimmedCode} as player`);

        return ackOk(ack, {
          room: lobbySnapshot(room),
          playerId,
          isSpectator: false,
        });
      }

      if (asSpectator && existingSpectator) {
        const oldSocketId = existingSpectator.socketId;
        if (oldSocketId) {
          socketToRoom.delete(oldSocketId);
        }
        existingSpectator.socketId = socket.id;
        existingSpectator.connected = true;
        existingSpectator.disconnectedAt = null;
        existingSpectator.username = trimmedUser;

        socketToRoom.set(socket.id, trimmedCode);
        socket.join(trimmedCode);
        saveRoom(room);
        emitRoomUpdated(io, room);

        console.log(`✅ ${trimmedUser} re-joined/restored connection to ${trimmedCode} as spectator`);

        return ackOk(ack, {
          room: lobbySnapshot(room),
          playerId,
          isSpectator: true,
        });
      }

      // If switching role from spectator to player
      if (!asSpectator && existingSpectator) {
        if (room.players.length >= MAX_PLAYERS) {
          return ackError(ack, 'Room is full');
        }
        room.spectators = (room.spectators || []).filter(p => p.id !== playerId);
      }

      // If switching role from player to spectator
      if (asSpectator && existingPlayer) {
        room.players = room.players.filter(p => p.id !== playerId);
      }

      const takenTokens = room.players.map(p => p.token).filter(Boolean);
      const defaultToken = PLAYER_TOKENS.find(t => !takenTokens.includes(t)) || PLAYER_TOKENS[0];

      const playerEntry = {
        id: playerId,
        username: trimmedUser,
        socketId: socket.id,
        ready: false,
        connected: true,
        disconnectedAt: null,
        isSpectator: Boolean(asSpectator),
        token: asSpectator ? null : defaultToken,
      };

      if (asSpectator) {
        room.spectators = room.spectators || [];
        room.spectators.push(playerEntry);
      } else {
        room.players.push(playerEntry);
      }

      socketToRoom.set(socket.id, trimmedCode);
      socket.join(trimmedCode);

      console.log(`✅ ${trimmedUser} joined ${trimmedCode} as ${asSpectator ? 'spectator' : 'player'}`);

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
        isSpectator: Boolean(asSpectator),
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
      player.autoplay      = false;
      socketToRoom.set(socket.id, trimmedCode);
      socket.join(trimmedCode);

      // Update socketId in game state if game is running
      if (room.gameState && room.gameState.players[playerId]) {
        room.gameState.players[playerId].socketId    = socket.id;
        room.gameState.players[playerId].isConnected = true;
      }

      saveRoom(room);

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
      if (player.isSpectator) {
        responseData.isSpectator = true;
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
      if (player.isSpectator) return ackError(ack, 'Spectators cannot toggle ready status');

      player.ready = Boolean(ready);

      emitRoomUpdated(io, room);
      ackOk(ack, { ready: player.ready });
    });

    // ── select-token ──────────────────────────────────────────────────────────
    /**
     * Client payload: { token: string }
     * Broadcast:      'room-updated' → room
     */
    socket.on('select-token', ({ token } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      if (room.status !== 'lobby') return ackError(ack, 'Game already started');

      const player = findPlayerBySocket(room, socket.id);
      if (!player) return ackError(ack, 'Player not found');
      if (player.isSpectator) return ackError(ack, 'Spectators cannot select tokens');

      if (!token || typeof token !== 'string') return ackError(ack, 'token is required');
      if (!PLAYER_TOKENS.includes(token)) return ackError(ack, 'Invalid token symbol');

      // Check if already taken by another player/bot
      const isTaken = room.players.some((p, idx) => {
        if (p.id === player.id) return false;
        const activeToken = p.token || PLAYER_TOKENS[idx % PLAYER_TOKENS.length];
        return activeToken === token;
      });

      if (isTaken) {
        return ackError(ack, 'This token is already selected by another player');
      }

      player.token = token;
      saveRoom(room);
      emitRoomUpdated(io, room);
      ackOk(ack, { token: player.token });
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
      const player = findPlayerBySocket(room, socket.id);
      if (!player || room.hostId !== player.id) return ackError(ack, 'Only the host can start the game');
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
        isBot:    Boolean(p.isBot),
        token:    p.token,
      }));

      const initResult = initializeGame(room.code, enginePlayers);
      if (!initResult.ok) return ackError(ack, initResult.error);

      room.gameState = initResult.gameState;
      // Copy isBot and difficulty fields into gameState.players just in case
      room.players.forEach(p => {
        if (p.isBot && room.gameState.players[p.id]) {
          room.gameState.players[p.id].isBot = true;
          room.gameState.players[p.id].difficulty = p.difficulty || 'medium';
          room.gameState.players[p.id].socketId = null;
          room.gameState.players[p.id].isConnected = true;
        }
      });
      room.status    = 'playing';

      console.log(`[game] started in room ${room.code} with ${room.players.length} players`);

      // Sync whole room to everyone
      emitRoomUpdated(io, room);

      io.to(room.code).emit('game-started', envelope(true, {
        room: lobbySnapshot(room),
      }));

      // Send each player their personalised state
      broadcastGameState(io, room);

      // Start AFK watchdog for first player
      startAfkTimer(io, room);

      ackOk(ack, {});

      // Trigger bot standard turn cycle if the starting player is a bot!
      triggerBotCycle(io, room);
    });

    // ── add-bot ───────────────────────────────────────────────────────────────
    socket.on('add-bot', (payload, ack) => {
      let actualPayload = {};
      let actualAck = ack;

      if (typeof payload === 'function') {
        actualAck = payload;
      } else if (payload && typeof payload === 'object') {
        actualPayload = payload;
      }

      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(actualAck, gr.error);
      const { room } = gr;

      if (room.status !== 'lobby') return ackError(actualAck, 'Game already started');
      const player = findPlayerBySocket(room, socket.id);
      if (!player || room.hostId !== player.id) return ackError(actualAck, 'Only the host can add bots');
      if (room.players.length >= MAX_PLAYERS) return ackError(actualAck, 'Room is full');

      let difficulty = 'medium';
      if (actualPayload && ['easy', 'medium', 'hard'].includes(actualPayload.difficulty)) {
        difficulty = actualPayload.difficulty;
      }

      const botNames = ['Birbal', 'Tenali', 'Chanakya', 'Aryabhata', 'Shakuntala', 'Vikram', 'Kalidasa'];
      // Filter out names already in the room
      const existingNames = room.players.map(p => p.username.replace('🤖 Bot ', ''));
      const availableNames = botNames.filter(name => !existingNames.includes(name));
      const name = availableNames.length > 0 ? availableNames[0] : `Bot_${Math.floor(Math.random() * 100)}`;

      const takenTokens = room.players.map(p => p.token).filter(Boolean);
      const defaultToken = PLAYER_TOKENS.find(t => !takenTokens.includes(t)) || PLAYER_TOKENS[0];

      const botPlayer = {
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        username: `🤖 Bot ${name}`,
        socketId: null,
        ready: true,
        connected: true,
        disconnectedAt: null,
        isBot: true,
        token: defaultToken,
        difficulty: difficulty,
      };

      room.players.push(botPlayer);
      saveRoom(room);
      emitRoomUpdated(io, room);
      ackOk(actualAck, { player: botPlayer });
    });

    // ── remove-bot ────────────────────────────────────────────────────────────
    socket.on('remove-bot', ({ playerId } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      if (room.status !== 'lobby') return ackError(ack, 'Game already started');
      const player = findPlayerBySocket(room, socket.id);
      if (!player || room.hostId !== player.id) return ackError(ack, 'Only the host can remove bots');
      if (!playerId) return ackError(ack, 'playerId is required');

      const bot = room.players.find(p => p.id === playerId && p.isBot);
      if (!bot) return ackError(ack, 'Bot not found');

      room.players = room.players.filter(p => p.id !== playerId);
      saveRoom(room);
      emitRoomUpdated(io, room);
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

      const enginePlayer = gr.room.gameState?.players[player.id];
      if (enginePlayer && enginePlayer.money >= 0) {
        return ackError(ack, 'You cannot declare bankruptcy with a positive balance');
      }

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

    // ── request-kick-host ─────────────────────────────────────────────────────
    socket.on('request-kick-host', (_, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, requestKickHost, [gr.room.hostId], ack);
    });

    // ── vote-kick-host ───────────────────────────────────────────────────────
    socket.on('vote-kick-host', ({ accept } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, voteKickHost, [Boolean(accept)], ack);
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

    // ── counter-trade ──────────────────────────────────────────────────────────
    socket.on('counter-trade', ({ offer, request } = {}, ack) => {
      const gr = guardInRoom(socket);  if (!gr.ok) return ackError(ack, gr.error);
      const gp = guardPlaying(gr.room); if (!gp.ok) return ackError(ack, gp.error);
      const player = findPlayerBySocket(gr.room, socket.id);
      if (!player) return ackError(ack, 'You are not in this game');

      _dispatch(io, socket, gr.room, player.id, counterTrade,
        [offer || {}, request || {}], ack);
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
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) return ackError(ack, 'amount must be a valid positive integer');

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

      const isVoice = text.trim().startsWith('data:audio/');
      const cleaned = text.trim().slice(0, isVoice ? 150000 : 300);
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

      saveRoom(room);

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
     * Host only. Lobby or Playing.
     * Client payload: { playerId: string }
     */
    socket.on('kick-player', ({ playerId } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      const player = findPlayerBySocket(room, socket.id);
      if (!player || room.hostId !== player.id) return ackError(ack, 'Only the host can kick players');
      if (room.status !== 'lobby' && room.status !== 'playing') {
        return ackError(ack, 'Cannot kick player in this room status');
      }
      if (!playerId)                 return ackError(ack, 'playerId is required');
      if (playerId === room.hostId)  return ackError(ack, 'Host cannot kick themselves');

      const target = findPlayerById(room, playerId);
      if (!target) return ackError(ack, 'Player not found');

      // If game is in progress, declare them bankrupt to Bank to return all properties to market
      if (room.status === 'playing') {
        if (room.gameState && room.gameState.players[playerId] && !room.gameState.players[playerId].isBankrupt) {
          const result = declareBankruptcy(room.gameState, playerId);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
            startAfkTimer(io, room);
            triggerBotCycle(io, room);
          }
        }
      }

      // Remove from room
      room.players = room.players.filter((p) => p.id !== playerId);
      socketToRoom.delete(target.socketId);

      // Notify kicked socket
      io.to(target.socketId).emit('kicked', envelope(true, { code: room.code }));

      // Make them leave the Socket.IO room
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) targetSocket.leave(room.code);

      // Broadcast updated lobby / room players
      io.to(room.code).emit('player-left', envelope(true, {
        playerId,
        username: target.username,
        room: lobbySnapshot(room),
      }));

      saveRoom(room);
      ackOk(ack, {});
    });

    // ── toggle-autoplay ──────────────────────────────────────────────────────
    /**
     * Toggles AI Autoplay for the player.
     * Client payload: { autoplay: boolean }
     */
    socket.on('toggle-autoplay', ({ autoplay } = {}, ack) => {
      const gr = guardInRoom(socket);
      if (!gr.ok) return ackError(ack, gr.error);
      const { room } = gr;

      const player = findPlayerBySocket(room, socket.id);
      if (!player) return ackError(ack, 'Player not found in this room');

      player.autoplay = autoplay !== undefined ? Boolean(autoplay) : !player.autoplay;
      saveRoom(room);

      console.log(`[room] ${player.username} toggled autoplay to ${player.autoplay}`);

      // Broadcast updated room state
      io.to(room.code).emit('room-updated', envelope(true, { room: lobbySnapshot(room) }));

      // If they turned on autoplay and it's their turn, run the bot cycle
      if (player.autoplay) {
        triggerBotCycle(io, room);
      }

      ackOk(ack, { autoplay: player.autoplay });
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

    if (player.isSpectator) {
      room.spectators = (room.spectators || []).filter((p) => p.id !== player.id);
      console.log(`[room] spectator ${player.username} left room ${room.code}`);
      io.to(room.code).emit('player-left', envelope(true, {
        playerId: player.id,
        username: player.username,
        room:     lobbySnapshot(room),
      }));
      saveRoom(room);
      return;
    }

    // ── LOBBY: just remove them ─────────────────────────────────────────────
    if (room.status === 'lobby') {
      room.players = room.players.filter((p) => p.socketId !== socket.id);

      if (room.players.length === 0) {
        // Empty room — destroy
        destroyRoom(io, room);
        return;
      }

      // If host left, reassign host to next player
      if (room.hostId === player.id) {
        const nextHost = room.players.find((p) => !p.isBot);
        if (nextHost) {
          room.hostId = nextHost.id;
          console.log(`[room] host left ${room.code}; new host: ${nextHost.username}`);
        }
      }

      io.to(room.code).emit('player-left', envelope(true, {
        playerId: player.id,
        username: player.username,
        room:     lobbySnapshot(room),
      }));
      saveRoom(room);
      return;
    }

    // ── PLAYING / FINISHED ──────────────────────────────────────────────────

    if (intentional) {
      // Voluntary leave during a game: treat as bankruptcy forfeit
      player.connected = false;
      player.disconnectedAt = Date.now();

      // If host left, reassign host role to next human player
      if (room.hostId === player.id) {
        const nextHost = room.players.find((p) => p.id !== player.id && !p.isBot && p.connected)
                      || room.players.find((p) => p.id !== player.id && !p.isBot);
        if (nextHost) {
          room.hostId = nextHost.id;
          console.log(`[room] Host left game room ${room.code}; reassigned host role to ${nextHost.username}`);
        }
      }

      // Trigger engine bankruptcy to Bank to return all properties to market
      if (room.gameState && room.gameState.players[player.id] && !room.gameState.players[player.id].isBankrupt) {
        const result = declareBankruptcy(room.gameState, player.id);
        if (result.ok) {
          broadcastEvents(io, room, result.events);
          broadcastGameState(io, room);
          startAfkTimer(io, room);
          triggerBotCycle(io, room);
        }
      }

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
      saveRoom(room);
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
      saveRoom(room);
      triggerBotCycle(io, room);

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

        // Declare them bankrupt in game state to clean up their assets and advance turn if it was their turn
        if (room.gameState && room.gameState.players[player.id] && !room.gameState.players[player.id].isBankrupt) {
          const result = declareBankruptcy(room.gameState, player.id);
          if (result.ok) {
            broadcastEvents(io, room, result.events);
            broadcastGameState(io, room);
            startAfkTimer(io, room);
            triggerBotCycle(io, room);
          }
        }

        saveRoom(room);

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

    if (room.gameState) {
      room.gameState.status = 'finished';
      room.gameState.winnerId = winner ? winner.id : null;
      room.gameState.winnerName = winner ? winner.username : null;
    }

    if (!room.matchSaved) {
      room.matchSaved = true;
      _recordCompletedMatch(room);
    }

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

module.exports = {
  mountGameSocket,
  rooms,
  destroyRoom,
  socketToRoom,
  triggerBotCycle,
  evaluateBotTradeDecision,
  broadcastGameState,
  emitRoomUpdated
};
