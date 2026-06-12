/**
 * backend/testDebounce.js
 *
 * Verifies MongoDB room write debouncing.
 * Mocks Mongoose model to assert that updates are debounced.
 */

// Mock Room model and isDbActive
const path = require('path');
const fs = require('fs');

// We will mock mongoose and Room model
const mockFindOneAndUpdateCalls = [];

const mockRoomModel = {
  findOneAndUpdate: async (query, update, options) => {
    mockFindOneAndUpdateCalls.push({ query, update });
    return update;
  }
};

// Override require/globals if necessary or load roomModel with mocks
// Since we want to test roomModel.js directly, let's load it and temporarily mock the variables inside it using custom mock helpers or by direct replacement for test.
// Actually, let's require roomModel and modify its internal variables for testing since it connects to mongoose.
const mongoose = require('mongoose');

// We will stub the mongoose Room model's findOneAndUpdate
const originalFindOneAndUpdate = mongoose.Model.findOneAndUpdate;
mongoose.Model.findOneAndUpdate = mockRoomModel.findOneAndUpdate;

const { saveRoom, connectDB, getIsDbActive } = require('./socket/roomModel');

// Inject true to isDbActive to simulate MongoDB connection
const roomModelModule = require('./socket/roomModel');
// Let's modify the internal isDbActive using a trick: we can mock connectDB to set it to true.
// Since connectDB sets isDbActive = true on successful connection, we can mock mongoose.connect to resolve successfully!
const originalConnect = mongoose.connect;
mongoose.connect = async () => {
  // Mock connection success
  return true;
};

const runTest = async () => {
  console.log("=== STARTING MONGO DB DEBOUNCE VERIFICATION ===");

  await connectDB();
  console.log(`Simulated Database active: ${getIsDbActive()}`);

  const roomCode = `TEST_${Date.now()}`;
  const mockRoom = {
    code: roomCode,
    hostId: "player_1",
    status: "lobby",
    players: [{ id: "player_1", username: "Host", connected: true }],
    chatHistory: [],
    gameState: null
  };

  // 1. First save (critical: statusChanged because metadata doesn't exist)
  console.log("\n1. Performing first save (lobby status)...");
  await saveRoom(mockRoom);
  console.log(`Database writes: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 1) {
    console.error("FAIL: First save should write immediately.");
    process.exit(1);
  }

  // 2. Perform second identical save (non-critical: status and turn are identical, time limit not reached)
  console.log("\n2. Performing rapid duplicate save...");
  await saveRoom(mockRoom);
  console.log(`Database writes: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 1) {
    console.error("FAIL: Rapid duplicate save should be debounced (not written immediately).");
    process.exit(1);
  }

  // 3. Perform turn transition save (critical: currentPlayerId changed)
  console.log("\n3. Simulating turn transition...");
  const mockRoomWithGame = {
    ...mockRoom,
    status: "playing",
    gameState: {
      status: "playing",
      currentPlayerId: "player_1"
    }
  };

  // Status changed to playing (critical)
  await saveRoom(mockRoomWithGame);
  console.log(`Database writes: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 2) {
    console.error("FAIL: Status change should write immediately.");
    process.exit(1);
  }

  // Same turn duplicate save (non-critical)
  await saveRoom(mockRoomWithGame);
  console.log(`Database writes: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 2) {
    console.error("FAIL: Same turn duplicate should be debounced.");
    process.exit(1);
  }

  // Turn changes to player_2 (critical: turn transition)
  console.log("\n4. Simulating turn transition to another player...");
  const mockRoomNextTurn = {
    ...mockRoomWithGame,
    gameState: {
      ...mockRoomWithGame.gameState,
      currentPlayerId: "player_2"
    }
  };
  await saveRoom(mockRoomNextTurn);
  console.log(`Database writes: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 3) {
    console.error("FAIL: Turn transition should trigger immediate write.");
    process.exit(1);
  }

  // 4. Test debounced timeout write
  console.log("\n5. Checking if debounced non-critical save writes after timeout...");
  // Make a minor change that is non-critical (e.g. chatHistory updated)
  const mockRoomMinorChange = {
    ...mockRoomNextTurn,
    chatHistory: [{ username: "Host", message: "Hello performance!" }]
  };
  await saveRoom(mockRoomMinorChange);
  console.log(`Database writes immediately: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 3) {
    console.error("FAIL: Minor change should be debounced.");
    process.exit(1);
  }

  // Wait 5.5 seconds for the debounce timer to execute
  console.log("Waiting 5.5 seconds for debounce timer...");
  await new Promise(resolve => setTimeout(resolve, 5500));

  console.log(`Database writes after timeout: ${mockFindOneAndUpdateCalls.length}`);
  if (mockFindOneAndUpdateCalls.length !== 4) {
    console.error("FAIL: Debounced save did not write after timeout.");
    process.exit(1);
  }

  console.log("\n✅ ALL DB WRITE DEBOUNCING VERIFICATION TESTS PASSED SUCCESSFULLY! ✅");
  
  // Clean up global mock modifications
  mongoose.Model.findOneAndUpdate = originalFindOneAndUpdate;
  mongoose.connect = originalConnect;
  process.exit(0);
};

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
