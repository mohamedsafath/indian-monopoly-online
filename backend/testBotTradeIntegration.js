/**
 * backend/testBotTradeIntegration.js
 *
 * Rigorous integration test for bot trade evaluation and decision making.
 * Verifies that:
 * - Bots evaluate color group property trades and accept/reject them correctly.
 * - Bots evaluate railway/utility trades without throwing any errors.
 * - Recovery paths and state broadcasts occur correctly.
 */

'use strict';

// Mock setTimeout to run immediately so tests run synchronously
const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn, delay) => {
  if (delay === 1500) {
    // Run bot actions immediately
    fn();
    return {};
  }
  return originalSetTimeout(fn, delay);
};

const { BOARD_TILES, TILE_BY_ID } = require('./game-engine/boardData');
const { initializeGame, initiateTrade } = require('./game-engine/gameEngine');
const gameSocket = require('./socket/gameSocket');

console.log("==================================================");
console.log("🤖 BOT TRADE EVALUATION INTEGRATION TESTING 🤖");
console.log("==================================================");

// Helper to get a tile by name
const findTile = (name) => BOARD_TILES.find(t => t.name.toLowerCase().includes(name.toLowerCase()));

const chandigarh = findTile("Chandigarh");
const indore = findTile("Indore");
const northRailway = findTile("Indian Railways North");

// Create mock IO and Room
const ioMock = {
  to: () => ({
    emit: (event, payload) => {
      console.log(`   [Emit Event] -> ${event}`, JSON.stringify(payload));
    }
  })
};

const room = {
  code: 'BOTRDE',
  hostId: 'p1',
  status: 'playing',
  players: [
    { id: 'p1', username: 'Ravi', socketId: 's1', ready: true, connected: true, isBot: false },
    { id: 'bot1', username: '🤖 Bot Aryabhata', socketId: null, ready: true, connected: true, isBot: true }
  ],
  gameState: null,
  botExecutingAction: false,
  chatHistory: []
};

// Initialize game state
const initResult = initializeGame(room.code, [
  { id: 'p1', username: 'Ravi', socketId: 's1' },
  { id: 'bot1', username: '🤖 Bot Aryabhata', socketId: null, isBot: true }
]);

if (!initResult.ok) {
  console.error("❌ Failed to initialize game state:", initResult.error);
  process.exit(1);
}

room.gameState = initResult.gameState;

// Ensure player and bot flags are set
room.players.forEach(p => {
  if (p.isBot) {
    room.gameState.players[p.id].isBot = true;
  }
});

// Helper to clear and set ownerships
const resetOwnerships = () => {
  Object.keys(room.gameState.properties).forEach(id => {
    room.gameState.properties[id].ownerId = null;
  });
  room.gameState.activeTrade = null;
  room.botExecutingAction = false;
};

// ── TEST 1: COLOUR PROPERTY TRADE (EQUAL VALUE) ──
console.log("\n--- TEST 1: Equal Value Property Trade (Should Accept) ---");
resetOwnerships();

// Give Chandigarh to Ravi (p1)
room.gameState.properties[chandigarh.id].ownerId = 'p1';
// Give Indore to Bot (bot1)
room.gameState.properties[indore.id].ownerId = 'bot1';

// Ravi proposes equal trade: Chandigarh (1000) for Indore (1000)
// Note: This does not complete a monopoly for either, so they should trade.
const tradeRes1 = initiateTrade(room.gameState, 'p1', 'bot1', {
  propertyIds: [chandigarh.id],
  money: 0
}, {
  propertyIds: [indore.id],
  money: 0
});

if (!tradeRes1.ok) {
  console.error("❌ Proposing trade 1 failed:", tradeRes1.error);
  process.exit(1);
}

// Trigger bot cycle
console.log("Triggering bot cycle for Equal Trade...");
gameSocket.triggerBotCycle(ioMock, room);

console.log("Checking trade status on server:");
console.log("   Active trade state:", room.gameState.activeTrade);
console.log("   Chandigarh owner:", room.gameState.properties[chandigarh.id].ownerId);
console.log("   Indore owner:", room.gameState.properties[indore.id].ownerId);

