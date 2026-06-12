 /* backend/game-engine/gameEngine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * INDIAN MONOPOLY — Server-Authoritative Game Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This is the single brain of the game. ALL game logic runs here on the server.
 * The frontend is a dumb renderer — it sends player intents (roll, buy, trade)
 * and receives authoritative game state deltas in return.
 *
 * NEVER expose raw gameState to clients — always call getClientState() first.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   socketHandlers.js  →  gameEngine functions  →  mutate gameState
 *                      ↓
 *               return { ok, events[], error? }
 *                      ↓
 *          socketHandlers broadcast events to room
 *
 * ── Result envelope ──────────────────────────────────────────────────────────
 *
 *   Every public function returns:
 *   {
 *     ok:     boolean          — true = success, false = rejected
 *     events: GameEvent[]      — ordered list of things that happened
 *     error?: string           — human-readable reason when ok=false
 *   }
 *
 * ── GameEvent schema ─────────────────────────────────────────────────────────
 *
 *   {
 *     type:      string   — EVENT_TYPES constant
 *     payload:   Object   — event-specific data (always serialisable)
 *     message:   string   — human-readable log line for chat/log panel
 *     ts:        number   — Date.now() at time of event
 *   }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const crypto = require('crypto');

const {
  TILE_TYPES,
  TILE_BY_ID,
  RAILWAY_TILE_IDS,
  UTILITY_TILE_IDS,
  PURCHASABLE_TILE_IDS,
  buildInitialProperties,
  calculateRent,
  hasMonopoly,
  canBuildHouse,
  canBuildHotel,
  findNearestTile,
  countRailwaysOwned,
  countUtilitiesOwned,
  getColorGroupTiles,
} = require('./boardData');


const {
  EFFECT_TYPES,
  createFreshDecks,
  drawChanceCard,
  drawCommunityCard,
  isValidCard,
  toClientCard,
} = require('./cards');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STARTING_BALANCE      = 20_000;  // ₹20,000 each player starts with
const GO_REWARD             = 2_000;   // ₹2,000 collected passing/landing on tile 0
const JAIL_TILE             = 10;      // Board position of Tihar Jail
const GO_TILE               = 0;       // Board position of Start Journey
const BOARD_SIZE            = 40;      // Total number of tiles
const MAX_PLAYERS           = 8;
const MIN_PLAYERS           = 2;
const MAX_JAIL_TURNS        = 3;       // Must pay fine after 3 failed escape turns
const JAIL_FINE             = 500;     // ₹500 to pay out of jail
const MAX_DOUBLES_IN_ROW    = 3;       // 3 consecutive doubles → jail
const HOUSE_BANK_TOTAL      = 32;      // Standard Monopoly bank supply
const HOTEL_BANK_TOTAL      = 12;
const HOUSES_PER_HOTEL      = 4;
const TURN_TIMEOUT_SECONDS  = 90;      // AFK timeout per turn

// Available player tokens + colours (assigned by join order)
const PLAYER_TOKENS = ['🚗', '🐘', '🚆', '👑', '🛺', '🐅', '⚓', '🎯', '🦚', '🏏', '☕', '🪔', '🦁', '🚁', '🚢', '💼', '💰', '🎩'];
const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
];

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TYPES  — imported by socketHandlers to route broadcasts
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPES = Object.freeze({
  // Dice
  DICE_ROLLED:          'DICE_ROLLED',
  DOUBLES_ROLLED:       'DOUBLES_ROLLED',
  TRIPLE_DOUBLES_JAIL:  'TRIPLE_DOUBLES_JAIL',

  // Movement
  PLAYER_MOVED:         'PLAYER_MOVED',
  PASSED_GO:            'PASSED_GO',
  LANDED_GO:            'LANDED_GO',

  // Properties
  PROPERTY_AVAILABLE:   'PROPERTY_AVAILABLE',   // player can buy or auction
  PROPERTY_BOUGHT:      'PROPERTY_BOUGHT',
  PROPERTY_MORTGAGED:   'PROPERTY_MORTGAGED',
  PROPERTY_UNMORTGAGED: 'PROPERTY_UNMORTGAGED',
  HOUSE_BUILT:          'HOUSE_BUILT',
  HOTEL_BUILT:          'HOTEL_BUILT',
  HOUSE_SOLD:           'HOUSE_SOLD',
  HOTEL_SOLD:           'HOTEL_SOLD',

  // Rent + tax
  RENT_PAID:            'RENT_PAID',
  TAX_PAID:             'TAX_PAID',
  FREE_PARKING_COLLECT: 'FREE_PARKING_COLLECT',
  FREE_PARKING_EMPTY:   'FREE_PARKING_EMPTY',

  // Jail
  SENT_TO_JAIL:         'SENT_TO_JAIL',
  JAIL_FINE_PAID:       'JAIL_FINE_PAID',
  JAIL_CARD_USED:       'JAIL_CARD_USED',
  JAIL_DOUBLES_ESCAPE:  'JAIL_DOUBLES_ESCAPE',
  JAIL_FORCED_FINE:     'JAIL_FORCED_FINE',
  JAIL_TURN_WASTED:     'JAIL_TURN_WASTED',
  VISITING_JAIL:        'VISITING_JAIL',

  // Cards
  CHANCE_CARD_DRAWN:    'CHANCE_CARD_DRAWN',
  COMMUNITY_CARD_DRAWN: 'COMMUNITY_CARD_DRAWN',
  CARD_EFFECT_APPLIED:  'CARD_EFFECT_APPLIED',
  JAIL_CARD_RECEIVED:   'JAIL_CARD_RECEIVED',

  // Bankruptcy + win
  PLAYER_BANKRUPTED:    'PLAYER_BANKRUPTED',
  GAME_WON:             'GAME_WON',

  // End Game Voting
  END_GAME_REQUESTED:   'END_GAME_REQUESTED',
  END_GAME_ACCEPTED:    'END_GAME_ACCEPTED',
  END_GAME_REJECTED:    'END_GAME_REJECTED',
  END_GAME_APPROVED:    'END_GAME_APPROVED',
  END_GAME_VOTE_REJECTED:'END_GAME_VOTE_REJECTED',

  // Kick Host Voting
  KICK_HOST_REQUESTED:   'KICK_HOST_REQUESTED',
  KICK_HOST_ACCEPTED:    'KICK_HOST_ACCEPTED',
  KICK_HOST_REJECTED:    'KICK_HOST_REJECTED',
  KICK_HOST_APPROVED:    'KICK_HOST_APPROVED',
  KICK_HOST_VOTE_REJECTED:'KICK_HOST_VOTE_REJECTED',

  // Turn
  TURN_STARTED:         'TURN_STARTED',
  TURN_ENDED:           'TURN_ENDED',
  EXTRA_TURN:           'EXTRA_TURN',

  // Trade (placeholders)
  TRADE_INITIATED:      'TRADE_INITIATED',
  TRADE_ACCEPTED:       'TRADE_ACCEPTED',
  TRADE_REJECTED:       'TRADE_REJECTED',
  TRADE_COUNTERED:      'TRADE_COUNTERED',
  TRADE_COMPLETED:      'TRADE_COMPLETED',
  TRADE_CANCELLED:      'TRADE_CANCELLED',

  // Auction
  AUCTION_STARTED:      'AUCTION_STARTED',
  AUCTION_BID:          'AUCTION_BID',
  AUCTION_WON:          'AUCTION_WON',
  AUCTION_NO_SALE:      'AUCTION_NO_SALE',

  // Loans
  LOAN_APPROVED:        'LOAN_APPROVED',
  LOAN_REJECTED:        'LOAN_REJECTED',
  LOAN_REPAYMENT_DUE:   'LOAN_REPAYMENT_DUE',
  LOAN_REPAID:          'LOAN_REPAID',
  LOAN_DEFAULTED:       'LOAN_DEFAULTED',
  BANK_REPOSSESSION:    'BANK_REPOSSESSION',
});

// ─────────────────────────────────────────────────────────────────────────────
// RESULT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a successful result envelope.
 * @param {GameEvent[]} events
 * @returns {{ ok: true, events: GameEvent[] }}
 */
const ok = (events = []) => ({ ok: true, events });

/**
 * Build a failure result envelope.
 * @param {string} error
 * @returns {{ ok: false, events: [], error: string }}
 */
const fail = (error) => ({ ok: false, events: [], error });

/**
 * Build a single GameEvent object.
 * @param {string} type   — EVENT_TYPES constant
 * @param {Object} payload
 * @param {string} message — log line
 * @returns {GameEvent}
 */
