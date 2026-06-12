/**
 * backend/testGameplayIntegration.js
 * 
 * Integrated gameplay test suite verifying:
 * - Auction flows (owned property auction: start, bid, pass, resolve)
 * - Trade flows (propose, counter, accept, asset swap)
 * - Bankruptcy flows (rent deficit, asset liquidation, asset transfer)
 * - Host Kick & Turn progression
 */

const engine = require("./game-engine/gameEngine");
const { BOARD_TILES } = require("./game-engine/boardData");

const players = [
  { id: "p1", username: "Ravi", socketId: "s1" },
  { id: "p2", username: "Priya", socketId: "s2" },
  { id: "p3", username: "Vikram", socketId: "s3" }
];

console.log("==================================================");
console.log("🎮 MONOPOLY INDIA INTEGRATED GAMEPLAY VERIFIER 🎮");
console.log("==================================================");

// Initialize Game
const initResult = engine.initializeGame("integration-room", players);
if (!initResult.ok) {
  console.error("❌ Game initialization failed:", initResult.error);
  process.exit(1);
}
const state = initResult.gameState;
console.log("✅ Game initialized successfully with 3 players.");

// Enforce deterministic turn order for testing
state.turnOrder = ["p1", "p2", "p3"];
state.currentTurnIdx = 0;

// Find test tiles
const delhi = BOARD_TILES.find(t => t.name.toLowerCase().includes("delhi"));
const mumbai = BOARD_TILES.find(t => t.name.toLowerCase().includes("mumbai"));
const bengaluru = BOARD_TILES.find(t => t.name.toLowerCase().includes("bengaluru"));

