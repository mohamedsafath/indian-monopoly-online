/**
 * backend/testCounterTrade.js
 * Unit test to verify the counterTrade feature.
 */

const engine = require("./game-engine/gameEngine");
const { BOARD_TILES } = require("./game-engine/boardData");

const players = [
  { id: "p1", username: "Ravi", socketId: "s1" },
  { id: "p2", username: "Priya", socketId: "s2" },
  { id: "p3", username: "Vikram", socketId: "s3" }
];

const initResult = engine.initializeGame("counter-trade-room", players);
if (!initResult.ok) {
  console.error("❌ Initialization failed:", initResult.error);
  process.exit(1);
}
const state = initResult.gameState;

// Give Ravi Delhi
const delhi = BOARD_TILES.find(t => t.name.toLowerCase().includes("delhi"));
state.properties[delhi.id].ownerId = "p1";

// Give Priya Mumbai
const mumbai = BOARD_TILES.find(t => t.name.toLowerCase().includes("mumbai"));
state.properties[mumbai.id].ownerId = "p2";

// 1. Propose Trade: Ravi proposes to Priya
// Ravi offers Delhi + 1000 cash, requests Mumbai + 500 cash
console.log("--- 1. INITIATING TRADE ---");
const initTradeRes = engine.initiateTrade(state, "p1", "p2", {
  propertyIds: [delhi.id],
  money: 1000
}, {
  propertyIds: [mumbai.id],
  money: 500
});

if (!initTradeRes.ok) {
  console.error("❌ Initiating trade failed:", initTradeRes.error);
  process.exit(1);
}
console.log("✅ Trade initiated successfully!");
console.log("Active Trade fromPlayerId:", state.activeTrade.fromPlayerId);
console.log("Active Trade toPlayerId:", state.activeTrade.toPlayerId);
console.log("Active Trade offer:", state.activeTrade.offer);
console.log("Active Trade request:", state.activeTrade.request);

// 2. Try countering with invalid player
console.log("\n--- 2. TRY COUNTERING WITH INVALID PLAYER ---");
const badCounter = engine.counterTrade(state, "p3", {
  propertyIds: [mumbai.id],
  money: 200
}, {
  propertyIds: [delhi.id],
  money: 800
});
if (badCounter.ok) {
  console.error("❌ Error: counter succeeded with invalid player!");
  process.exit(1);
} else {
  console.log("✅ Expected failure succeeded:", badCounter.error);
}

// 3. Counter Trade: Priya counters Ravi
// Priya offers Mumbai + 200 cash, requests Delhi + 2000 cash (more than Ravi has?)
// Ravi started with 20000 cash, so he has enough.
console.log("\n--- 3. COUNTERING TRADE VALIDATION ---");
const counterRes = engine.counterTrade(state, "p2", {
  propertyIds: [mumbai.id],
  money: 200
}, {
  propertyIds: [delhi.id],
  money: 2000
});

if (!counterRes.ok) {
  console.error("❌ Counter trade failed:", counterRes.error);
  process.exit(1);
}
console.log("✅ Trade countered successfully!");
console.log("Active Trade new fromPlayerId (Priya/p2):", state.activeTrade.fromPlayerId);
console.log("Active Trade new toPlayerId (Ravi/p1):", state.activeTrade.toPlayerId);
console.log("Active Trade new offer:", state.activeTrade.offer);
console.log("Active Trade new request:", state.activeTrade.request);

// 4. Accept Countered Trade: Ravi accepts Priya's counter-offer
console.log("\n--- 4. ACCEPTING COUNTERED TRADE ---");
const raviOriginalMoney = state.players["p1"].money;
const priyaOriginalMoney = state.players["p2"].money;

const acceptRes = engine.acceptTrade(state, "p1");
if (!acceptRes.ok) {
  console.error("❌ Accepting countered trade failed:", acceptRes.error);
  process.exit(1);
}
console.log("✅ Countered trade accepted successfully!");
console.log("Ravi money:", raviOriginalMoney, "->", state.players["p1"].money, "(expected delta: +200 - 2000 = -1800)");
console.log("Priya money:", priyaOriginalMoney, "->", state.players["p2"].money, "(expected delta: -200 + 2000 = +1800)");
console.log("Delhi owner:", state.properties[delhi.id].ownerId, "(expected: p2)");
console.log("Mumbai owner:", state.properties[mumbai.id].ownerId, "(expected: p1)");

if (state.players["p1"].money !== raviOriginalMoney - 1800) {
  console.error("❌ Ravi money is incorrect!");
  process.exit(1);
}
if (state.players["p2"].money !== priyaOriginalMoney + 1800) {
  console.error("❌ Priya money is incorrect!");
  process.exit(1);
}
if (state.properties[delhi.id].ownerId !== "p2") {
  console.error("❌ Delhi owner is incorrect!");
  process.exit(1);
}
if (state.properties[mumbai.id].ownerId !== "p1") {
  console.error("❌ Mumbai owner is incorrect!");
  process.exit(1);
}

console.log("\n==================================================");
console.log("🎉 ALL COUNTER-TRADE ENGINE TESTS PASSED!");
console.log("==================================================");