const evt = (type, payload, message = '') => ({
  type,
  payload,
  message,
  ts: Date.now(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 1. GAME INITIALISATION ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initializeGame — Create a fresh game state for a new match.
 *
 * @param {string}   roomId   — unique room identifier
 * @param {Array}    players  — array of { id, username, socketId }
 *                             must have 2–8 entries
 * @returns {{ ok: boolean, gameState?: Object, error?: string }}
 */
const initializeGame = (roomId, players) => {
  // ── Validate player count ────────────────────────────────────────────────
  if (!Array.isArray(players) || players.length < MIN_PLAYERS) {
    return { ok: false, error: `Need at least ${MIN_PLAYERS} players to start` };
  }
  if (players.length > MAX_PLAYERS) {
    return { ok: false, error: `Maximum ${MAX_PLAYERS} players allowed` };
  }

  // ── Randomise turn order ──────────────────────────────────────────────────
  const turnOrder = shuffleArray(players.map((p) => p.id));

  // ── Build player states ───────────────────────────────────────────────────
  const playerStates = {};
  players.forEach((player, idx) => {
    const activeToken = player.token || PLAYER_TOKENS[idx % PLAYER_TOKENS.length];
    const tokenIdx = PLAYER_TOKENS.indexOf(activeToken);
    const colorIdx = tokenIdx !== -1 ? tokenIdx : idx;
    playerStates[player.id] = {
      id:           player.id,
      username:     player.username,
      socketId:     player.socketId,
      token:        activeToken,
      color:        PLAYER_COLORS[colorIdx % PLAYER_COLORS.length],

      // Board state
      position:     GO_TILE,        // everyone starts on Start Journey
      money:        STARTING_BALANCE,

      // Loan state
      loanActive:           false,
      loanAmount:           0,
      loanRepaymentAmount:  0,
      loanTurnsRemaining:   0,

      // Jail state
      inJail:       false,
      jailTurnsUsed: 0,             // how many turns spent trying to escape
      jailCard:     false,          // owns Get Out of Jail Free card

      // Turn state (reset each turn)
      doublesStreak: 0,             // consecutive doubles this turn sequence
      hasRolledThisTurn: false,

      // Status
      isBankrupt:   false,
      isConnected:  true,
      turnOrder:    turnOrder.indexOf(player.id),  // 0-based display order

      // Statistics tracking
      rentCollected:              0,
      loansTakenCount:            0,
      propertiesRepossessedCount: 0,
      propertiesPurchasedCount:   0,
      propertiesMortgagedCount:   0,
      auctionsWonCount:           0,
      rentPaidAmount:             0,
      hotelsBuiltCount:           0,
    };
  });

  // ── Build fresh decks from cards.js ──────────────────────────────────────
  const decks = createFreshDecks();

  // ── Build property ownership map from boardData.js ────────────────────────
  const properties = buildInitialProperties();  // all ownerId:null

  // ── Assemble full game state ──────────────────────────────────────────────
  const gameState = {
    roomId,
    status:         'playing',      // 'waiting' | 'playing' | 'finished'
    round:          1,

    // Players
    players:        playerStates,
    turnOrder,                      // [playerId, ...]  ordered play sequence
    currentTurnIdx: 0,              // index into turnOrder of whose turn it is

    // Turn flags (reset by nextTurn)
    hasRolled:      false,          // has current player rolled this turn?
    pendingAction:  null,           // 'buy_decision' | 'auction' | null
    turnStartedAt:  Date.now(),

    // Properties
    properties,

    // Card decks (live state — mutated by drawChanceCard / drawCommunityCard)
    chanceDeck:     decks.chanceDeck,
    chanceIndex:    decks.chanceIndex,
    communityDeck:  decks.communityDeck,
    communityIndex: decks.communityIndex,

    // Bank supply
    houseBank:      HOUSE_BANK_TOTAL,   // houses remaining in bank
    hotelBank:      HOTEL_BANK_TOTAL,   // hotels remaining in bank

    // Free Parking pot (taxes + fines accumulate here)
    freeParkingPot: 0,

    // Last dice roll (preserved for utility rent calculation)
    lastDice:       { d1: 0, d2: 0, total: 0, isDouble: false },

    // Active trade (null when no trade in progress)
    activeTrade:    null,

    // Active auction (null when no auction in progress)
    activeAuction:  null,
    queuedAuctions: [],

    // Append-only event log — last 200 entries kept
    log:            [],

    // Winner
    winnerId:       null,
  };

  return { ok: true, gameState };
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 2. DICE SYSTEM ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * rollDice — Server generates the dice roll. Called once per turn (or more on
 * doubles). Handles jail logic, doubles streak, triple-doubles jail.
 *
 * @param {Object} gameState  — mutated in place
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const rollDice = (gameState, playerId) => {
  // ── Guards ───────────────────────────────────────────────────────────────
  const guardResult = guardTurn(gameState, playerId);
  if (!guardResult.ok) return guardResult;

  const player = gameState.players[playerId];
  if (player && player.money < 0) {
    return fail('You have a negative balance! You must raise cash first.');
  }

  if (gameState.hasRolled) {
    return fail('You have already rolled this turn');
  }

  const events = [];

  // ── Generate dice ────────────────────────────────────────────────────────
  const d1      = randomDie();
  const d2      = randomDie();
  const total   = d1 + d2;
  const isDouble = d1 === d2;

  const dice = { d1, d2, total, isDouble };
  gameState.lastDice = dice;
  gameState.hasRolled = true;

  events.push(evt(
    EVENT_TYPES.DICE_ROLLED,
    { playerId, dice },
    `${player.username} rolled ${d1} + ${d2} = ${total}${isDouble ? ' (Double!)' : ''}`,
  ));

  if (isDouble) {
    events.push(evt(
      EVENT_TYPES.DOUBLES_ROLLED,
      { playerId, dice },
      '',
    ));
  }

  // ── Jail branch ──────────────────────────────────────────────────────────
  if (player.inJail) {
    return _handleJailRoll(gameState, player, dice, events);
  }

  // ── Normal movement branch ───────────────────────────────────────────────

  // Track consecutive doubles
  if (isDouble) {
    player.doublesStreak += 1;

    // Triple doubles → straight to jail, no movement
    if (player.doublesStreak >= MAX_DOUBLES_IN_ROW) {
      player.doublesStreak = 0;
      _sendToJail(gameState, player, events);
      events.push(evt(
        EVENT_TYPES.TRIPLE_DOUBLES_JAIL,
        { playerId },
        `${player.username} rolled 3 consecutive doubles — sent to Tihar Jail! 🚔`,
      ));
      // End turn immediately (jail ends the streak)
      _finaliseRoll(gameState, player, isDouble, jailed = true, events);
      return ok(events);
    }
  } else {
    player.doublesStreak = 0;
  }

  // Move the player
  _moveAndLand(gameState, player, total, events);

  // After landing, if doubles → allow another roll (hasRolled reset)
  _finaliseRoll(gameState, player, isDouble, false, events);

  return ok(events);
};

/**
 * _handleJailRoll — Process a dice roll while the player is in Tihar Jail.
 * Internal helper, not exported.
 */
const _handleJailRoll = (gameState, player, dice, events) => {
  const { d1, d2, total, isDouble } = dice;

  if (isDouble) {
    // Doubles escape: move from jail tile forward
    player.inJail       = false;
    player.jailTurnsUsed = 0;
    player.doublesStreak = 0;  // escaping with doubles does NOT earn another roll

    events.push(evt(
      EVENT_TYPES.JAIL_DOUBLES_ESCAPE,
      { playerId: player.id },
      `${player.username} rolled doubles and escaped Tihar Jail! 🎉`,
    ));

    const moveEvents = _moveAndLand(gameState, player, total, []);
    events.push(...moveEvents);

    // No extra roll after jail escape doubles
    _finaliseRoll(gameState, player, false, false, events);
    return ok(events);
  }

  // Failed escape attempt
  player.jailTurnsUsed += 1;

  if (player.jailTurnsUsed >= MAX_JAIL_TURNS) {
    // Must pay fine and move on third failed attempt
    if (player.money >= JAIL_FINE) {
      player.money        -= JAIL_FINE;
      gameState.freeParkingPot += JAIL_FINE;
      player.inJail        = false;
      player.jailTurnsUsed = 0;

      events.push(evt(
        EVENT_TYPES.JAIL_FORCED_FINE,
        { playerId: player.id, amount: JAIL_FINE },
        `${player.username} paid ₹${fmt(JAIL_FINE)} forced fine after 3 jail turns`,
      ));

      const moveEvents = _moveAndLand(gameState, player, total, []);
      events.push(...moveEvents);
    } else {
      // Cannot afford fine — bankrupt
      const bkEvents = _processBankruptcy(gameState, player.id, null);
      events.push(...bkEvents);
    }
  } else {
    events.push(evt(
      EVENT_TYPES.JAIL_TURN_WASTED,
      { playerId: player.id, jailTurnsUsed: player.jailTurnsUsed },
      `${player.username} stays in Tihar Jail (attempt ${player.jailTurnsUsed}/${MAX_JAIL_TURNS})`,
    ));
  }

  _finaliseRoll(gameState, player, false, false, events);
  return ok(events);
};

/**
 * _finaliseRoll — After movement/jail, decide whether to keep hasRolled
 * locked (player must end turn) or open for another roll (doubles).
 */
const _finaliseRoll = (gameState, player, isDouble, jailed, events) => {
  if (isDouble && !jailed && !player.inJail) {
    // Doubles → allow another roll this turn
    gameState.hasRolled = false;
    events.push(evt(
      EVENT_TYPES.EXTRA_TURN,
      { playerId: player.id },
      `${player.username} rolled doubles — roll again!`,
    ));
  }
  // else hasRolled stays true; player must endTurn
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 3. MOVEMENT ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _moveAndLand — Move a player forward N spaces (wrapping at 40),
 * award GO reward if crossing tile 0, then process tile landing.
 * Internal helper.
 *
 * @param {Object} gameState
 * @param {Object} player      — player object (reference, mutated)
 * @param {number} spaces      — number of spaces to advance
 * @param {Array}  eventsArr   — events array to push onto (may already have entries)
 * @returns {GameEvent[]}      — new events generated by this call
 */
const _moveAndLand = (gameState, player, spaces, eventsArr) => {
  const events = eventsArr;
  const fromPosition = player.position;
  const newPosition  = (fromPosition + spaces) % BOARD_SIZE;
  const passedGo     = newPosition < fromPosition && spaces > 0;

  player.position = newPosition;

  events.push(evt(
    EVENT_TYPES.PLAYER_MOVED,
    { playerId: player.id, from: fromPosition, to: newPosition, spaces },
    '',   // movement is visual — no log line needed
  ));

  // ── Passed Go ─────────────────────────────────────────────────────────────
  if (passedGo) {
    player.money += GO_REWARD;
    events.push(evt(
      EVENT_TYPES.PASSED_GO,
      { playerId: player.id, amount: GO_REWARD, newBalance: player.money },
      `${player.username} passed Start Journey and collected ₹${fmt(GO_REWARD)} 🇮🇳`,
    ));
  }

  // ── Process tile at new position ──────────────────────────────────────────
  _processTileLanding(gameState, player, newPosition, events);

  return events;
};

/**
 * _teleportPlayer — Move a player directly to a specific tile (card effect).
 * Handles GO reward if crossing tile 0 in the process.
 *
 * @param {Object} gameState
 * @param {Object} player
 * @param {number} destTile       — destination tile id (0–39)
 * @param {boolean} collectGoReward — award GO reward if applicable
 * @param {Array}  events
 */
const _teleportPlayer = (gameState, player, destTile, collectGoReward, events) => {
  const from    = player.position;
  player.position = destTile;

  events.push(evt(
    EVENT_TYPES.PLAYER_MOVED,
    { playerId: player.id, from, to: destTile, teleport: true },
    '',
  ));

  // Award GO reward if we crossed tile 0 going forward
  // (destination behind current position = passed GO, unless we started at GO)
  const crossedGo = collectGoReward && destTile < from && from !== GO_TILE;
  if (crossedGo) {
    player.money += GO_REWARD;
    events.push(evt(
      EVENT_TYPES.PASSED_GO,
      { playerId: player.id, amount: GO_REWARD, newBalance: player.money },
      `${player.username} passed Start Journey and collected ₹${fmt(GO_REWARD)} 🇮🇳`,
    ));
  }

  _processTileLanding(gameState, player, destTile, events);
};

/**
 * _processTileLanding — Execute the action for whatever tile a player is on.
 * Internal. Mutates gameState/player directly.
 */
const _processTileLanding = (gameState, player, tileId, events) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile) return;

  switch (tile.type) {

    // ── Start Journey ──────────────────────────────────────────────────────
    case TILE_TYPES.GO:
      player.money += GO_REWARD;
      events.push(evt(
        EVENT_TYPES.LANDED_GO,
        { playerId: player.id, amount: GO_REWARD, newBalance: player.money },
        `${player.username} landed on Start Journey! Collected ₹${fmt(GO_REWARD)} 🇮🇳`,
      ));
      break;

    // ── Tax tiles (Income Tax / GST) ───────────────────────────────────────
    case TILE_TYPES.TAX: {
      const taxAmt = tile.amount;
      player.money             -= taxAmt;
      gameState.freeParkingPot += taxAmt;
      if (player.money < 0) {
        player.creditorId = null;
      }
      events.push(evt(
        EVENT_TYPES.TAX_PAID,
        { playerId: player.id, tileId, amount: taxAmt, newBalance: player.money },
        `${player.username} paid ₹${fmt(taxAmt)} ${tile.name}${player.money < 0 ? ' (went into debt!)' : ''}`,
      ));
      break;
    }

    // ── Go to Jail ─────────────────────────────────────────────────────────
    case TILE_TYPES.GO_TO_JAIL:
      _sendToJail(gameState, player, events);
      events.push(evt(
        EVENT_TYPES.SENT_TO_JAIL,
        { playerId: player.id, reason: 'tile' },
        `${player.username} landed on Income Tax Raid — sent to Tihar Jail! 🚔`,
      ));
      break;

    // ── Just Visiting Jail ─────────────────────────────────────────────────
    case TILE_TYPES.JAIL:
      if (!player.inJail) {
        events.push(evt(
          EVENT_TYPES.VISITING_JAIL,
          { playerId: player.id },
          `${player.username} is just visiting Tihar Jail`,
        ));
      }
      break;

    // ── Tea Break (Free Parking) ───────────────────────────────────────────
    case TILE_TYPES.FREE_PARKING:
      if (gameState.freeParkingPot > 0) {
        const pot = gameState.freeParkingPot;
        player.money             += pot;
        gameState.freeParkingPot  = 0;
        events.push(evt(
          EVENT_TYPES.FREE_PARKING_COLLECT,
          { playerId: player.id, amount: pot, newBalance: player.money },
          `${player.username} collected ₹${fmt(pot)} from the Tea Break pot! ☕`,
        ));
      } else {
        events.push(evt(
          EVENT_TYPES.FREE_PARKING_EMPTY,
          { playerId: player.id },
          `${player.username} landed on Tea Break ☕ (pot is empty)`,
        ));
      }
      break;

    // ── Chance card ────────────────────────────────────────────────────────
    case TILE_TYPES.CHANCE: {
      const card = drawChanceCard(gameState);
      events.push(evt(
        EVENT_TYPES.CHANCE_CARD_DRAWN,
        { playerId: player.id, card: toClientCard(card) },
        `${player.username} drew Chance: "${card.title}"`,
      ));
      _applyCardEffect(gameState, player, card, events);
      break;
    }

    // ── Community Chest card ───────────────────────────────────────────────
    case TILE_TYPES.COMMUNITY: {
      const card = drawCommunityCard(gameState);
      events.push(evt(
        EVENT_TYPES.COMMUNITY_CARD_DRAWN,
        { playerId: player.id, card: toClientCard(card) },
        `${player.username} drew Community Chest: "${card.title}"`,
      ));
      _applyCardEffect(gameState, player, card, events);
      break;
    }

    // ── Purchasable tile (property / railway / utility) ────────────────────
    case TILE_TYPES.PROPERTY:
    case TILE_TYPES.RAILWAY:
    case TILE_TYPES.UTILITY: {
      const prop = gameState.properties[tileId];

      if (!prop || !prop.ownerId) {
        // Unowned — player may buy or auction
        gameState.pendingAction = 'buy_decision';
        events.push(evt(
          EVENT_TYPES.PROPERTY_AVAILABLE,
          { playerId: player.id, tileId, tile, canAfford: player.money >= tile.price },
          `${player.username} landed on ${tile.name} (₹${fmt(tile.price)}) — Buy or Auction?`,
        ));
      } else if (prop.ownerId === player.id) {
        // Own property — nothing happens
      } else if (prop.mortgaged) {
        // Mortgaged — no rent
      } else {
        // Someone else owns it — pay rent
        _payRent(gameState, player, tileId, events);
      }
      break;
    }

    default:
      break;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 4. PROPERTY SYSTEM ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buyProperty — Player purchases the property they are currently standing on.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const buyProperty = (gameState, playerId) => {
  const guardResult = guardTurn(gameState, playerId);
  if (!guardResult.ok) return guardResult;

  const player = gameState.players[playerId];
  const tileId = player.position;
  const tile   = TILE_BY_ID[tileId];

  if (!tile || !PURCHASABLE_TILE_IDS.includes(tileId)) {
    return fail('This tile cannot be purchased');
  }

  const prop = gameState.properties[tileId];
  if (!prop)              return fail('Property state not found');
  if (prop.ownerId)       return fail('This property is already owned');
  if (player.money < tile.price) return fail(`Insufficient funds — need ₹${fmt(tile.price)}`);
  if (gameState.pendingAction !== 'buy_decision') {
    return fail('No purchase decision pending');
  }

  player.money   -= tile.price;
  prop.ownerId    = playerId;
  player.propertiesPurchasedCount = (player.propertiesPurchasedCount ?? 0) + 1;
  gameState.pendingAction = null;

  const events = [evt(
    EVENT_TYPES.PROPERTY_BOUGHT,
    { playerId, tileId, price: tile.price, newBalance: player.money },
    `🏠 ${player.username} purchased ${tile.name} for ₹${fmt(tile.price)}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * mortgageProperty — Player mortgages one of their properties for immediate cash.
 * Cannot mortgage if buildings are on the property.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const mortgageProperty = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');
  if (!tile || !prop)               return fail('Invalid tile');
  if (prop.ownerId !== playerId)    return fail('You do not own this property');
  if (prop.mortgaged)               return fail('Already mortgaged');
  const groupTiles = getColorGroupTiles(tileId);
  const hasBuildings = groupTiles.some(
    (id) => gameState.properties[id]?.houses > 0 || gameState.properties[id]?.hotel
  );
  if (hasBuildings) {
    return fail('Must sell all buildings in the color group before mortgaging');
  }

  prop.mortgaged  = true;
  player.money   += tile.mortgage;
  player.propertiesMortgagedCount = (player.propertiesMortgagedCount ?? 0) + 1;

  const events = [evt(
    EVENT_TYPES.PROPERTY_MORTGAGED,
    { playerId, tileId, amount: tile.mortgage, newBalance: player.money },
    `${player.username} mortgaged ${tile.name} for ₹${fmt(tile.mortgage)}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * unmortgageProperty — Player lifts a mortgage at cost = mortgage × 1.1.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const unmortgageProperty = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');
  if (!tile || !prop)               return fail('Invalid tile');
  if (prop.ownerId !== playerId)    return fail('You do not own this property');
  if (!prop.mortgaged)              return fail('Property is not mortgaged');

  const cost = tile.unmortgage;   // pre-computed in boardData (mortgage × 1.1)
  if (player.money < cost) {
    return fail(`Need ₹${fmt(cost)} to unmortgage (you have ₹${fmt(player.money)})`);
  }

  prop.mortgaged  = false;
  player.money   -= cost;

  const events = [evt(
    EVENT_TYPES.PROPERTY_UNMORTGAGED,
    { playerId, tileId, cost, newBalance: player.money },
    `${player.username} unmortgaged ${tile.name} for ₹${fmt(cost)}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * buildHouse — Build one house on a property.
 * Enforces: full monopoly required, even-build rule, bank supply.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const buildHouse = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');

  // canBuildHouse checks ownership, monopoly, even-build, mortgage, hotel
  const check = canBuildHouse(gameState.properties, playerId, tileId);
  if (!check.canBuild) return fail(check.reason);

  if (gameState.houseBank <= 0) return fail('No houses left in the bank');
  if (player.money < tile.houseCost) {
    return fail(`Need ₹${fmt(tile.houseCost)} to build a house`);
  }

  player.money       -= tile.houseCost;
  prop.houses        += 1;
  gameState.houseBank -= 1;

  const events = [evt(
    EVENT_TYPES.HOUSE_BUILT,
    { playerId, tileId, houses: prop.houses, cost: tile.houseCost, newBalance: player.money },
    `🏠 ${player.username} built a house on ${tile.name} — ${prop.houses} house(s) now`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * buildHotel — Upgrade 4 houses to a hotel on a property.
 * Returns the 4 houses to the bank.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const buildHotel = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');

  const check = canBuildHotel(gameState.properties, playerId, tileId);
  if (!check.canBuild) return fail(check.reason);

  if (gameState.hotelBank <= 0) return fail('No hotels left in the bank');
  if (player.money < tile.houseCost) {
    return fail(`Need ₹${fmt(tile.houseCost)} to build a hotel`);
  }

  player.money        -= tile.houseCost;
  gameState.houseBank += HOUSES_PER_HOTEL;  // return 4 houses to bank
  gameState.hotelBank -= 1;
  prop.houses          = 0;
  prop.hotel           = true;
  player.hotelsBuiltCount = (player.hotelsBuiltCount ?? 0) + 1;

  const events = [evt(
    EVENT_TYPES.HOTEL_BUILT,
    { playerId, tileId, cost: tile.houseCost, newBalance: player.money },
    `🏨 ${player.username} built a HOTEL on ${tile.name}!`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * sellHouse — Sell one house back to the bank at half house cost.
 * Enforces even-sell rule: cannot leave this property with fewer houses
 * than any sibling in the same color group.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const sellHouse = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');
  if (!tile || !prop)               return fail('Invalid tile');
  if (prop.ownerId !== playerId)    return fail('You do not own this property');

  if (prop.hotel) {
    return fail('Sell hotel first using sellHotel()');
  }
  if (prop.houses <= 0) {
    return fail('No houses to sell on this property');
  }

  // Even-sell rule: cannot sell below minimum houses in group
  const groupTiles = Object.values(gameState.properties)
    .filter((p) => {
      const t = TILE_BY_ID[p.tileId];
      return t && t.type === TILE_TYPES.PROPERTY &&
             t.group === tile.group && p.tileId !== tileId;
    });

  const minSiblingHouses = groupTiles.length > 0
    ? Math.min(...groupTiles.map((p) => p.hotel ? HOUSES_PER_HOTEL : p.houses))
    : 0;

  if (prop.houses - 1 < minSiblingHouses) {
    return fail('Must sell evenly — sell on higher-house properties in the group first');
  }

  const refund     = Math.floor(tile.houseCost / 2);
  player.money    += refund;
  prop.houses     -= 1;
  gameState.houseBank += 1;

  const events = [evt(
    EVENT_TYPES.HOUSE_SOLD,
    { playerId, tileId, houses: prop.houses, refund, newBalance: player.money },
    `${player.username} sold a house on ${tile.name} for ₹${fmt(refund)}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * sellHotel — Sell a hotel back to the bank.
 * Returns hotel to bank and gives back 4 houses (if bank has them).
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const sellHotel = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  const tile   = TILE_BY_ID[tileId];
  const prop   = gameState.properties[tileId];

  if (!player || player.isBankrupt) return fail('Invalid player');
  if (!tile || !prop)               return fail('Invalid tile');
  if (prop.ownerId !== playerId)    return fail('You do not own this property');
  if (!prop.hotel)                  return fail('No hotel on this property');

  const refund = Math.floor(tile.houseCost / 2);

  // Return hotel, give back up to 4 houses from bank
  const housesReturned = Math.min(HOUSES_PER_HOTEL, gameState.houseBank);
  gameState.hotelBank += 1;
  gameState.houseBank -= housesReturned;
  prop.hotel           = false;
  prop.houses          = housesReturned;
  player.money        += refund;

  const events = [evt(
    EVENT_TYPES.HOTEL_SOLD,
    { playerId, tileId, houses: prop.houses, refund, newBalance: player.money },
    `${player.username} sold the hotel on ${tile.name} for ₹${fmt(refund)}, now has ${prop.houses} houses`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 5. RENT SYSTEM ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _payRent — Internal. Deduct rent from landing player, credit owner.
 * Uses calculateRent() from boardData (handles all cases: property,
 * railway, utility, monopoly doubling, mortgaged, etc.)
 *
 * @param {Object} gameState
 * @param {Object} landingPlayer — player object who landed (reference)
 * @param {number} tileId
 * @param {Array}  events
 */
const _payRent = (gameState, landingPlayer, tileId, events) => {
  const prop = gameState.properties[tileId];
  if (!prop || !prop.ownerId) return;

  const owner   = gameState.players[prop.ownerId];
  if (!owner || owner.isBankrupt) return;

  const tile      = TILE_BY_ID[tileId];
  const diceTotal = gameState.lastDice.total;

  // calculateRent handles all cases (railway count, utility multiplier, monopoly)
  const rent = calculateRent(
    gameState.properties,
    gameState.players,
    tileId,
    landingPlayer.id,
    diceTotal,
  );

  if (rent <= 0) return;

  // Full rent payment (allows negative balance)
  landingPlayer.money -= rent;
  owner.money         += rent;
  owner.rentCollected = (owner.rentCollected ?? 0) + rent;
  landingPlayer.rentPaidAmount = (landingPlayer.rentPaidAmount ?? 0) + rent;
  if (landingPlayer.money < 0) {
    landingPlayer.creditorId = owner.id;
  }
  events.push(evt(
    EVENT_TYPES.RENT_PAID,
    {
      fromId:     landingPlayer.id,
      toId:       owner.id,
      tileId,
      amount:     rent,
      fromBalance: landingPlayer.money,
      toBalance:   owner.money,
      partial:    landingPlayer.money < 0,
    },
    `${landingPlayer.username} paid ₹${fmt(rent)} rent to ${owner.username} for ${tile.name}${landingPlayer.money < 0 ? ' (went into debt!)' : ''}`,
  ));
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 6. JAIL SYSTEM ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * payJailFine — Pay ₹500 fine to leave jail before rolling.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const payJailFine = (gameState, playerId) => {
  const guardResult = guardTurn(gameState, playerId);
  if (!guardResult.ok) return guardResult;

  const player = gameState.players[playerId];

  if (!player.inJail)          return fail('You are not in jail');
  if (gameState.hasRolled)     return fail('Cannot pay fine after rolling — use your roll result');
  if (player.money < JAIL_FINE) return fail(`Need ₹${fmt(JAIL_FINE)} to pay fine`);

  player.money             -= JAIL_FINE;
  gameState.freeParkingPot += JAIL_FINE;
  player.inJail             = false;
  player.jailTurnsUsed      = 0;

  const events = [evt(
    EVENT_TYPES.JAIL_FINE_PAID,
    { playerId, amount: JAIL_FINE, newBalance: player.money },
    `${player.username} paid ₹${fmt(JAIL_FINE)} fine to leave Tihar Jail`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * useJailCard — Use Get Out of Jail Free card.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const useJailCard = (gameState, playerId) => {
  const guardResult = guardTurn(gameState, playerId);
  if (!guardResult.ok) return guardResult;

  const player = gameState.players[playerId];

  if (!player.inJail)      return fail('You are not in jail');
  if (!player.jailCard)    return fail('You do not have a Get Out of Jail Free card');
  if (gameState.hasRolled) return fail('Cannot use card after rolling');

  player.jailCard       = false;
  player.inJail         = false;
  player.jailTurnsUsed  = 0;

  const events = [evt(
    EVENT_TYPES.JAIL_CARD_USED,
    { playerId },
    `${player.username} used Get Out of Jail Free card 🎟️`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * _sendToJail — Internal helper. Moves a player to Tihar Jail (tile 10)
 * without passing GO (so no ₹2,000 reward).
 */
const _sendToJail = (gameState, player, events) => {
  player.position       = JAIL_TILE;
  player.inJail         = true;
  player.jailTurnsUsed  = 0;
  player.doublesStreak  = 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 7. CARD EFFECT SYSTEM ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _applyCardEffect — Dispatch card effect to appropriate handler.
 * Internal. All 7 EFFECT_TYPES handled exhaustively.
 *
 * @param {Object} gameState
 * @param {Object} player    — current player (reference)
 * @param {Object} card      — card drawn (from cards.js)
 * @param {Array}  events    — push new events here
 */
const _applyCardEffect = (gameState, player, card, events) => {
  if (!isValidCard(card)) {
    console.error('[gameEngine] Invalid card received:', card);
    return;
  }

  const { effect } = card;

  switch (effect.type) {

    // ── Money adjust ────────────────────────────────────────────────────────
    case EFFECT_TYPES.MONEY: {
      const amount = effect.amount;
      if (amount >= 0) {
        player.money += amount;
        events.push(evt(
          EVENT_TYPES.CARD_EFFECT_APPLIED,
          { playerId: player.id, effect, newBalance: player.money },
          `${player.username} collected ₹${fmt(amount)} — ${card.title}`,
        ));
      } else {
        const pay = Math.abs(amount);
        player.money             -= pay;
        gameState.freeParkingPot += pay;
        if (player.money < 0) {
          player.creditorId = null;
        }
        events.push(evt(
          EVENT_TYPES.CARD_EFFECT_APPLIED,
          { playerId: player.id, effect, newBalance: player.money },
          `${player.username} paid ₹${fmt(pay)} — ${card.title}${player.money < 0 ? ' (went into debt!)' : ''}`,
        ));
      }
      break;
    }

    // ── Move to specific tile or move back N spaces ──────────────────────
    case EFFECT_TYPES.MOVE: {
      if (typeof effect.moveBack === 'number') {
        // Move backward
        const oldPos = player.position;
        const newPos = ((oldPos - effect.moveBack) + BOARD_SIZE) % BOARD_SIZE;
        player.position = newPos;
        events.push(evt(
          EVENT_TYPES.PLAYER_MOVED,
          { playerId: player.id, from: oldPos, to: newPos, moveBack: effect.moveBack },
          `${player.username} moved back ${effect.moveBack} spaces`,
        ));
        _processTileLanding(gameState, player, newPos, events);
      } else if (typeof effect.tileId === 'number') {
        _teleportPlayer(
          gameState,
          player,
          effect.tileId,
          effect.collectGoReward !== false,  // default true
          events,
        );
      }
      break;
    }

    // ── Advance to nearest railway or utility ────────────────────────────
    case EFFECT_TYPES.NEAREST: {
      const targetIds = effect.nearest === 'railway' ? RAILWAY_TILE_IDS : UTILITY_TILE_IDS;
      const nearest   = findNearestTile(player.position, targetIds);
      if (nearest === null) break;

      // If owned, mark for double rent (utility rule for NEAREST card)
      const nearestProp = gameState.properties[nearest];
      if (nearestProp && nearestProp.ownerId && nearestProp.ownerId !== player.id) {
        // Double rent: temporarily override — we re-calculate directly
        const tile      = TILE_BY_ID[nearest];
        const diceTotal = gameState.lastDice.total;

        // For nearest railway → pay as if owner had 2 railways (Monopoly rule)
        // For nearest utility → pay × 10 regardless of ownership count
        let doubleRent;
        if (effect.nearest === 'railway') {
          const owned = countRailwaysOwned(gameState.properties, nearestProp.ownerId);
          doubleRent  = tile.rent[Math.max(0, owned - 1)] * 2;
        } else {
          doubleRent = diceTotal * tile.rent[1]; // × 10 multiplier
        }

        const owner = gameState.players[nearestProp.ownerId];
        if (owner && !owner.isBankrupt) {
          const actual = Math.min(doubleRent, player.money);
          player.money -= actual;
          owner.money  += actual;
          owner.rentCollected = (owner.rentCollected ?? 0) + actual;
          player.rentPaidAmount = (player.rentPaidAmount ?? 0) + actual;
          events.push(evt(
            EVENT_TYPES.RENT_PAID,
            {
              fromId:  player.id,
              toId:    owner.id,
              tileId:  nearest,
              amount:  actual,
              double:  true,
            },
            `${player.username} paid DOUBLE rent ₹${fmt(actual)} to ${owner.username} (card rule)`,
          ));

          if (actual < doubleRent) {
            const bkEvents = _processBankruptcy(gameState, player.id, owner.id);
            events.push(...bkEvents);
          }
        }
      }

      // Move there (will re-land and process tile, but rent already handled above)
      _teleportPlayer(gameState, player, nearest, true, events);
      break;
    }

    // ── Property repairs ────────────────────────────────────────────────────
    case EFFECT_TYPES.REPAIRS: {
      let total = 0;
      Object.values(gameState.properties).forEach((prop) => {
        if (prop.ownerId === player.id) {
          total += prop.houses * effect.perHouse;
          if (prop.hotel) total += effect.perHotel;
        }
      });

      if (total > 0) {
        player.money             -= total;
        gameState.freeParkingPot += total;
        if (player.money < 0) {
          player.creditorId = null;
        }
        events.push(evt(
          EVENT_TYPES.CARD_EFFECT_APPLIED,
          { playerId: player.id, effect, amount: total, newBalance: player.money },
          `${player.username} paid ₹${fmt(total)} in property repairs — ${card.title}${player.money < 0 ? ' (went into debt!)' : ''}`,
        ));
      }
      break;
    }

    // ── Collect from all players ────────────────────────────────────────────
    case EFFECT_TYPES.COLLECT_FROM_ALL: {
      const perPlayer = effect.perPlayer;
      let totalCollected = 0;

      Object.values(gameState.players).forEach((other) => {
        if (other.id === player.id || other.isBankrupt) return;
        other.money -= perPlayer;
        if (other.money < 0) {
          other.creditorId = player.id;
        }
      });

      player.money += perPlayer * Object.values(gameState.players).filter(o => o.id !== player.id && !o.isBankrupt).length;
      events.push(evt(
        EVENT_TYPES.CARD_EFFECT_APPLIED,
        { playerId: player.id, effect, amount: totalCollected, newBalance: player.money },
        `${player.username} collected ₹${fmt(perPlayer)} from each player — ${card.title}`,
      ));
      break;
    }

    // ── Go to jail ──────────────────────────────────────────────────────────
    case EFFECT_TYPES.JAIL: {
      _sendToJail(gameState, player, events);
      events.push(evt(
        EVENT_TYPES.SENT_TO_JAIL,
        { playerId: player.id, reason: 'card' },
        `${player.username} is sent to Tihar Jail by card: ${card.title} 🚔`,
      ));
      break;
    }

    // ── Get Out of Jail Free card ───────────────────────────────────────────
    case EFFECT_TYPES.GET_OUT_OF_JAIL: {
      player.jailCard = true;
      events.push(evt(
        EVENT_TYPES.JAIL_CARD_RECEIVED,
        { playerId: player.id },
        `${player.username} received a Get Out of Jail Free card 🎟️`,
      ));
      break;
    }

    default:
      console.warn('[gameEngine] Unknown card effect type:', effect.type);
      break;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NET WORTH & RANKING ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getPlayerRankingData — Calculate net worth for all players and return them ranked.
 * @param {Object} gameState
 * @returns {Array}
 */
const getPlayerRankingData = (gameState) => {
  return Object.keys(gameState.players).map((playerId) => {
    const player = gameState.players[playerId];
    let cash = player.money;
    let outstandingDebts = player.loanActive ? player.loanRepaymentAmount : 0;
    
    let propertiesValue = 0;
    let housesValue = 0;
    let hotelsValue = 0;
    let mortgageValue = 0;
    let propertiesOwnedCount = 0;
    let housesCount = 0;
    let hotelsCount = 0;
    
    Object.entries(gameState.properties).forEach(([tileId, prop]) => {
      if (prop.ownerId !== playerId) return;
      const tile = TILE_BY_ID[tileId];
      if (!tile) return;
      
      propertiesOwnedCount++;
      if (prop.mortgaged) {
        mortgageValue += tile.mortgage;
      } else {
        propertiesValue += tile.price;
        if (prop.houses > 0) {
          housesCount += prop.houses;
          housesValue += prop.houses * tile.houseCost;
        }
        if (prop.hotel) {
          hotelsCount += 1;
          hotelsValue += tile.houseCost;
        }
      }
    });
    
    const netWorth = cash + propertiesValue + housesValue + hotelsValue + mortgageValue - outstandingDebts;
    
    return {
      playerId,
      username: player.username,
      cash,
      propertiesOwnedCount,
      housesCount,
      hotelsCount,
      propertiesValue,
      housesValue,
      hotelsValue,
      mortgageValue,
      outstandingDebts,
      netWorth,
      isBankrupt: player.isBankrupt,
      rentCollected: player.rentCollected ?? 0,
      loansTaken: player.loansTakenCount ?? 0,
      propertiesRepossessed: player.propertiesRepossessedCount ?? 0,
      propertiesPurchased: player.propertiesPurchasedCount ?? 0,
      propertiesMortgaged: player.propertiesMortgagedCount ?? 0,
      auctionsWon: player.auctionsWonCount ?? 0,
      rentPaid: player.rentPaidAmount ?? 0,
      rentEarned: player.rentCollected ?? 0,
      hotelsBuiltCount: player.hotelsBuiltCount ?? 0,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 8. BANKRUPTCY ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _processBankruptcy — Internal. Eliminates a player and redistributes assets.
 *
 * If creditorId is provided → assets go to that player.
 * If creditorId is null     → assets return to the bank (properties become unowned).
 *
 * @param {Object}      gameState
 * @param {string}      bankruptPlayerId
 * @param {string|null} creditorId       — player owed the debt (or null = bank)
 * @returns {GameEvent[]}
 */
const _processBankruptcy = (gameState, bankruptPlayerId, creditorId) => {
  const events  = [];
  const player  = gameState.players[bankruptPlayerId];
  if (!player || player.isBankrupt) return events;

  player.isBankrupt = true;

  // Transfer remaining cash
  if (creditorId && gameState.players[creditorId] && !gameState.players[creditorId].isBankrupt) {
    gameState.players[creditorId].money += player.money;
  }
  player.money = 0;

  const repossessedList = [];
  gameState.queuedAuctions = gameState.queuedAuctions || [];

  // Transfer / return all properties
  Object.values(gameState.properties).forEach((prop) => {
    if (prop.ownerId !== bankruptPlayerId) return;

    if (prop.mortgaged) {
      // Mortgaged property always repossessed by the bank
      if (prop.hotel) {
        gameState.hotelBank += 1;
        prop.hotel = false;
      }
      if (prop.houses > 0) {
        gameState.houseBank += prop.houses;
        prop.houses = 0;
      }
      prop.mortgaged = false;
      prop.ownerId   = null;
      repossessedList.push(prop.tileId);
    } else {
      if (creditorId && gameState.players[creditorId] && !gameState.players[creditorId].isBankrupt) {
        // Transfer unmortgaged property to creditor — strip buildings first
        if (prop.hotel) {
          gameState.hotelBank += 1;
          prop.hotel = false;
        }
        if (prop.houses > 0) {
          gameState.houseBank += prop.houses;
          prop.houses = 0;
        }
        prop.mortgaged = false;
        prop.ownerId   = creditorId;
      } else {
        // Return unmortgaged property to bank
        if (prop.hotel) {
          gameState.hotelBank += 1;
          prop.hotel = false;
        }
        if (prop.houses > 0) {
          gameState.houseBank += prop.houses;
          prop.houses = 0;
        }
        prop.mortgaged = false;
        prop.ownerId   = null;
        repossessedList.push(prop.tileId);
      }
    }
  });

  // Return jail card to deck (effectively discard)
  player.jailCard = false;

  const creditorName = creditorId
    ? gameState.players[creditorId]?.username ?? 'another player'
    : 'the bank';

  events.push(evt(
    EVENT_TYPES.PLAYER_BANKRUPTED,
    { playerId: bankruptPlayerId, creditorId },
    `💸 ${player.username} is BANKRUPT! Assets transferred to ${creditorName}`,
  ));

  // Log and register repossession
  if (repossessedList.length > 0) {
    player.propertiesRepossessedCount = (player.propertiesRepossessedCount ?? 0) + repossessedList.length;
    repossessedList.forEach((tileId) => {
      const tile = TILE_BY_ID[tileId];
      events.push(evt(
        EVENT_TYPES.BANK_REPOSSESSION,
        { playerId: bankruptPlayerId, tileId },
        `🏦 The Bank repossessed ${tile.name} and returned it to circulation`,
      ));
    });
  }

  // Check win condition
  _checkWinCondition(gameState, events);

  // Properties are returned directly to the bank as unowned (for sale) instead of being queued for auction.

  return events;
};

/**
 * _checkWinCondition — If only one player remains active, they win.
 */
const _checkWinCondition = (gameState, events) => {
  const activePlayers = Object.values(gameState.players).filter((p) => !p.isBankrupt);

  if (activePlayers.length === 1) {
    const winner         = activePlayers[0];
    gameState.status     = 'finished';
    gameState.winnerId   = winner.id;
    
    // Compute ranking on game end
    const ranking = getPlayerRankingData(gameState);
    ranking.sort((a, b) => b.netWorth - a.netWorth);
    gameState.ranking = ranking;

    events.push(evt(
      EVENT_TYPES.GAME_WON,
      { winnerId: winner.id, username: winner.username },
      `🏆 ${winner.username} WINS Indian Monopoly! Jai Hind! 🇮🇳`,
    ));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 9. TURN SYSTEM ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * endTurn — Current player voluntarily ends their turn.
 * Advances turn to next non-bankrupt player.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const endTurn = (gameState, playerId) => {
  const guardResult = guardTurn(gameState, playerId);
  if (!guardResult.ok) return guardResult;

  const player = gameState.players[playerId];
  if (player && player.money < 0) {
    return fail('You cannot end your turn with a negative balance! Sell buildings, mortgage properties, take a loan, or declare bankruptcy first.');
  }
  if (player) {
    player.creditorId = null;
  }
  if (!gameState.hasRolled) {
    return fail('You must roll the dice before ending your turn');
  }

  if (gameState.pendingAction === 'buy_decision') {
    // Player skipped buying — clear pendingAction and advance turn directly
    gameState.pendingAction = null;
    const events = _advanceTurn(gameState);
    _appendLog(gameState, events);
    return ok(events);
  }

  const events = _advanceTurn(gameState);
  _appendLog(gameState, events);
  return ok(events);
};

/**
 * _advanceTurn — Internal. Move currentTurnIdx to next non-bankrupt player.
 * @returns {GameEvent[]}
 */
const _advanceTurn = (gameState) => {
  const events          = [];
  const prevPlayerId    = gameState.turnOrder[gameState.currentTurnIdx];
  const prevPlayer      = gameState.players[prevPlayerId];

  // Reset turn state
  if (prevPlayer) {
    prevPlayer.hasRolledThisTurn = false;
    prevPlayer.doublesStreak     = 0;
  }
  gameState.hasRolled     = false;
  gameState.pendingAction = null;
  gameState.activeTrade   = null;

  // Find next non-bankrupt player
  let nextIdx = gameState.currentTurnIdx;
  let attempts = 0;
  do {
    nextIdx = (nextIdx + 1) % gameState.turnOrder.length;
    attempts++;
    // Safety: if everyone is bankrupt (shouldn't happen — game ends first)
    if (attempts > gameState.turnOrder.length) break;
  } while (gameState.players[gameState.turnOrder[nextIdx]]?.isBankrupt);

  // Detect new round
  if (nextIdx <= gameState.currentTurnIdx) {
    gameState.round += 1;
  }

  gameState.currentTurnIdx = nextIdx;
  gameState.turnStartedAt  = Date.now();

  const nextPlayerId = gameState.turnOrder[nextIdx];
  const nextPlayer   = gameState.players[nextPlayerId];

  events.push(evt(
    EVENT_TYPES.TURN_ENDED,
    { previousPlayerId: prevPlayerId, nextPlayerId },
    '',
  ));

  events.push(evt(
    EVENT_TYPES.TURN_STARTED,
    { playerId: nextPlayerId, round: gameState.round },
    `⏩ ${nextPlayer?.username ?? '?'}'s turn`,
  ));

  if (nextPlayer && nextPlayer.loanActive) {
    nextPlayer.loanTurnsRemaining -= 1;
    if (nextPlayer.loanTurnsRemaining === 1) {
      events.push(evt(
        EVENT_TYPES.LOAN_REPAYMENT_DUE,
        { playerId: nextPlayerId, turnsRemaining: 1 },
        `📉 Loan repayment due next turn for ${nextPlayer.username}`
      ));
    } else if (nextPlayer.loanTurnsRemaining <= 0) {
      const repaymentAmount = nextPlayer.loanRepaymentAmount;
      if (nextPlayer.money >= repaymentAmount) {
        nextPlayer.money -= repaymentAmount;
        nextPlayer.loanActive = false;
        nextPlayer.loanAmount = 0;
        nextPlayer.loanRepaymentAmount = 0;
        nextPlayer.loanTurnsRemaining = 0;
        events.push(evt(
          EVENT_TYPES.LOAN_REPAID,
          { playerId: nextPlayerId, repaymentAmount, newBalance: nextPlayer.money },
          `💰 ${nextPlayer.username} repaid ₹${fmt(repaymentAmount)} bank loan`
        ));
      } else {
        const liquidationEvents = _liquidateAssetsForDebt(gameState, nextPlayerId, repaymentAmount);
        events.push(...liquidationEvents);

        if (nextPlayer.money >= repaymentAmount) {
          nextPlayer.money -= repaymentAmount;
          nextPlayer.loanActive = false;
          nextPlayer.loanAmount = 0;
          nextPlayer.loanRepaymentAmount = 0;
          nextPlayer.loanTurnsRemaining = 0;
          events.push(evt(
            EVENT_TYPES.LOAN_REPAID,
            { playerId: nextPlayerId, repaymentAmount, newBalance: nextPlayer.money },
            `💰 ${nextPlayer.username} repaid ₹${fmt(repaymentAmount)} bank loan`
          ));
        } else {
          events.push(evt(
            EVENT_TYPES.LOAN_DEFAULTED,
            { playerId: nextPlayerId },
            `⚠️ ${nextPlayer.username} defaulted on bank loan`
          ));
          nextPlayer.loanActive = false;
          nextPlayer.loanAmount = 0;
          nextPlayer.loanRepaymentAmount = 0;
          nextPlayer.loanTurnsRemaining = 0;
          const bkEvents = _processBankruptcy(gameState, nextPlayerId, null);
          events.push(...bkEvents);
        }
      }
    }
  }

  return events;
};

/**
 * skipAfkTurn — Called by server timeout handler when a player does not act
 * within TURN_TIMEOUT_SECONDS. If they haven't rolled, auto-roll for them
 * but do nothing with the result (take no buy actions). Then end turn.
 *
 * @param {Object} gameState
 * @returns {{ ok, events, error? }}
 */
const skipAfkTurn = (gameState) => {
  if (gameState.status !== 'playing') return fail('Game not active');

  const currentPlayerId = currentPlayer(gameState)?.id;
  if (!currentPlayerId) return fail('No active player');

  const events = [];
  const player = gameState.players[currentPlayerId];

  if (player && player.money < 0) {
    // Player failed to resolve debt shortfall and timed out — auto-bankrupt!
    const creditorId = player.creditorId || null;
    const bkEvents = _processBankruptcy(gameState, currentPlayerId, creditorId);
    events.push(...bkEvents);

    // Advance turn unless an auction is now pending
    const currentCP = currentPlayer(gameState);
    if (currentCP && currentCP.id === currentPlayerId) {
      if (gameState.pendingAction !== 'auction') {
        const advanceEvents = _advanceTurn(gameState);
        events.push(...advanceEvents);
      }
    }
  } else {
    if (!gameState.hasRolled) {
      // Auto-roll
      const rollResult = rollDice(gameState, currentPlayerId);
      events.push(...rollResult.events);
    }

    // Force end turn (skip buy decision)
    gameState.pendingAction = null;
    const advEvents = _advanceTurn(gameState);
    events.push(...advEvents);
  }

  _appendLog(gameState, events);
  return ok(events);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 10. TRADING SYSTEM (hooks + placeholders) ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TradeOffer schema:
 * {
 *   fromPlayerId:  string
 *   toPlayerId:    string
 *   offer: {
 *     money:       number         (0 if none)
 *     propertyIds: number[]       (tile IDs)
 *   }
 *   request: {
 *     money:       number
 *     propertyIds: number[]
 *   }
 *   status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'cancelled'
 *   tradeId: string
 * }
 */

/**
 * initiateTrade — Propose a trade to another player.
 *
 * @param {Object} gameState
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @param {{ money: number, propertyIds: number[] }} offer
 * @param {{ money: number, propertyIds: number[] }} request
 * @returns {{ ok, events, error? }}
 */
const initiateTrade = (gameState, fromPlayerId, toPlayerId, offer, request) => {
  if (gameState.status !== 'playing') return fail('Game not active');

  const fromPlayer = gameState.players[fromPlayerId];
  const toPlayer   = gameState.players[toPlayerId];

  if (!fromPlayer || fromPlayer.isBankrupt) return fail('Invalid proposer');
  if (!toPlayer   || toPlayer.isBankrupt)   return fail('Target player is not active');
  if (fromPlayerId === toPlayerId)           return fail('Cannot trade with yourself');
  if (gameState.activeTrade)                return fail('A trade is already in progress');
  if (fromPlayer.money < 0 || toPlayer.money < 0) {
    return fail('Players in debt cannot participate in trades');
  }

  if (!offer || !request) {
    return fail('Invalid trade payload');
  }

  const offerMoney = offer.money ?? 0;
  const requestMoney = request.money ?? 0;

  if (typeof offerMoney !== 'number' || !Number.isFinite(offerMoney) || offerMoney < 0) {
    return fail('Offer money must be a valid non-negative number');
  }
  if (typeof requestMoney !== 'number' || !Number.isFinite(requestMoney) || requestMoney < 0) {
    return fail('Request money must be a valid non-negative number');
  }

  // Validate offer money
  if (offerMoney > fromPlayer.money) {
    return fail('You cannot offer more money than you have');
  }
  // Validate offer properties
  for (const tileId of (offer.propertyIds ?? [])) {
    if (gameState.properties[tileId]?.ownerId !== fromPlayerId) {
      return fail(`You do not own property at tile ${tileId}`);
    }
  }
  // Validate request money
  if (requestMoney > toPlayer.money) {
    return fail('Target player does not have that much money');
  }
  // Validate request properties
  for (const tileId of (request.propertyIds ?? [])) {
    if (gameState.properties[tileId]?.ownerId !== toPlayerId) {
      return fail(`Target player does not own property at tile ${tileId}`);
    }
  }

  const allIds = [...(offer.propertyIds || []), ...(request.propertyIds || [])];
  for (const tileId of allIds) {
    const groupTiles = getColorGroupTiles(tileId);
    const groupHasBuildings = groupTiles.some(
      (id) => gameState.properties[id]?.houses > 0 || gameState.properties[id]?.hotel
    );
    if (groupHasBuildings) {
      return fail('Cannot trade properties in a color group that contains houses or hotels');
    }
  }

  const tradeId = `trade_${Date.now()}_${fromPlayerId}`;

  gameState.activeTrade = {
    tradeId,
    fromPlayerId,
    toPlayerId,
    offer:   { money: offerMoney,   propertyIds: offer.propertyIds ?? [] },
    request: { money: requestMoney, propertyIds: request.propertyIds ?? [] },
    status: 'pending',
    initiatedAt: Date.now(),
  };

  const events = [evt(
    EVENT_TYPES.TRADE_INITIATED,
    { tradeId, fromPlayerId, toPlayerId, offer, request },
    `🤝 ${fromPlayer.username} proposed a trade to ${toPlayer.username}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * acceptTrade — Target player accepts the active trade.
 * Executes the property and money transfers atomically.
 *
 * @param {Object} gameState
 * @param {string} playerId   — must be the toPlayerId of active trade
 * @returns {{ ok, events, error? }}
 */
const acceptTrade = (gameState, playerId) => {
  const trade = gameState.activeTrade;
  if (!trade)                       return fail('No trade in progress');
  if (trade.toPlayerId !== playerId) return fail('You are not the trade recipient');
  if (trade.status !== 'pending')    return fail('Trade is no longer pending');

  const fromPlayer = gameState.players[trade.fromPlayerId];
  const toPlayer   = gameState.players[trade.toPlayerId];

  // Final validation before execution (balances may have changed)
  let cancelReason = null;
  if (fromPlayer.money < 0 || toPlayer.money < 0) {
    cancelReason = 'Players in debt cannot participate in trades';
  } else if (fromPlayer.money < trade.offer.money) {
    cancelReason = `${fromPlayer.username} no longer has sufficient funds`;
  } else if (toPlayer.money < trade.request.money) {
    cancelReason = `${toPlayer.username} no longer has sufficient funds`;
  } else {
    for (const tileId of trade.offer.propertyIds) {
      if (gameState.properties[tileId]?.ownerId !== trade.fromPlayerId) {
        cancelReason = `Offered property ${TILE_BY_ID[tileId]?.name ?? 'property'} is no longer owned by ${fromPlayer.username}`;
        break;
      }
    }
    if (!cancelReason) {
      for (const tileId of trade.request.propertyIds) {
        if (gameState.properties[tileId]?.ownerId !== trade.toPlayerId) {
          cancelReason = `Requested property ${TILE_BY_ID[tileId]?.name ?? 'property'} is no longer owned by ${toPlayer.username}`;
          break;
        }
      }
    }
  }

  if (cancelReason) {
    trade.status = 'cancelled';
    gameState.activeTrade = null;
    const events = [evt(
      EVENT_TYPES.TRADE_CANCELLED,
      { tradeId: trade.tradeId, fromPlayerId: trade.fromPlayerId, toPlayerId: trade.toPlayerId, reason: cancelReason },
      `⚠️ Trade cancelled: ${cancelReason}`,
    )];
    _appendLog(gameState, events);
    return ok(events);
  }
  // ── Execute transfers ────────────────────────────────────────────────────
  // Money
  fromPlayer.money -= trade.offer.money;
  toPlayer.money   += trade.offer.money;
  toPlayer.money   -= trade.request.money;
  fromPlayer.money += trade.request.money;

  // Offered properties → to target player
  trade.offer.propertyIds.forEach((tileId) => {
    const prop = gameState.properties[tileId];
    if (prop) prop.ownerId = trade.toPlayerId;
  });

  // Requested properties → to proposer
  trade.request.propertyIds.forEach((tileId) => {
    const prop = gameState.properties[tileId];
    if (prop) prop.ownerId = trade.fromPlayerId;
  });

  trade.status          = 'accepted';
  gameState.activeTrade = null;

  const events = [evt(
    EVENT_TYPES.TRADE_COMPLETED,
    { trade },
    `✅ Trade completed between ${fromPlayer.username} and ${toPlayer.username}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * rejectTrade — Target player rejects the active trade.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const rejectTrade = (gameState, playerId) => {
  const trade = gameState.activeTrade;
  if (!trade)                       return fail('No trade in progress');
  if (trade.toPlayerId !== playerId) return fail('You are not the trade recipient');

  trade.status          = 'rejected';
  gameState.activeTrade = null;

  const fromPlayer = gameState.players[trade.fromPlayerId];
  const toPlayer   = gameState.players[trade.toPlayerId];

  const events = [evt(
    EVENT_TYPES.TRADE_REJECTED,
    { tradeId: trade.tradeId, fromPlayerId: trade.fromPlayerId, toPlayerId: trade.toPlayerId },
    `❌ ${toPlayer?.username} rejected ${fromPlayer?.username}'s trade offer`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * cancelTrade — Proposer cancels their own pending trade.
 *
 * @param {Object} gameState
 * @param {string} playerId   — must be the fromPlayerId
 * @returns {{ ok, events, error? }}
 */
const cancelTrade = (gameState, playerId) => {
  const trade = gameState.activeTrade;
  if (!trade)                         return fail('No trade in progress');
  if (trade.fromPlayerId !== playerId) return fail('You did not initiate this trade');

  trade.status          = 'cancelled';
  gameState.activeTrade = null;

  const events = [evt(
    EVENT_TYPES.TRADE_CANCELLED,
    { tradeId: trade.tradeId },
    `Trade cancelled by ${gameState.players[playerId]?.username}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * counterTrade — The trade recipient proposes a counter-offer.
 * Swaps fromPlayerId and toPlayerId, updates the offer/request details, and keeps the trade active under 'pending' status.
 *
 * @param {Object} gameState
 * @param {string} playerId   — player who is countering (must be the toPlayerId of active trade)
 * @param {{ money: number, propertyIds: number[] }} offer    — new offer from the countering player
 * @param {{ money: number, propertyIds: number[] }} request  — new request from the countering player
 * @returns {{ ok, events, error? }}
 */
const counterTrade = (gameState, playerId, offer, request) => {
  if (gameState.status !== 'playing') return fail('Game not active');

  const trade = gameState.activeTrade;
  if (!trade)                       return fail('No trade in progress');
  if (trade.toPlayerId !== playerId) return fail('You are not the trade recipient');
  if (trade.status !== 'pending')    return fail('Trade is no longer pending');

  const fromPlayer = gameState.players[trade.fromPlayerId]; // original proposer, new target
  const toPlayer   = gameState.players[trade.toPlayerId];   // original target, new proposer (playerId)

  if (!offer || !request) {
    return fail('Invalid counter-trade payload');
  }

  const offerMoney = offer.money ?? 0;
  const requestMoney = request.money ?? 0;

  if (typeof offerMoney !== 'number' || !Number.isFinite(offerMoney) || offerMoney < 0) {
    return fail('Offer money must be a valid non-negative number');
  }
  if (typeof requestMoney !== 'number' || !Number.isFinite(requestMoney) || requestMoney < 0) {
    return fail('Request money must be a valid non-negative number');
  }

  // Validate new offer money (offered by the countering player)
  if (offerMoney > toPlayer.money) {
    return fail('You cannot offer more money than you have');
  }
  // Validate new offer properties (owned by the countering player)
  for (const tileId of (offer.propertyIds ?? [])) {
    if (gameState.properties[tileId]?.ownerId !== playerId) {
      return fail(`You do not own property at tile ${tileId}`);
    }
  }
  // Validate new request money (requested from the original proposer)
  if (requestMoney > fromPlayer.money) {
    return fail('Target player does not have that much money');
  }
  // Validate new request properties (owned by the original proposer)
  for (const tileId of (request.propertyIds ?? [])) {
    if (gameState.properties[tileId]?.ownerId !== trade.fromPlayerId) {
      return fail(`Target player does not own property at tile ${tileId}`);
    }
  }

  // Validate buildings in color groups
  const allIds = [...(offer.propertyIds || []), ...(request.propertyIds || [])];
  for (const tileId of allIds) {
    const groupTiles = getColorGroupTiles(tileId);
    const groupHasBuildings = groupTiles.some(
      (id) => gameState.properties[id]?.houses > 0 || gameState.properties[id]?.hotel
    );
    if (groupHasBuildings) {
      return fail('Cannot trade properties in a color group that contains houses or hotels');
    }
  }

  // Update trade state
  trade.fromPlayerId = playerId;            // Counters is now the proposer
  trade.toPlayerId = fromPlayer.id;          // Original proposer is now target
  trade.offer = { money: offerMoney, propertyIds: offer.propertyIds ?? [] };
  trade.request = { money: requestMoney, propertyIds: request.propertyIds ?? [] };
  trade.initiatedAt = Date.now();

  const events = [evt(
    EVENT_TYPES.TRADE_COUNTERED,
    { tradeId: trade.tradeId, fromPlayerId: trade.fromPlayerId, toPlayerId: trade.toPlayerId, offer: trade.offer, request: trade.request },
    `🤝 ${toPlayer.username} countered the trade offer from ${fromPlayer.username}`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};


// ─────────────────────────────────────────────────────────────────────────────
// ── AUCTION SYSTEM ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _startAuction — Begin an auction for a property the current player declined.
 * Internal helper, called from endTurn when buy_decision was pending.
 *
 * @param {Object} gameState
 * @param {number} tileId
 * @returns {GameEvent}
 */
const _startAuction = (gameState, tileId, disqualifiedPlayerIds = [], ownerId = null) => {
  const tile            = TILE_BY_ID[tileId];
  const activePlayers   = Object.values(gameState.players)
    .filter((p) => !p.isBankrupt && !disqualifiedPlayerIds.includes(p.id) && (!ownerId || p.id !== ownerId))
    .map((p) => p.id);

  gameState.activeAuction = {
    tileId,
    ownerId,
    highBid:       0,
    highBidderId:  null,
    bids:          {},          // { [playerId]: amount }
    participants:  activePlayers,
    passedPlayers: [],
    startedAt:     Date.now(),
  };

  gameState.pendingAction = 'auction';

  return evt(
    EVENT_TYPES.AUCTION_STARTED,
    { tileId, tile, minimumBid: 1, participants: activePlayers, ownerId },
    `🔨 Auction started for ${tile.name}! Minimum bid: ₹1`,
  );
};

/**
 * placeBid — A player places a bid in the active auction.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} amount
 * @returns {{ ok, events, error? }}
 */
const placeBid = (gameState, playerId, amount) => {
  const auction = gameState.activeAuction;
  if (!auction) return fail('No auction in progress');

  const player = gameState.players[playerId];
  if (!player || player.isBankrupt)           return fail('Invalid player');
  if (!auction.participants.includes(playerId)) return fail('You are not part of this auction');
  if (auction.passedPlayers.includes(playerId)) return fail('You already passed on this auction');
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
    return fail('Bid amount must be a valid positive integer');
  }
  if (amount <= auction.highBid)              return fail(`Bid must exceed current high bid of ₹${fmt(auction.highBid)}`);
  if (amount > player.money)                  return fail('Insufficient funds for this bid');

  auction.highBid      = amount;
  auction.highBidderId = playerId;
  auction.bids[playerId] = amount;

  const tile   = TILE_BY_ID[auction.tileId];
  const events = [evt(
    EVENT_TYPES.AUCTION_BID,
    { playerId, amount, tileId: auction.tileId },
    `${player.username} bid ₹${fmt(amount)} for ${tile.name}`,
  )];

  _appendLog(gameState, events);

  const remaining = auction.participants.filter((id) => !auction.passedPlayers.includes(id));
  if (remaining.length === 1) {
    const concludeEvents = _concludeAuction(gameState);
    events.push(...concludeEvents);
  }

  return ok(events);
};

/**
 * passAuction — A player passes (opts out) of the active auction.
 * When all remaining participants have passed, auction ends.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok, events, error? }}
 */
const passAuction = (gameState, playerId) => {
  const auction = gameState.activeAuction;
  if (!auction) return fail('No auction in progress');

  const player = gameState.players[playerId];
  if (!player || player.isBankrupt)             return fail('Invalid player');
  if (!auction.participants.includes(playerId)) return fail('Not an auction participant');
  if (auction.passedPlayers.includes(playerId)) return fail('Already passed');

  auction.passedPlayers.push(playerId);

  const events = [];
  const remaining = auction.participants.filter((id) => !auction.passedPlayers.includes(id));

  if (remaining.length === 0 || (remaining.length === 1 && auction.highBidderId)) {
    // Auction over
    const concludeEvents = _concludeAuction(gameState);
    events.push(...concludeEvents);
  }

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * _concludeAuction — Award property to highest bidder or return unsold.
 * Internal.
 */
const _concludeAuction = (gameState) => {
  const events  = [];
  const auction = gameState.activeAuction;
  if (!auction) return events;

  const tile = TILE_BY_ID[auction.tileId];
  const hasSeller = !!auction.ownerId;

  if (auction.highBidderId && auction.highBid > 0) {
    const winner    = gameState.players[auction.highBidderId];
    if (winner.money < auction.highBid) {
      events.push(evt(
        EVENT_TYPES.AUCTION_NO_SALE,
        { tileId: auction.tileId },
        `⚠️ ${winner.username} has insufficient funds (₹${fmt(winner.money)}) to pay the winning bid of ₹${fmt(auction.highBid)}!`,
      ));

      const tileId = auction.tileId;
      const ownerId = auction.ownerId || null;
      
      const otherParticipants = Object.values(gameState.players)
        .filter((p) => !p.isBankrupt && p.id !== winner.id && (!ownerId || p.id !== ownerId))
        .map((p) => p.id);

      if (otherParticipants.length > 0) {
        gameState.activeAuction = null;
        gameState.pendingAction  = null;
        const restartEvent = _startAuction(gameState, tileId, [winner.id], ownerId);
        events.push(restartEvent);
        return events;
      } else {
        // No other eligible bidders, treat as regular no-sale
        events.push(evt(
          EVENT_TYPES.AUCTION_NO_SALE,
          { tileId: auction.tileId },
          hasSeller
            ? `${tile.name} has no other eligible bidders — remains owned by ${gameState.players[auction.ownerId].username}`
            : `${tile.name} has no other eligible bidders — remains unsold`,
        ));
        
        gameState.activeAuction = null;
        gameState.pendingAction  = null;

        if (!hasSeller) {
          if (gameState.queuedAuctions && gameState.queuedAuctions.length > 0) {
            const nextTileId = gameState.queuedAuctions.shift();
            const auctionEvent = _startAuction(gameState, nextTileId);
            events.push(auctionEvent);
          } else {
            const turnEvents = _advanceTurn(gameState);
            events.push(...turnEvents);
          }
        }
        return events;
      }
    }

    winner.money   -= auction.highBid;
    gameState.properties[auction.tileId].ownerId = auction.highBidderId;
    winner.propertiesPurchasedCount = (winner.propertiesPurchasedCount ?? 0) + 1;
    winner.auctionsWonCount = (winner.auctionsWonCount ?? 0) + 1;

    if (hasSeller) {
      const seller = gameState.players[auction.ownerId];
      seller.money += auction.highBid;
    }

    events.push(evt(
      EVENT_TYPES.AUCTION_WON,
      { winnerId: auction.highBidderId, tileId: auction.tileId, amount: auction.highBid, sellerId: auction.ownerId || null },
      hasSeller
        ? `🏆 ${winner.username} won ${tile.name} at auction from ${gameState.players[auction.ownerId].username} for ₹${fmt(auction.highBid)}!`
        : `🏆 ${winner.username} won ${tile.name} at auction for ₹${fmt(auction.highBid)}!`,
    ));
  } else {
    events.push(evt(
      EVENT_TYPES.AUCTION_NO_SALE,
      { tileId: auction.tileId },
      hasSeller
        ? `${tile.name} received no bids — remains owned by ${gameState.players[auction.ownerId].username}`
        : `${tile.name} received no bids — remains unsold`,
    ));
  }

  gameState.activeAuction = null;
  gameState.pendingAction  = null;

  if (!hasSeller) {
    // Advance turn after bank/unowned auction, unless there are queued repossessed auctions
    if (gameState.queuedAuctions && gameState.queuedAuctions.length > 0) {
      const nextTileId = gameState.queuedAuctions.shift();
      const auctionEvent = _startAuction(gameState, nextTileId);
      events.push(auctionEvent);
    } else {
      const turnEvents = _advanceTurn(gameState);
      events.push(...turnEvents);
    }
  }

  return events;
};

/**
 * auctionProperty — A player puts their owned property up for auction.
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @param {number} tileId
 * @returns {{ ok, events, error? }}
 */
const auctionProperty = (gameState, playerId, tileId) => {
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');



  // Ensure no other critical actions are pending (like roll or card choice)
  if (gameState.pendingAction) {
    return fail(`Cannot start auction while a ${gameState.pendingAction} is pending`);
  }

  const prop = gameState.properties[tileId];
  if (!prop) return fail('Invalid property');
  if (prop.ownerId !== playerId) return fail('You do not own this property');
  if (prop.mortgaged) return fail('Cannot auction a mortgaged property');

  // Check if there are houses/hotels on this property
  if ((prop.houses ?? 0) > 0 || prop.hotel) {
    return fail('Must sell houses/hotels on this property before auctioning');
  }

  // Check if any other property in the color group has houses/hotels
  const tile = TILE_BY_ID[tileId];
  if (tile.group) {
    const hasGroupBuildings = Object.values(gameState.properties).some((p) => {
      const t = TILE_BY_ID[p.tileId];
      return t && t.group === tile.group && ((p.houses ?? 0) > 0 || p.hotel);
    });
    if (hasGroupBuildings) {
      return fail('Must sell all houses/hotels in the color group before auctioning');
    }
  }

  // Set up participants: all active non-bankrupt players EXCEPT the owner
  const participants = Object.values(gameState.players)
    .filter((p) => !p.isBankrupt && p.id !== playerId)
    .map((p) => p.id);

  if (participants.length === 0) {
    return fail('No other players available to participate in the auction');
  }

  gameState.activeAuction = {
    tileId,
    ownerId:       playerId, // The seller
    highBid:       0,
    highBidderId:  null,
    bids:          {},
    participants,
    passedPlayers: [],
    startedAt:     Date.now(),
  };

  gameState.pendingAction = 'auction';

  const events = [evt(
    EVENT_TYPES.AUCTION_STARTED,
    { tileId, tile, minimumBid: 1, participants, ownerId: playerId },
    `🔨 ${player.username} put ${tile.name} up for auction! Minimum bid: ₹1`,
  )];

  _appendLog(gameState, events);
  return ok(events);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── STATE PROJECTION ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getClientState — Return a sanitised, serialisable snapshot of game state
 * safe to broadcast to ALL clients (no server-only internals).
 *
 * The deck arrays are excluded (clients don't need the full shuffle order).
 * The log is trimmed to the last 50 entries.
 *
 * @param {Object} gameState
 * @returns {Object}
 */
const getClientState = (gameState) => ({
  roomId:          gameState.roomId,
  status:          gameState.status,
  round:           gameState.round,
  turnOrder:       gameState.turnOrder,
  currentTurnIdx:  gameState.currentTurnIdx,
  currentPlayerId: currentPlayer(gameState)?.id ?? null,
  hasRolled:       gameState.hasRolled,
  pendingAction:   gameState.pendingAction,
  lastDice:        gameState.lastDice,
  freeParkingPot:  gameState.freeParkingPot,
  houseBank:       gameState.houseBank,
  hotelBank:       gameState.hotelBank,
  winnerId:        gameState.winnerId,
  players:         gameState.players,
  properties:      gameState.properties,
  activeTrade:     gameState.activeTrade,
  activeAuction:   gameState.activeAuction
    ? {
        tileId:        gameState.activeAuction.tileId,
        highBid:       gameState.activeAuction.highBid,
        highBidderId:  gameState.activeAuction.highBidderId,
        participants:  gameState.activeAuction.participants,
        passedPlayers: gameState.activeAuction.passedPlayers,
      }
    : null,
  log: gameState.log.slice(-50),
  // Deck positions (so client can show "X cards remaining" if wanted)
  chanceIndex:    gameState.chanceIndex,
  communityIndex: gameState.communityIndex,
  endGameVote:    gameState.endGameVote || null,
  kickHostVote:   gameState.kickHostVote || null,
  ranking:        gameState.ranking || null,
});

/**
 * getPlayerState — Return state visible only to a specific player.
 * (Currently same as client state — extend if hidden information is needed.)
 *
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {Object}
 */
const getPlayerState = (gameState, playerId) => ({
  ...getClientState(gameState),
  _myId: playerId,
});

// ─────────────────────────────────────────────────────────────────────────────
// ── UTILITY HELPERS ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * currentPlayer — Return the player object whose turn it is.
 * @param {Object} gameState
 * @returns {Object|null}
 */
const currentPlayer = (gameState) => {
  const id = gameState.turnOrder[gameState.currentTurnIdx];
  return id ? gameState.players[id] : null;
};

/**
 * guardTurn — Validate that playerId is allowed to act right now.
 * @param {Object} gameState
 * @param {string} playerId
 * @returns {{ ok: boolean, events?: [], error?: string }}
 */
const guardTurn = (gameState, playerId) => {
  if (gameState.status !== 'playing') return fail('Game is not active');
  const cp = currentPlayer(gameState);
  if (!cp)                          return fail('No active player found');
  if (cp.id !== playerId)           return fail('It is not your turn');
  if (cp.isBankrupt)                return fail('Bankrupt players cannot act');
  return { ok: true, events: [] };
};

/**
 * randomDie — Return a random integer 1–6.
 * @returns {number}
 */
const randomDie = () => crypto.randomInt(1, 7);

/**
 * shuffleArray — Fisher-Yates in-place shuffle. Returns the array.
 * @param {Array} arr
 * @returns {Array}
 */
const shuffleArray = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j    = crypto.randomInt(0, i + 1);
    const tmp  = arr[i];
    arr[i]     = arr[j];
    arr[j]     = tmp;
  }
  return arr;
};

/**
 * fmt — Format a number as Indian rupee string with commas.
 * e.g. 15000 → "15,000"
 * @param {number} n
 * @returns {string}
 */
const fmt = (n) =>
  Number(n).toLocaleString('en-IN');

/**
 * _appendLog — Push event messages into the persistent game log,
 * keeping only the last 200 entries.
 *
 * @param {Object}      gameState
 * @param {GameEvent[]} events
 */
const _appendLog = (gameState, events) => {
  events.forEach((e) => {
    if (e.message) {
      gameState.log.push({ ts: e.ts, type: e.type, message: e.message });
    }
  });
  if (gameState.log.length > 200) {
    gameState.log.splice(0, gameState.log.length - 200);
  }
};

/**
 * _liquidateAssetsForDebt — Sell houses/hotels and mortgage properties to cover debt.
 */
const _liquidateAssetsForDebt = (gameState, playerId, debtAmount) => {
  const player = gameState.players[playerId];
  if (!player) return [];

  const events = [];

  // 1. Sell hotels/houses first (highest building count first to keep even-sell)
  while (player.money < debtAmount) {
    let bestProp = null;
    let maxBuildings = 0;

    Object.values(gameState.properties).forEach((prop) => {
      if (prop.ownerId !== playerId) return;
      const tile = TILE_BY_ID[prop.tileId];
      if (!tile || tile.type !== TILE_TYPES.PROPERTY) return;

      const count = prop.hotel ? 5 : prop.houses;
      if (count > 0 && count > maxBuildings) {
        maxBuildings = count;
        bestProp = prop;
      }
    });

    if (!bestProp) break;

    if (bestProp.hotel) {
      const result = sellHotel(gameState, playerId, bestProp.tileId);
      if (result.ok) {
        events.push(...result.events);
      } else {
        const tile = TILE_BY_ID[bestProp.tileId];
        const refund = Math.floor(tile.houseCost / 2);
        const housesReturned = Math.min(HOUSES_PER_HOTEL, gameState.houseBank);
        gameState.hotelBank += 1;
        gameState.houseBank -= housesReturned;
        bestProp.hotel = false;
        bestProp.houses = housesReturned;
        player.money += refund;
        events.push(evt(
          EVENT_TYPES.HOTEL_SOLD,
          { playerId, tileId: bestProp.tileId, houses: bestProp.houses, refund, newBalance: player.money },
          `${player.username} sold the hotel on ${tile.name} for ₹${fmt(refund)}`
        ));
      }
    } else {
      const result = sellHouse(gameState, playerId, bestProp.tileId);
      if (result.ok) {
        events.push(...result.events);
      } else {
        const tile = TILE_BY_ID[bestProp.tileId];
        const refund = Math.floor(tile.houseCost / 2);
        bestProp.houses -= 1;
        gameState.houseBank += 1;
        player.money += refund;
        events.push(evt(
          EVENT_TYPES.HOUSE_SOLD,
          { playerId, tileId: bestProp.tileId, houses: bestProp.houses, refund, newBalance: player.money },
          `${player.username} sold a house on ${tile.name} for ₹${fmt(refund)}`
        ));
      }
    }
  }

  // 2. Mortgage properties if still short
  if (player.money < debtAmount) {
    const eligibleProperties = Object.values(gameState.properties)
      .filter((prop) => prop.ownerId === playerId && !prop.mortgaged);

    for (const prop of eligibleProperties) {
      if (player.money >= debtAmount) break;
      const tile = TILE_BY_ID[prop.tileId];
      if (!tile) continue;

      const result = mortgageProperty(gameState, playerId, prop.tileId);
      if (result.ok) {
        events.push(...result.events);
      } else {
        prop.mortgaged = true;
        player.money += tile.mortgage;
        events.push(evt(
          EVENT_TYPES.PROPERTY_MORTGAGED,
          { playerId, tileId: prop.tileId, amount: tile.mortgage, newBalance: player.money },
          `${player.username} mortgaged ${tile.name} for ₹${fmt(tile.mortgage)}`
        ));
      }
    }
  }

  return events;
};

/**
 * takeLoan — Approve emergency bank loan for a player.
 */
const takeLoan = (gameState, playerId, amount) => {
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');
  if (player.loanActive) return fail('You already have an active loan');
  if (amount < 500 || amount > 5000 || amount % 500 !== 0) {
    return fail('Loan amount must be between ₹500 and ₹5,000 in increments of ₹500');
  }

  player.loanActive = true;
  player.loanAmount = amount;
  player.loanRepaymentAmount = Math.floor(amount * 1.2);
  player.loanTurnsRemaining = 5;
  player.money += amount;
  player.loansTakenCount = (player.loansTakenCount ?? 0) + 1;

  const events = [evt(
    EVENT_TYPES.LOAN_APPROVED,
    { playerId, amount, repaymentAmount: player.loanRepaymentAmount, turnsRemaining: 5, newBalance: player.money },
    `🏦 ${player.username} took ₹${fmt(amount)} emergency loan`
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * repayLoan — Repay active loan manually.
 */
const repayLoan = (gameState, playerId) => {
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');
  if (!player.loanActive) return fail('No active loan to repay');

  const cost = player.loanRepaymentAmount;
  if (player.money < cost) {
    return fail(`Need ₹${fmt(cost)} to repay loan (you have ₹${fmt(player.money)})`);
  }

  player.money -= cost;
  player.loanActive = false;
  player.loanAmount = 0;
  player.loanRepaymentAmount = 0;
  player.loanTurnsRemaining = 0;

  const events = [evt(
    EVENT_TYPES.LOAN_REPAID,
    { playerId, repaymentAmount: cost, newBalance: player.money },
    `💰 ${player.username} repaid ₹${fmt(cost)} bank loan`
  )];

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * declareBankruptcy — Let a player voluntarily declare bankruptcy.
 */
const declareBankruptcy = (gameState, playerId) => {
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');

  const creditorId = player.money >= 0 ? null : (player.creditorId || null);
  const events = _processBankruptcy(gameState, playerId, creditorId);

  // If it was their turn, advance the turn, unless an auction is now pending
  const currentCP = currentPlayer(gameState);
  if (currentCP && currentCP.id === playerId) {
    if (gameState.pendingAction !== 'auction') {
      const advanceEvents = _advanceTurn(gameState);
      events.push(...advanceEvents);
    }
  }

  _appendLog(gameState, events);
  return ok(events);
};

/**
 * requestEndGame — A player initiates a vote to end the game.
 */
const requestEndGame = (gameState, playerId) => {
  if (gameState.status !== 'playing') return fail('Game is not active');
  if (gameState.endGameVote) return fail('An end game vote is already in progress');
  
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');

  // Initialize the vote
  gameState.endGameVote = {
    initiatorId: playerId,
    votes: {
      [playerId]: true, // Initiator automatically accepts
    },
  };

  const events = [evt(
    EVENT_TYPES.END_GAME_REQUESTED,
    { playerId, username: player.username },
    `🗳️ ${player.username} requested to end the game`
  )];

  _appendLog(gameState, events);
  
  _checkEndGameVoteResolution(gameState, events);

  return ok(events);
};

/**
 * voteEndGame — A player votes 'accept' or 'reject' to end the game.
 */
const voteEndGame = (gameState, playerId, accept) => {
  if (gameState.status !== 'playing') return fail('Game is not active');
  if (!gameState.endGameVote) return fail('No end game vote is in progress');
  
  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Only active players can vote');

  gameState.endGameVote.votes[playerId] = Boolean(accept);

  const events = [evt(
    accept ? EVENT_TYPES.END_GAME_ACCEPTED : EVENT_TYPES.END_GAME_REJECTED,
    { playerId, username: player.username, accept },
    accept ? `🤝 ${player.username} accepted end game` : `❌ ${player.username} rejected end game`
  )];

  _appendLog(gameState, events);
  
  _checkEndGameVoteResolution(gameState, events);

  return ok(events);
};

/**
 * _checkEndGameVoteResolution — Check if the endGameVote is approved or rejected based on majority.
 */
const _checkEndGameVoteResolution = (gameState, events) => {
  if (!gameState.endGameVote) return;

  const activePlayers = Object.values(gameState.players).filter((p) => !p.isBankrupt);
  const totalActive = activePlayers.length;
  
  // Majority of active players required
  const majorityNeeded = Math.floor(totalActive / 2) + 1;

  let acceptsCount = 0;
  let rejectsCount = 0;

  activePlayers.forEach((p) => {
    const vote = gameState.endGameVote.votes[p.id];
    if (vote === true) {
      acceptsCount++;
    } else if (vote === false) {
      rejectsCount++;
    }
  });

  if (acceptsCount >= majorityNeeded) {
    // Approved!
    gameState.status = 'finished';
    
    // Calculate net worth and ranking
    const ranking = getPlayerRankingData(gameState);
    ranking.sort((a, b) => b.netWorth - a.netWorth);
    gameState.ranking = ranking;
    gameState.winnerId = ranking[0].playerId;
    
    const winnerUsername = ranking[0].username;

    events.push(evt(
      EVENT_TYPES.END_GAME_APPROVED,
      { winnerId: gameState.winnerId, username: winnerUsername },
      `🎉 End game approved! winner: ${winnerUsername} based on Net Worth ₹${ranking[0].netWorth.toLocaleString('en-IN')}`
    ));

    gameState.endGameVote = null; // Clear vote state
  }
};

/**
 * requestKickHost — Initiate a vote to kick the host player.
 */
const requestKickHost = (gameState, playerId, hostId) => {
  if (gameState.status !== 'playing') return fail('Game is not active');
  if (gameState.kickHostVote) return fail('A kick host vote is already in progress');

  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Invalid player');

  const hostPlayer = gameState.players[hostId];
  if (!hostPlayer || hostPlayer.isBankrupt) return fail('Host is not active or invalid');

  if (playerId === hostId) return fail('You cannot initiate a vote to kick yourself');

  // Initialize the vote
  gameState.kickHostVote = {
    initiatorId: playerId,
    targetId: hostId,
    votes: {
      [playerId]: true, // Initiator automatically votes YES
    },
  };

  const events = [evt(
    EVENT_TYPES.KICK_HOST_REQUESTED,
    { playerId, targetId: hostId, username: player.username, targetUsername: hostPlayer.username },
    `🗳️ ${player.username} initiated a vote to kick host ${hostPlayer.username}`
  )];

  _appendLog(gameState, events);

  _checkKickHostVoteResolution(gameState, events);

  return ok(events);
};

/**
 * voteKickHost — Cast a vote to kick the host.
 */
const voteKickHost = (gameState, playerId, accept) => {
  if (gameState.status !== 'playing') return fail('Game is not active');
  if (!gameState.kickHostVote) return fail('No kick host vote is in progress');

  const player = gameState.players[playerId];
  if (!player || player.isBankrupt) return fail('Only active players can vote');

  if (playerId === gameState.kickHostVote.targetId) {
    return fail('The host cannot vote in their own kick vote');
  }

  gameState.kickHostVote.votes[playerId] = Boolean(accept);

  const events = [evt(
    accept ? EVENT_TYPES.KICK_HOST_ACCEPTED : EVENT_TYPES.KICK_HOST_REJECTED,
    { playerId, username: player.username, accept },
    accept ? `👍 ${player.username} voted YES to kick host` : `❌ ${player.username} voted NO to kick host`
  )];

  _appendLog(gameState, events);

  _checkKickHostVoteResolution(gameState, events);

  return ok(events);
};

/**
 * _checkKickHostVoteResolution — Internal helper to check vote results.
 */
const _checkKickHostVoteResolution = (gameState, events) => {
  if (!gameState.kickHostVote) return;

  const hostId = gameState.kickHostVote.targetId;

  // Active players excluding the host
  const activeNonHostPlayers = Object.values(gameState.players).filter(
    (p) => !p.isBankrupt && p.id !== hostId
  );
  const totalVoting = activeNonHostPlayers.length;

  if (totalVoting === 0) {
    // No other players to vote, auto approve
    gameState.hostKickedPending = true;
    const hostPlayer = gameState.players[hostId];
    
    // Process bankruptcy for host
    const bkResult = declareBankruptcy(gameState, hostId);
    if (bkResult.ok) {
      events.push(...bkResult.events);
    }

    events.push(evt(
      EVENT_TYPES.KICK_HOST_APPROVED,
      { targetId: hostId, username: hostPlayer ? hostPlayer.username : 'Host' },
      `🎉 Host kicked by unanimous vote!`
    ));
    gameState.kickHostVote = null;
    return;
  }

  // Majority of active non-host players required
  const majorityNeeded = Math.floor(totalVoting / 2) + 1;

  let acceptsCount = 0;
  let rejectsCount = 0;

  activeNonHostPlayers.forEach((p) => {
    const vote = gameState.kickHostVote.votes[p.id];
    if (vote === true) {
      acceptsCount++;
    } else if (vote === false) {
      rejectsCount++;
    }
  });

  if (acceptsCount >= majorityNeeded) {
    // Approved!
    gameState.hostKickedPending = true;
    const hostPlayer = gameState.players[hostId];
    
    // Process bankruptcy for host
    const bkResult = declareBankruptcy(gameState, hostId);
    if (bkResult.ok) {
      events.push(...bkResult.events);
    }

    events.push(evt(
      EVENT_TYPES.KICK_HOST_APPROVED,
      { targetId: hostId, username: hostPlayer ? hostPlayer.username : 'Host' },
      `🎉 Host kicked by majority vote!`
    ));

    gameState.kickHostVote = null; // Clear vote state
  } else if (rejectsCount >= (totalVoting - majorityNeeded + 1)) {
    // Rejected! (impossible to reach majority of accepts)
    events.push(evt(
      EVENT_TYPES.KICK_HOST_VOTE_REJECTED,
      {},
      `❌ Vote to kick host rejected`
    ));
    gameState.kickHostVote = null; // Clear vote state
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── EXPORTS ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  EVENT_TYPES,
  STARTING_BALANCE,
  GO_REWARD,
  JAIL_FINE,
  TURN_TIMEOUT_SECONDS,
  PLAYER_TOKENS,
  PLAYER_COLORS,

  // Game lifecycle
  initializeGame,
  getClientState,
  getPlayerState,
  currentPlayer,

  // Dice + movement
  rollDice,

  // Property system
  buyProperty,
  mortgageProperty,
  unmortgageProperty,
  buildHouse,
  buildHotel,
  sellHouse,
  sellHotel,

  // Jail system
  payJailFine,
  useJailCard,

  // Turn system
  endTurn,
  skipAfkTurn,
  takeLoan,
  repayLoan,
  declareBankruptcy,
  requestEndGame,
  voteEndGame,
  requestKickHost,
  voteKickHost,

  // Trading
  initiateTrade,
  counterTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,

  // Auction
  placeBid,
  passAuction,
  auctionProperty,
  getPlayerRankingData,

  // Utilities (exported for testing)
  fmt,
  randomDie,
  shuffleArray,
};