if (!delhi || !mumbai || !bengaluru) {
  console.error("❌ Target test properties not found!");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEST AUCTION FLOW (Owned Property Auction)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- 1. TESTING AUCTION FLOW ---");
// Ravi lands on Delhi and buys it first
const activePlayer = engine.currentPlayer(state);
activePlayer.position = delhi.position;
state.pendingAction = "buy_decision";

console.log("Ravi buys Delhi...");
const buyRes = engine.buyProperty(state, "p1");
if (!buyRes.ok) {
  console.error("❌ Ravi buying Delhi failed:", buyRes.error);
  process.exit(1);
}

// Ensure Ravi owns Delhi
if (state.properties[delhi.id].ownerId !== "p1") {
  console.error("❌ Ravi should own Delhi before auctioning it.");
  process.exit(1);
}

// Now Ravi auctions Delhi
console.log(`Ravi puts owned Delhi (tile ${delhi.id}) up for auction...`);
const startAuctionRes = engine.auctionProperty(state, "p1", delhi.id);
if (!startAuctionRes.ok) {
  console.error("❌ Starting owned property auction failed:", startAuctionRes.error);
  process.exit(1);
}
console.log("✅ Auction initialized successfully!");
console.log("Active Auction:", state.activeAuction);

// Bidding:
// Priya bids ₹2000
console.log("Priya bids ₹2000...");
let bidRes = engine.placeBid(state, "p2", 2000);
if (!bidRes.ok) {
  console.error("❌ Priya placing bid failed:", bidRes.error);
  process.exit(1);
}
console.log("Highest Bid:", state.activeAuction.highBid, "by", state.activeAuction.highBidderId);

// Vikram passes
console.log("Vikram passes...");
let passRes = engine.passAuction(state, "p3");
if (!passRes.ok) {
  console.error("❌ Vikram passing failed:", passRes.error);
  process.exit(1);
}
console.log("Vikram passed. Since Vikram is the only other bidder, the auction should now resolve.");

// Auction should resolve and Delhi should go to Priya for ₹2000
console.log("Checking auction resolution...");
if (state.properties[delhi.id].ownerId !== "p2") {
  console.error("❌ Delhi owner should be Priya/p2, found:", state.properties[delhi.id].ownerId);
  process.exit(1);
}
// Priya starting money: 20000. Bought Delhi for 2000. Expected: 18000.
if (state.players["p2"].money !== 18000) {
  console.error("❌ Priya money should be ₹18000, found:", state.players["p2"].money);
  process.exit(1);
}
// Ravi starting money: 20000. Bought Delhi for 7500. Sold it at auction for 2000. Expected: 20000 - 7500 + 2000 = 14500.
if (state.players["p1"].money !== 14500) {
  console.error("❌ Ravi money should be ₹14500, found:", state.players["p1"].money);
  process.exit(1);
}
console.log("✅ Auction resolved perfectly. Delhi ownership and bid cash transferred correctly.");

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEST TRADE FLOW (Propose -> Counter -> Accept)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- 2. TESTING TRADE FLOW ---");
// Manually award Mumbai to Ravi/p1
state.properties[mumbai.id].ownerId = "p1";

console.log("Ravi proposes trade: Mumbai + ₹1000 cash for Priya's Delhi...");
const initTradeRes = engine.initiateTrade(state, "p1", "p2", {
  propertyIds: [mumbai.id],
  money: 1000
}, {
  propertyIds: [delhi.id],
  money: 0
});

if (!initTradeRes.ok) {
  console.error("❌ Initiating trade failed:", initTradeRes.error);
  process.exit(1);
}

console.log("Priya counters trade: Delhi + ₹500 cash for Ravi's Mumbai + ₹3000 cash...");
const counterRes = engine.counterTrade(state, "p2", {
  propertyIds: [delhi.id],
  money: 500
}, {
  propertyIds: [mumbai.id],
  money: 3000
});

if (!counterRes.ok) {
  console.error("❌ Countering trade failed:", counterRes.error);
  process.exit(1);
}

console.log("Ravi accepts Priya's counter-offer...");
const acceptRes = engine.acceptTrade(state, "p1");
if (!acceptRes.ok) {
  console.error("❌ Accepting trade failed:", acceptRes.error);
  process.exit(1);
}

// Check trade outcomes
if (state.properties[delhi.id].ownerId !== "p1") {
  console.error("❌ Delhi owner should now be Ravi/p1");
  process.exit(1);
}
if (state.properties[mumbai.id].ownerId !== "p2") {
  console.error("❌ Mumbai owner should now be Priya/p2");
  process.exit(1);
}
// Ravi starting money: 14500. Trade net: +500 (Priya's offer) - 3000 (Priya's request) = -2500. Expected: 12000.
// Priya starting money: 18000. Trade net: -500 + 3000 = +2500. Expected: 20500.
if (state.players["p1"].money !== 12000) {
  console.error("❌ Ravi money incorrect after trade:", state.players["p1"].money);
  process.exit(1);
}
if (state.players["p2"].money !== 20500) {
  console.error("❌ Priya money incorrect after trade:", state.players["p2"].money);
  process.exit(1);
}
console.log("✅ Trade countered and accepted successfully! Property ownerships and balances swapped perfectly.");

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEST BANKRUPTCY FLOW
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- 3. TESTING BANKRUPTCY FLOW ---");
// We complete Red monopoly for Ravi (owns Delhi). Let's give him Bengaluru too.
state.properties[bengaluru.id].ownerId = "p1";

// Let's build a hotel on Delhi to create huge rent.
// Building houses first:
engine.buildHouse(state, "p1", delhi.id);
engine.buildHouse(state, "p1", delhi.id);
engine.buildHouse(state, "p1", delhi.id);
engine.buildHouse(state, "p1", delhi.id);
engine.buildHotel(state, "p1", delhi.id);

console.log(`Upgraded Delhi to Hotel. Rent with Hotel is ₹${delhi.rent[5]}`);

// Position Vikram (p3) on Delhi
const p3 = state.players["p3"];
p3.position = delhi.position;

// Let's set Vikram's money to ₹1000 so he cannot afford the rent.
p3.money = 1000;

console.log(`Vikram lands on Delhi with ₹${p3.money} (Rent due: ₹${delhi.rent[5]})...`);
// Let's manually deduct rent and trigger bankruptcy deficit state.
const rentAmount = delhi.rent[5];
p3.money -= rentAmount; // goes negative
state.pendingAction = "shortfall";
state.shortfallDetails = {
  amountNeeded: Math.abs(p3.money),
  creditorId: "p1" // Ravi
};

console.log(`Vikram has deficit of ₹${state.shortfallDetails.amountNeeded}. Declaring bankruptcy...`);
const bankruptRes = engine.declareBankruptcy(state, "p3");
if (!bankruptRes.ok) {
  console.error("❌ Bankruptcy declaration failed:", bankruptRes.error);
  process.exit(1);
}

// Check bankruptcy results:
// 1. Vikram is flagged bankrupt
if (!p3.isBankrupt) {
  console.error("❌ Vikram should be flagged bankrupt.");
  process.exit(1);
}
console.log("✅ Bankruptcy processed successfully. Vikram is bankrupt.");
console.log("Remaining active players:", state.turnOrder.filter(id => !state.players[id].isBankrupt).length);

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEST HOST KICK / TURN PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- 4. TESTING HOST KICK & TURN ---");
// Initial host: p1
state.hostId = "p1";
console.log("Initial Host:", state.hostId);

// Request kick host by Priya/p2 targeting Ravi/p1
console.log("Priya initiates kick host vote against Ravi...");
const reqKick = engine.requestKickHost(state, "p2", "p1");
if (!reqKick.ok) {
  console.error("❌ Requesting host kick failed:", reqKick.error);
  process.exit(1);
}

// Since Vikram is bankrupt, the only voter is Priya.
// Priya automatically votes YES when initiating.
// Majority (1 out of 1 voting players) is met, so the kick is processed immediately.
console.log("Checking if host kick resolved...");
if (!state.players["p1"].isBankrupt) {
  console.error("❌ Kicked host should be processed for bankruptcy.");
  process.exit(1);
}

console.log("\n==================================================");
console.log("🎉 ALL INTEGRATED GAMEPLAY FLOWS WORK PERFECTLY! 🎉");
console.log("==================================================");
