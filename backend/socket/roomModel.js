const mongoose = require('mongoose');

// Global flag to track whether MongoDB is active and connected
let isDbActive = false;

// 1. Schemas
const ChatMessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Number, default: Date.now },
  color: String,
});

const PlayerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, required: true },
  socketId: String,
  ready: { type: Boolean, default: false },
  connected: { type: Boolean, default: true },
  disconnectedAt: { type: Number, default: null },
  isSpectator: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
});

const RoomSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  hostId: String,
  status: { type: String, default: 'lobby' }, // 'lobby' | 'playing' | 'finished'
  players: [PlayerSchema],
  spectators: [PlayerSchema],
  gameState: mongoose.Schema.Types.Mixed, // full arbitrary nested game state
  chatHistory: [ChatMessageSchema],
  updatedAt: { type: Date, default: Date.now },
});

const Room = mongoose.model('Room', RoomSchema);

// 2. Connection Helper with Graceful Fallback
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/indian-monopoly";
  try {
    console.log("[db] Connecting to MongoDB...");
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000, // Fail fast after 3 seconds
    });
    isDbActive = true;
    console.log("[db] Connected to MongoDB successfully.");
  } catch (err) {
    isDbActive = false;
    console.warn("[db] MongoDB connection failed, running in MEMORY-ONLY mode:", err.message);
  }
};

// 3. Save / Upsert Room
const saveRoom = async (room) => {
  if (!isDbActive) return;
  try {
    const serializedRoom = {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      players: room.players,
      spectators: room.spectators || [],
      gameState: room.gameState,
      chatHistory: room.chatHistory,
      updatedAt: new Date(),
    };
    await Room.findOneAndUpdate(
      { code: room.code },
      serializedRoom,
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[db] Failed to save room ${room.code}:`, err.message);
  }
};

// 4. Delete Room
const deleteRoom = async (code) => {
  if (!isDbActive) return;
  try {
    await Room.deleteOne({ code });
    console.log(`[db] Room ${code} removed from database.`);
  } catch (err) {
    console.error(`[db] Failed to delete room ${code}:`, err.message);
  }
};

// 5. Load Active Rooms
const loadActiveRooms = async () => {
  if (!isDbActive) return [];
  try {
    const docs = await Room.find({ status: { $ne: 'finished' } }).lean();
    return docs.map((doc) => ({
      code: doc.code,
      hostId: doc.hostId,
      status: doc.status,
      players: doc.players.map((p) => ({
        id: p.id,
        username: p.username,
        socketId: p.socketId,
        ready: p.ready,
        connected: p.connected,
        disconnectedAt: p.disconnectedAt,
        isSpectator: Boolean(p.isSpectator),
        isBot: Boolean(p.isBot),
      })),
      spectators: (doc.spectators || []).map((p) => ({
        id: p.id,
        username: p.username,
        socketId: p.socketId,
        ready: p.ready,
        connected: p.connected,
        disconnectedAt: p.disconnectedAt,
        isSpectator: true,
      })),
      gameState: doc.gameState || null,
      chatHistory: doc.chatHistory || [],
      afkTimer: null, // Timeout object cannot be saved, restored on startup
    }));
  } catch (err) {
    console.error("[db] Failed to load active rooms:", err.message);
    return [];
  }
};

module.exports = {
  connectDB,
  Room,
  saveRoom,
  deleteRoom,
  loadActiveRooms,
  getIsDbActive: () => isDbActive,
};
