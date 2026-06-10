/**
 * backend/testFeedback.js
 * 
 * Verifies feedback registration, fallback file serialization,
 * and admin validation.
 */

require('dotenv').config();
const { connectDB, getIsDbActive } = require('./socket/roomModel');
const { addFeedback, getAllFeedback, hasSubmittedFeedback } = require('./socket/feedbackModel');
const { isAdmin } = require('./socket/userModel');
const fs = require('fs');
const path = require('path');

const runTest = async () => {
  console.log("=== STARTING ADMIN & FEEDBACK SYSTEM TESTS ===");
  process.env.ADMIN_EMAILS = "msafath2004@gmail.com,mariannesruthi@gmail.com";

  // 1. Verify admin privilege helper
  console.log("\n1. Verifying admin privilege logic...");
  const adminEmails = ["msafath2004@gmail.com", "mariannesruthi@gmail.com", "MSAFATH2004@GMAIL.COM", " mariannesruthi@gmail.com "];
  const nonAdminEmails = ["player@gmail.com", "hacker@gmail.com", "sameer@gmail.com", "", null];

  for (const email of adminEmails) {
    if (!isAdmin(email)) {
      console.error(`FAIL: ${email} should be detected as admin.`);
      process.exit(1);
    }
    console.log(`  - Detected admin: "${email}" -> ok`);
  }

  for (const email of nonAdminEmails) {
    if (isAdmin(email)) {
      console.error(`FAIL: ${email} should NOT be detected as admin.`);
      process.exit(1);
    }
    console.log(`  - Blocked non-admin: "${email}" -> ok`);
  }
  console.log("✅ Admin verification checks passed!");

  // 2. Connect DB (or fallback gracefully)
  console.log("\n2. Connecting to DB or preparing fallback database...");
  await connectDB();
  const isDb = getIsDbActive();
  console.log(`Database active: ${isDb ? 'MongoDB' : 'Memory Fallback File'}`);

  // 3. Test feedback insertion
  console.log("\n3. Adding test feedback...");
  const testFeedback = {
    roomCode: "TEST_FB_99",
    playerId: "test_player_id_101",
    username: "Test Reviewer",
    email: "reviewer@gmail.com",
    rating: 4,
    category: "Gameplay Rules",
    comment: "Indian rules are perfectly implemented. Love the tax rates!"
  };

  const saved = await addFeedback(testFeedback);
  console.log("Saved feedback object:", saved);

  if (!saved.feedbackId || saved.roomCode !== "TEST_FB_99" || saved.rating !== 4) {
    console.error("FAIL: Saved feedback format or properties mismatch.");
    process.exit(1);
  }
  console.log("✅ Feedback object saved successfully!");

  // 4. Retrieve feedback list
  console.log("\n4. Retrieving all feedback...");
  const allFeedbacks = await getAllFeedback();
  console.log(`Total feedback records retrieved: ${allFeedbacks.length}`);

  const found = allFeedbacks.find(f => f.feedbackId === saved.feedbackId);
  if (!found) {
    console.error("FAIL: Saved feedback not found in the feedback list!");
    process.exit(1);
  }

  console.log("Found matching feedback:", found);
  if (found.comment !== testFeedback.comment || found.category !== testFeedback.category) {
    console.error("FAIL: Retrieved feedback fields desync!");
    process.exit(1);
  }
  console.log("✅ Feedback retrieval validation passed!");

  // 4.5. Test feedback uniqueness validation (hasSubmittedFeedback)
  console.log("\n4.5. Checking feedback uniqueness validator...");
  const hasSubmittedTrue = await hasSubmittedFeedback("TEST_FB_99", "test_player_id_101");
  console.log(`- hasSubmittedFeedback for existing submission: ${hasSubmittedTrue} (Expected: true)`);
  if (!hasSubmittedTrue) {
    console.error("FAIL: hasSubmittedFeedback returned false for an existing submission!");
    process.exit(1);
  }
  
  const hasSubmittedFalse = await hasSubmittedFeedback("TEST_FB_99", "another_player_id");
  console.log(`- hasSubmittedFeedback for non-existing submission: ${hasSubmittedFalse} (Expected: false)`);
  if (hasSubmittedFalse) {
    console.error("FAIL: hasSubmittedFeedback returned true for a non-existing submission!");
    process.exit(1);
  }
  console.log("✅ Feedback uniqueness validation passed!");

  // 5. If in fallback mode, check that the json file exists and is populated
  if (!isDb) {
    console.log("\n5. Checking memory fallback file persistence...");
    const fallbackPath = path.join(__dirname, 'feedback_fallback.json');
    if (!fs.existsSync(fallbackPath)) {
      console.error(`FAIL: fallback file not created at ${fallbackPath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    const records = JSON.parse(raw);
    const inJson = records.find(r => r.feedbackId === saved.feedbackId);
    if (!inJson) {
      console.error("FAIL: Saved feedback not written to feedback_fallback.json!");
      process.exit(1);
    }
    console.log(`✅ feedback_fallback.json verified! Found ${records.length} records in fallback.`);
  }

  console.log("\n✅ ALL ADMIN & FEEDBACK TESTS PASSED SUCCESSFULLY! ✅");
  process.exit(0);
};

runTest().catch(err => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