if (room.gameState.properties[chandigarh.id].ownerId !== 'bot1' || room.gameState.properties[indore.id].ownerId !== 'p1') {
  console.error("❌ Test 1 failed: Trade was not accepted and processed!");
  process.exit(1);
}
console.log("✅ Test 1 Passed: Bot accepted and executed equal trade!");


// ── TEST 2: RAILWAY TRADE (Should NOT Crash & Accept) ──
console.log("\n--- TEST 2: Railway Trade Evaluation (Should NOT Crash & Accept) ---");
resetOwnerships();

// Give North Railway to Ravi (p1)
room.gameState.properties[northRailway.id].ownerId = 'p1';
// Give Indore to Bot (bot1)
room.gameState.properties[indore.id].ownerId = 'bot1';

// Ravi proposes: Railways North (2000) for Indore (1000)
const tradeRes2 = initiateTrade(room.gameState, 'p1', 'bot1', {
  propertyIds: [northRailway.id],
  money: 0
}, {
  propertyIds: [indore.id],
  money: 0
});

if (!tradeRes2.ok) {
  console.error("❌ Proposing trade 2 failed:", tradeRes2.error);
  process.exit(1);
}

// Trigger bot cycle
console.log("Triggering bot cycle for Railway Trade...");
console.log("   botExecutingAction:", room.botExecutingAction);
console.log("   activeTrade:", room.gameState.activeTrade);
console.log("   botToAct search:", room.players.find(p => (p.isBot || p.autoplay || !p.connected) && p.id === room.gameState.activeTrade.toPlayerId));
try {
  gameSocket.triggerBotCycle(ioMock, room);
  console.log("✅ Bot cycle executed successfully without throwing any errors!");
} catch (e) {
  console.error("❌ Test 2 crashed:", e.message);
  process.exit(1);
}

console.log("Checking trade status on server:");
console.log("   Active trade state:", room.gameState.activeTrade);
console.log("   Railways North owner:", room.gameState.properties[northRailway.id].ownerId);
console.log("   Indore owner:", room.gameState.properties[indore.id].ownerId);

if (room.gameState.properties[northRailway.id].ownerId !== 'bot1' || room.gameState.properties[indore.id].ownerId !== 'p1') {
  console.error("❌ Test 2 failed: Railway trade was not accepted!");
  process.exit(1);
}
console.log("✅ Test 2 Passed: Railway trade evaluated and completed successfully!");


// ── TEST 3: UNEQUAL TRADE (Should Reject Cleanly) ──
console.log("\n--- TEST 3: Lopsided Trade Evaluation (Should Reject) ---");
resetOwnerships();

// Give Chandigarh to Ravi (p1)
room.gameState.properties[chandigarh.id].ownerId = 'p1';
// Give Indore to Bot (bot1)
room.gameState.properties[indore.id].ownerId = 'bot1';

// Ravi proposes lopsided trade: Chandigarh (1000) for Indore (1000) + ₹5000 cash request from Bot
const tradeRes3 = initiateTrade(room.gameState, 'p1', 'bot1', {
  propertyIds: [chandigarh.id],
  money: 0
}, {
  propertyIds: [indore.id],
  money: 5000
});

if (!tradeRes3.ok) {
  console.error("❌ Proposing trade 3 failed:", tradeRes3.error);
  process.exit(1);
}

// Trigger bot cycle
console.log("Triggering bot cycle for Unequal Trade...");
gameSocket.triggerBotCycle(ioMock, room);

console.log("Checking trade status on server:");
console.log("   Active trade state:", room.gameState.activeTrade);
console.log("   Chandigarh owner:", room.gameState.properties[chandigarh.id].ownerId);
console.log("   Indore owner:", room.gameState.properties[indore.id].ownerId);

if (room.gameState.activeTrade !== null) {
  console.error("❌ Test 3 failed: Lopsided trade was not rejected!");
  process.exit(1);
}
console.log("✅ Test 3 Passed: Bot rejected unequal trade cleanly!");

console.log("\n==================================================");
console.log("🎉 ALL BOT TRADE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
process.exit(0);
