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
let activePlayer = engine.currentPlayer(gameState);
console.log("Current player:", activePlayer.username);

// ---------------- TEST 1 ----------------
console.log("\n=== TEST 1: Dice Roll ===");

const roll = engine.rollDice(gameState, activePlayer.id);

console.log("Roll result:", roll.ok);
console.log("Player position:", gameState.players[activePlayer.id].position);
console.log("Player money:", gameState.players[activePlayer.id].money);

// ---------------- TEST 2 ----------------
console.log("\n=== TEST 2: Buy Property ===");

// We can buy if the position landed on is purchasable
const buy = engine.buyProperty(gameState, activePlayer.id);

if (buy.ok) {
  console.log("Property bought successfully");
} else {
  console.log("Buy failed (expected if landed on non-purchasable tile):", buy.error);
}

console.log("Money after purchase attempt:", gameState.players[activePlayer.id].money);

// ---------------- TEST 3 ----------------
console.log("\n=== TEST 3: End Turn ===");

const endTurn = engine.endTurn(gameState, activePlayer.id);

console.log("End turn:", endTurn.ok);
activePlayer = engine.currentPlayer(gameState);
console.log("Current player now:", activePlayer.username);

// ---------------- TEST 4 ----------------
console.log("\n=== TEST 4: Next Player Dice Roll ===");

const roll2 = engine.rollDice(gameState, activePlayer.id);

console.log("Next Player roll:", roll2.ok);
console.log("Next Player position:", gameState.players[activePlayer.id].position);

console.log("\n=== TEST COMPLETE ===");