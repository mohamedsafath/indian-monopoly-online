/**
 * backend/testAchievements.js
 *
 * Validates player statistics updates, including the hotelsBuilt field,
 * level recalculation, and fallback persistence.
 */

require('dotenv').config();
const { connectDB, getIsDbActive } = require('./socket/roomModel');
const { registerUser, findUserByEmail, updateUserStats } = require('./socket/userModel');
const fs = require('fs');
const path = require('path');

const runTest = async () => {
  console.log("=== STARTING ACHIEVEMENTS STATS VERIFICATION ===");

  // 1. Connect DB (or fallback gracefully)
  console.log("\n1. Connecting to DB or preparing fallback database...");
  await connectDB();
  const isDb = getIsDbActive();
  console.log(`Database active: ${isDb ? 'MongoDB' : 'Memory Fallback File'}`);

  // 2. Test registration default values
  console.log("\n2. Registering a test player...");
  const testEmail = `achiever_${Date.now()}@gmail.com`;
  const username = "Badge Collector";
  
  const user = await registerUser(username, testEmail);
  console.log("Registered user:", user);

  if (user.hotelsBuilt !== 0 || user.loansTaken !== 0 || user.level !== 1) {
    console.error("FAIL: Registration default stats mismatch.");
    process.exit(1);
  }
  console.log("✅ Registration defaults verified!");

  // 3. Update player stats
  console.log("\n3. Simulating game completion statistics update...");
  // Simulate building 6 hotels and taking 11 loans to unlock Banker and Industrialist
  const updated = await updateUserStats(
    user.playerId,
    5, // wins (should make level = floor(5 * 0.3) + 1 = 2)
    8, // games
    3, // losses
    11, // loansTaken
    25, // propertiesPurchased
    450000, // totalNetWorthEarned
    2, // propertiesMortgaged
    0, // propertiesRepossessed
    8, // auctionsWon
    15000, // rentPaid
    35000, // rentEarned
    1, // bankruptcies
    6 // hotelsBuilt (new field)
  );

  console.log("Updated user stats:", updated);

  if (!updated) {
    console.error("FAIL: Stats update returned null.");
    process.exit(1);
  }

  if (updated.hotelsBuilt !== 6) {
    console.error(`FAIL: hotelsBuilt stat desync: ${updated.hotelsBuilt} !== 6`);
    process.exit(1);
  }

  if (updated.loansTaken !== 11) {
    console.error(`FAIL: loansTaken stat desync: ${updated.loansTaken} !== 11`);
    process.exit(1);
  }

  if (updated.level !== 2) {
    console.error(`FAIL: level recalculation desync: ${updated.level} !== 2`);
    process.exit(1);
  }

  console.log("✅ Statistics update and level calculation verified!");

  // 4. Verify memory fallback serialization if running in fallback mode
  if (!isDb) {
    console.log("\n4. Checking memory fallback file persistence for achievements...");
    const fallbackPath = path.join(__dirname, 'users_fallback.json');
    if (!fs.existsSync(fallbackPath)) {
      console.error(`FAIL: fallback file not created at ${fallbackPath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    const records = JSON.parse(raw);
    const inJson = records.find(r => r.playerId === user.playerId);
    if (!inJson) {
      console.error("FAIL: Updated user profile not written to users_fallback.json!");
      process.exit(1);
    }
    if (inJson.hotelsBuilt !== 6 || inJson.loansTaken !== 11) {
      console.error("FAIL: Fallback file stats desync!");
      process.exit(1);
    }
    console.log(`✅ users_fallback.json verified! hotelsBuilt: ${inJson.hotelsBuilt}, loansTaken: ${inJson.loansTaken}.`);
  }

  console.log("\n✅ ALL ACHIEVEMENTS STATS VERIFICATION TESTS PASSED SUCCESSFULLY! ✅");
  process.exit(0);
};

runTest().catch(err => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
