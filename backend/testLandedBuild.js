/**
 * backend/testLandedBuild.js
 * Unit test to verify the landed building restriction and 1-house-per-turn limit.
 */

const engine = require("./game-engine/gameEngine");
const { BOARD_TILES } = require("./game-engine/boardData");

const players = [
  { id: "p1", username: "Ravi", socketId: "s1" },
  { id: "p2", username: "Priya", socketId: "s2" }
];

const initResult = engine.initializeGame("landed-build-room", players);
if (!initResult.ok) {
  console.error("❌ Initialization failed:", initResult.error);
  process.exit(1);
}
const state = initResult.gameState;

// Force deterministic turn order: Ravi first, then Priya
state.turnOrder = ["p1", "p2"];
state.currentTurnIdx = 0;

// Red group: Bengaluru (21), Delhi (23), Mumbai (24)
const bengaluru = BOARD_TILES.find(t => t.name.toLowerCase().includes("bengaluru"));
const delhi = BOARD_TILES.find(t => t.name.toLowerCase().includes("delhi"));
const mumbai = BOARD_TILES.find(t => t.name.toLowerCase().includes("mumbai"));

// Give Ravi Bengaluru, Delhi, and Mumbai to have a monopoly
state.properties[bengaluru.id].ownerId = "p1";
state.properties[delhi.id].ownerId = "p1";
state.properties[mumbai.id].ownerId = "p1";

console.log("Bengaluru position ID:", bengaluru.id);
console.log("Delhi position ID:", delhi.id);
console.log("Mumbai position ID:", mumbai.id);

// 1. Initially, Ravi is at position 0 (Start). Try to build on Delhi.
console.log("\n--- 1. BUILDING ON DELHI WHILE NOT LANDED (Ravi at pos 0) ---");
const buildNotLanded = engine.buildHouse(state, "p1", delhi.id);
if (buildNotLanded.ok) {
  console.error("❌ Error: build succeeded while not landed on the property!");
  process.exit(1);
} else {
  console.log("✅ Expected failure succeeded:", buildNotLanded.error);
}

// 2. Move Ravi to Delhi. Try to build a house on Delhi.
console.log("\n--- 2. BUILDING ON DELHI WHILE LANDED (Ravi at Delhi) ---");
state.players["p1"].position = delhi.id;
const buildLanded = engine.buildHouse(state, "p1", delhi.id);
if (!buildLanded.ok) {
  console.error("❌ Build failed:", buildLanded.error);
  process.exit(1);
}
console.log("✅ Success! First house built on Delhi. Delhi houses count:", state.properties[delhi.id].houses);

// 3. Try to build a second house on Delhi immediately.
console.log("\n--- 3. BUILDING A SECOND HOUSE ON DELHI IMMEDIATELY ---");
const buildSecond = engine.buildHouse(state, "p1", delhi.id);
if (buildSecond.ok) {
  console.error("❌ Error: built multiple houses in a single landing!");
  process.exit(1);
} else {
  console.log("✅ Expected failure succeeded:", buildSecond.error);
}

// 4. Verify even-build rule bypass. Move Ravi to Mumbai and build a house on Mumbai.
// Delhi has 1 house, Mumbai has 0 houses. Even build would usually prevent this if Delhi was 2 and Mumbai 0,
// but let's test building on Delhi again in next turn without building on Mumbai first to verify bypass.
console.log("\n--- 4. END TURN AND START NEW TURN TO BUILD AGAIN ---");
// Force end turn / start new turn sequence
state.hasRolled = true; // pretend rolled
const endRes = engine.endTurn(state, "p1");
if (!endRes.ok) {
  console.error("❌ Failed to end Ravi's turn:", endRes.error);
  process.exit(1);
}

// Priya rolls and ends turn
state.hasRolled = true;
const endResPriya = engine.endTurn(state, "p2");
if (!endResPriya.ok) {
  console.error("❌ Failed to end Priya's turn:", endResPriya.error);
  process.exit(1);
}

// Ravi is back. Landed on Delhi.
console.log("\n--- 5. RAVI BUILDS SECOND HOUSE ON NEW LANDING/TURN ---");
state.players["p1"].position = delhi.id;
const buildSecondLanding = engine.buildHouse(state, "p1", delhi.id);
if (!buildSecondLanding.ok) {
  console.error("❌ Failed to build second house on new landing:", buildSecondLanding.error);
  process.exit(1);
}
console.log("✅ Success! Second house built on Delhi. Delhi houses count:", state.properties[delhi.id].houses);
console.log("Mumbai houses count (even build bypassed):", state.properties[mumbai.id].houses);

console.log("\n==================================================");
console.log("🎉 ALL LANDED BUILDING RULE TESTS PASSED!");
console.log("==================================================");
