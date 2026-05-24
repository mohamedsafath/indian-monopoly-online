const engine = require("./game-engine/gameEngine");

// Create players
const players = [
  { id: "p1", username: "Ravi", socketId: "s1" },
  { id: "p2", username: "Priya", socketId: "s2" }
];

// Initialize game
const result = engine.initializeGame("room1", players);
const gameState = result.gameState;

console.log("=== GAME START ===");
console.log("Current player:", engine.currentPlayer(gameState).username);

// ---------------- TEST 1 ----------------
console.log("\n=== TEST 1: Dice Roll ===");

const roll = engine.rollDice(gameState, "p1");

console.log("Roll result:", roll.ok);
console.log("Player position:", gameState.players["p1"].position);
console.log("Player money:", gameState.players["p1"].money);

// ---------------- TEST 2 ----------------
console.log("\n=== TEST 2: Buy Property ===");

const buy = engine.buyProperty(gameState, "p1");

if (buy.ok) {
  console.log("Property bought successfully");
} else {
  console.log("Buy failed:", buy.error);
}

console.log("Money after purchase:", gameState.players["p1"].money);

// ---------------- TEST 3 ----------------
console.log("\n=== TEST 3: End Turn ===");

const endTurn = engine.endTurn(gameState, "p1");

console.log("End turn:", endTurn.ok);
console.log("Current player now:",
  engine.currentPlayer(gameState).username
);

// ---------------- TEST 4 ----------------
console.log("\n=== TEST 4: Player 2 Dice Roll ===");

const roll2 = engine.rollDice(gameState, "p2");

console.log("Player 2 roll:", roll2.ok);
console.log("Player 2 position:",
  gameState.players["p2"].position
);

console.log("\n=== TEST COMPLETE ===");