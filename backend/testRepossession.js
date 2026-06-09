const engine = require("./game-engine/gameEngine");
const { TILE_BY_ID } = require("./game-engine/boardData");

// Create 3 players
const players = [
  { id: "p1", username: "Ravi", socketId: "s1" },
  { id: "p2", username: "Priya", socketId: "s2" },
  { id: "p3", username: "Vijay", socketId: "s3" }
];

// Initialize game
const result = engine.initializeGame("room1", players);
if (!result.ok) {
  console.error("Failed to initialize game:", result.error);
  process.exit(1);
}
const gameState = result.gameState;

console.log("=== SETUP FOR BANK REPOSSESSION TEST ===");
// Force fixed turn order and starting player to ensure deterministic turn advancement
gameState.turnOrder = ["p1", "p2", "p3"];
gameState.currentTurnIdx = 0;
const activePlayer = engine.currentPlayer(gameState);
console.log("Current player:", activePlayer.username);

// Assign property 1 (Kollumedu) and property 3 (Chennai Central) to p1
gameState.properties[1].ownerId = "p1";
gameState.properties[1].mortgaged = true;

gameState.properties[3].ownerId = "p1";
gameState.properties[3].mortgaged = true;

// Put p1 in debt shortfall to p2
gameState.players["p1"].money = -500;
gameState.players["p1"].creditorId = "p2";

console.log("Player 1 properties (1 and 3) assigned and mortgaged.");
console.log("Player 1 balance:", gameState.players["p1"].money);
console.log("Player 1 creditor:", gameState.players["p1"].creditorId);

// ---------------- TEST STEP 1 ----------------
console.log("\n=== STEP 1: Declare Bankruptcy ===");
const bankruptResult = engine.declareBankruptcy(gameState, "p1");

if (!bankruptResult.ok) {
  console.error("Bankruptcy declaration failed:", bankruptResult.error);
  process.exit(1);
}

console.log("Bankruptcy processed successfully.");
console.log("Is p1 bankrupt?", gameState.players["p1"].isBankrupt);
console.log("Property 1 owner:", gameState.properties[1].ownerId, "Mortgaged:", gameState.properties[1].mortgaged);
console.log("Property 3 owner:", gameState.properties[3].ownerId, "Mortgaged:", gameState.properties[3].mortgaged);
console.log("Active Auction:", gameState.activeAuction ? `Tile ${gameState.activeAuction.tileId}` : "None");
console.log("Queued Auctions:", gameState.queuedAuctions);
console.log("Pending Action:", gameState.pendingAction);
console.log("Current turn player now:", engine.currentPlayer(gameState).username);

// Assertions
if (gameState.players["p1"].isBankrupt !== true) {
  console.error("FAIL: Player 1 should be bankrupt");
  process.exit(1);
}
if (gameState.properties[1].ownerId !== null || gameState.properties[1].mortgaged !== false) {
  console.error("FAIL: Property 1 should be repossessed by bank and unmortgaged");
  process.exit(1);
}
if (gameState.properties[3].ownerId !== null || gameState.properties[3].mortgaged !== false) {
  console.error("FAIL: Property 3 should be repossessed by bank and unmortgaged");
  process.exit(1);
}
if (gameState.activeAuction !== null || gameState.pendingAction !== null) {
  console.error("FAIL: No auctions should be active or pending");
  process.exit(1);
}
if (engine.currentPlayer(gameState).id !== "p2") {
  console.error("FAIL: Turn should have advanced to player 2 (Priya)");
  process.exit(1);
}

console.log("\n✅ ALL BANK REPOSSESSION MECHANIC TESTS PASSED SUCCESSFULLY! ✅");
process.exit(0);
