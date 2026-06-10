const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

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

// 1.5. In-Memory room registry fallback
const inMemoryRooms = new Map();
const FALLBACK_FILE_PATH = path.join(__dirname, '..', 'rooms_fallback.json');

const loadMemoryRoomsFromFile = () => {
  try {
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const raw = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8');
      const data = JSON.parse(raw);
      inMemoryRooms.clear();
      for (const r of data) {
        inMemoryRooms.set(r.code, r);
      }
      console.log(`[memory] Loaded ${data.length} active rooms from persistent fallback file.`);
    }
  } catch (err) {
    console.error("[memory] Failed to load persistent fallback rooms:", err.message);
  }
};

const saveMemoryRoomsToFile = () => {
  try {
    const list = Array.from(inMemoryRooms.values());
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.log(`[memory] Saved ${list.length} active rooms to persistent fallback file.`);
  } catch (err) {
    console.error("[memory] Failed to save persistent fallback rooms:", err.message);
  }
};

// Initialize fallback rooms cache
loadMemoryRoomsFromFile();

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

  if (isDbActive) {
    try {
      await Room.findOneAndUpdate(
        { code: room.code },
        serializedRoom,
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`[db] Failed to save room ${room.code}:`, err.message);
    }
  } else {
    inMemoryRooms.set(room.code, serializedRoom);
    saveMemoryRoomsToFile();
  }
};

// 4. Delete Room
const deleteRoom = async (code) => {
  if (isDbActive) {
    try {
      await Room.deleteOne({ code });
      console.log(`[db] Room ${code} removed from database.`);
    } catch (err) {
      console.error(`[db] Failed to delete room ${code}:`, err.message);
    }
  } else {
    if (inMemoryRooms.delete(code)) {
      saveMemoryRoomsToFile();
      console.log(`[memory] Room ${code} removed from fallback file.`);
    }
  }
};

// 5. Load Active Rooms
const loadActiveRooms = async () => {
  if (isDbActive) {
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
        afkTimer: null,
      }));
    } catch (err) {
      console.error("[db] Failed to load active rooms:", err.message);
      return [];
    }
  } else {
    return Array.from(inMemoryRooms.values())
      .filter((r) => r.status !== 'finished')
      .map((r) => ({
        code: r.code,
        hostId: r.hostId,
        status: r.status,
        players: r.players.map((p) => ({
          id: p.id,
          username: p.username,
          socketId: p.socketId,
          ready: p.ready,
          connected: p.connected,
          disconnectedAt: p.disconnectedAt,
          isSpectator: Boolean(p.isSpectator),
          isBot: Boolean(p.isBot),
        })),
        spectators: (r.spectators || []).map((p) => ({
          id: p.id,
          username: p.username,
          socketId: p.socketId,
          ready: p.ready,
          connected: p.connected,
          disconnectedAt: p.disconnectedAt,
          isSpectator: true,
        })),
        gameState: r.gameState || null,
        chatHistory: r.chatHistory || [],
        afkTimer: null,
      }));
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
