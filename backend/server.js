const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { rateLimit } = require("express-rate-limit");
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.warn("⚠️ [Security] JWT_SECRET environment variable is missing! Falling back to default secret.");
  process.env.JWT_SECRET = "SafathSruthiJwtSecretKey2026!";
}
if (!process.env.ADMIN_SECRET) {
  console.warn("⚠️ [Security] ADMIN_SECRET environment variable is missing! Falling back to default secret.");
  process.env.ADMIN_SECRET = "SafathSruthiAdminSecret2026!";
}
const { connectDB } = require("./socket/roomModel");
const { seedDefaultUsers } = require("./socket/userModel");

connectDB().then(() => {
  seedDefaultUsers();
});

const { mountGameSocket, rooms, destroyRoom, broadcastGameState, emitRoomUpdated } = require("./socket/gameSocket");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many authentication requests from this IP, please try again after 15 minutes."
  }
});

const feedbackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many feedback submissions from this IP, please try again after 10 minutes."
  }
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

const crypto = require('crypto');

// Generate HMAC-based signature token for player validation
const generateToken = (playerId) => {
  const secret = process.env.JWT_SECRET;
  const signature = crypto.createHmac('sha256', secret).update(playerId).digest('hex');
  return `${playerId}.${signature}`;
};

// Verify the player signature token
const verifyToken = (token) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [playerId, signature] = parts;
  const secret = process.env.JWT_SECRET;
  const expectedSignature = crypto.createHmac('sha256', secret).update(playerId).digest('hex');
  if (signature === expectedSignature) {
    return playerId;
  }
  return null;
};

// Express middleware to enforce player identity token check
const verifyPlayerAuth = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Access Denied: Missing authorization token." });
    }
    const token = authHeader.split(" ")[1];
    const verifiedPlayerId = verifyToken(token);
    if (!verifiedPlayerId) {
      return res.status(401).json({ ok: false, error: "Access Denied: Invalid token signature." });
    }
    
    // Set resolved playerId on the request object for validation in endpoints
    req.playerId = verifiedPlayerId;
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: "Access Denied: Authentication failed." });
  }
};

// Authentication Router
const authRouter = express.Router();

// Google Sign-In (Verifies real Google ID token and auto-registers if not exist)
authRouter.post("/google-login", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ ok: false, error: "Missing Google credential token." });
    }
    
    // Call Google tokeninfo endpoint to verify token authenticity
    const googleVerifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!googleVerifyRes.ok) {
      const errData = await googleVerifyRes.json();
      return res.status(400).json({ ok: false, error: errData.error_description || "Invalid Google credential." });
    }
    
    const payload = await googleVerifyRes.json();
    
    // Validate target audience (Google Client ID) to prevent token replay attacks
    const expectedClientId = process.env.GOOGLE_CLIENT_ID || "498630830975-gad0rf38lrpmbie71oomacuko2ksjm79.apps.googleusercontent.com";
    if (payload.aud !== expectedClientId) {
      return res.status(400).json({ ok: false, error: "Token audience mismatch." });
    }
    
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;
    
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email address not found in Google profile." });
    }
    
    const targetEmail = email.trim().toLowerCase();
    
    const { findUserByEmail, registerUser } = require("./socket/userModel");
    let user = await findUserByEmail(targetEmail);
    
    if (!user) {
      // Auto-register using Google profile name and email
      const defaultName = name || targetEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
      const nameCapitalized = defaultName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      user = await registerUser(nameCapitalized, targetEmail);
    }

    if (user && user.isBanned) {
      return res.status(403).json({ ok: false, error: user.banReason || "Your account has been suspended by the administrator." });
    }
    
    // Auto-sync real Google avatar image if user has default avatar
    if (picture && (!user.avatar || user.avatar.includes("dicebear.com"))) {
      user.avatar = picture;
      const { updateAvatar } = require("./socket/userModel");
      await updateAvatar(user.playerId, picture);
    }
    
    const token = generateToken(user.playerId);
    res.json({ ok: true, user: { ...user, token } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Update stats when game is finished
authRouter.post("/update-stats", verifyPlayerAuth, async (req, res) => {
  try {
    const { 
      playerId, 
      wins, 
      games, 
      losses, 
      loansTaken, 
      propertiesPurchased, 
      totalNetWorthEarned,
      propertiesMortgaged,
      propertiesRepossessed,
      auctionsWon,
      rentPaid,
      rentEarned,
      bankruptcies,
      hotelsBuilt
    } = req.body;
    if (!playerId) {
      return res.status(400).json({ ok: false, error: "Missing playerId." });
    }
    if (playerId !== req.playerId) {
      return res.status(403).json({ ok: false, error: "Access Denied: You cannot update another player's statistics." });
    }
    
    const { updateUserStats } = require("./socket/userModel");
    const updatedUser = await updateUserStats(
      playerId,
      wins,
      games,
      losses,
      loansTaken,
      propertiesPurchased,
      totalNetWorthEarned,
      propertiesMortgaged,
      propertiesRepossessed,
      auctionsWon,
      rentPaid,
      rentEarned,
      bankruptcies,
      hotelsBuilt
    );
    
    if (!updatedUser) {
      return res.status(404).json({ ok: false, error: "Player profile not found on server." });
    }
    
    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Fetch public profile statistics and completed matches history
authRouter.get("/profile/:playerId", async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) {
      return res.status(400).json({ ok: false, error: "Missing playerId." });
    }

    const { findUserById } = require("./socket/userModel");
    const user = await findUserById(playerId);

    if (!user) {
      return res.status(404).json({ ok: false, error: "Player profile not found." });
    }

    const { getPlayerMatches } = require("./socket/matchModel");
    const matches = await getPlayerMatches(playerId);

    res.json({ ok: true, user, matches });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Update user avatar
authRouter.post("/update-avatar", verifyPlayerAuth, async (req, res) => {
  try {
    const { playerId, avatar } = req.body;
    if (!playerId || !avatar) {
      return res.status(400).json({ ok: false, error: "Missing playerId or avatar." });
    }
    if (playerId !== req.playerId) {
      return res.status(403).json({ ok: false, error: "Access Denied: You cannot update another player's avatar." });
    }
    const { updateAvatar } = require("./socket/userModel");
    const updatedUser = await updateAvatar(playerId, avatar);
    if (!updatedUser) {
      return res.status(404).json({ ok: false, error: "Player profile not found on server." });
    }
    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Feedback Router
const feedbackRouter = express.Router();
feedbackRouter.post("/submit", async (req, res) => {
  try {
    const { roomCode, playerId, username, email, rating, category, comment } = req.body;
    if (!playerId || !username || !rating || !category) {
      return res.status(400).json({ ok: false, error: "Missing required feedback fields." });
    }
    const { addFeedback, hasSubmittedFeedback } = require("./socket/feedbackModel");
    
    // Check if feedback was already submitted for this room & player
    if (roomCode) {
      const alreadySubmitted = await hasSubmittedFeedback(roomCode, playerId);
      if (alreadySubmitted) {
        return res.status(400).json({ ok: false, error: "You have already submitted feedback for this match!" });
      }
    }

    const result = await addFeedback({ roomCode, playerId, username, email, rating, category, comment });
    res.json({ ok: true, feedback: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.use("/api/feedback", feedbackLimiter, feedbackRouter);

// Admin Router
const adminRouter = express.Router();

// Verify administrator privilege middleware
const verifyAdmin = (req, res, next) => {
  try {
    const secret = req.headers["x-admin-secret"];
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!secret || secret !== expectedSecret) {
      return res.status(403).json({ ok: false, error: "Access Denied: Invalid admin secret." });
    }
    next();
  } catch (err) {
    res.status(403).json({ ok: false, error: "Access Denied." });
  }
};

// Admin metrics & rooms directory endpoint
adminRouter.get("/metrics", verifyAdmin, async (req, res) => {
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    // Parse active rooms from memory Map
    const activeRooms = [];
    let lobbiesCount = 0;
    let gamesCount = 0;
    let onlinePlayersCount = 0;
    let playingPlayersCount = 0;
    
    const { BOARD_TILES } = require("./game-engine/boardData");
    for (const room of rooms.values()) {
      const isPlaying = room.status === 'playing' || (room.gameState && room.gameState.status === 'playing');
      if (isPlaying) {
        gamesCount++;
      } else {
        lobbiesCount++;
      }

      // Count connected human players and spectators in this room
      const humanPlayers = room.players.filter(p => !p.isBot && p.connected);
      const humanSpectators = (room.spectators || []).filter(p => p.connected);
      onlinePlayersCount += (humanPlayers.length + humanSpectators.length);
      if (isPlaying) {
        playingPlayersCount += humanPlayers.length;
      }
      
      const playersDetails = [];
      if (room.gameState) {
        Object.values(room.gameState.players).forEach(p => {
          const ownedTileNames = [];
          for (const tile of BOARD_TILES) {
            const propState = room.gameState.properties[tile.id];
            if (propState && propState.ownerId === p.id && !propState.mortgaged) {
              ownedTileNames.push(tile.name);
            }
          }
          const roomPlayer = room.players.find(rp => rp.id === p.id);
          playersDetails.push({
            id: p.id,
            username: p.username,
            money: p.money,
            isBot: p.isBot || false,
            autoplay: roomPlayer?.autoplay || false,
            isConnected: roomPlayer?.connected !== false,
            properties: ownedTileNames
          });
        });
      } else {
        room.players.forEach(p => {
          playersDetails.push({
            id: p.id,
            username: p.username,
            isBot: p.isBot || false,
            autoplay: p.autoplay || false,
            isConnected: p.connected !== false,
            properties: []
          });
        });
      }

      activeRooms.push({
        code: room.code,
        status: isPlaying ? 'playing' : 'lobby',
        host: room.players.find(p => p.id === room.hostId)?.username || 'System',
        playerCount: room.players.length,
        spectatorCount: (room.spectators || []).length,
        createdAt: room.createdAt || Date.now(),
        players: playersDetails,
        currentTurnPlayerId: room.gameState?.currentPlayerId || null,
        currentTurnPlayerName: room.gameState?.players[room.gameState.currentPlayerId]?.username || null
      });
    }

    const { getIsDbActive } = require("./socket/roomModel");
    const { getCompletedMatchesCount } = require("./socket/matchModel");
    const finishedGamesCount = await getCompletedMatchesCount();
    
    res.json({
      ok: true,
      metrics: {
        uptime,
        memoryUsage: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          rss: memory.rss
        },
        socketsCount: io.sockets.sockets.size,
        onlinePlayersCount,
        playingPlayersCount,
        finishedGamesCount,
        lobbiesCount,
        gamesCount,
        dbStatus: getIsDbActive() ? 'connected' : 'memory-fallback',
        rooms: activeRooms
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin global alert broadcast endpoint
adminRouter.post("/broadcast", verifyAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ ok: false, error: "Missing alert message text." });
    }
    // Broadcast system-alert event to all connected sockets
    io.emit("system-alert", { message });
    console.log(`[admin] Broadcasted alert: "${message}"`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin force close room endpoint
adminRouter.post("/force-close", verifyAdmin, async (req, res) => {
  try {
    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ ok: false, error: "Missing roomCode." });
    }
    const targetCode = String(roomCode).toUpperCase();
    const room = rooms.get(targetCode);
    if (!room) {
      return res.status(404).json({ ok: false, error: `Active room ${targetCode} not found.` });
    }
    destroyRoom(io, room);
    console.log(`[admin] Force closed room ${targetCode}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin toggle autoplay (bot takeover) endpoint
adminRouter.post("/toggle-autoplay", verifyAdmin, async (req, res) => {
  try {
    const { roomCode, playerId, autoplay } = req.body;
    if (!roomCode || !playerId) {
      return res.status(400).json({ ok: false, error: "Missing roomCode or playerId." });
    }
    const targetCode = String(roomCode).toUpperCase();
    const room = rooms.get(targetCode);
    if (!room) {
      return res.status(404).json({ ok: false, error: `Active room ${targetCode} not found.` });
    }
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ ok: false, error: `Player ${playerId} not found in room ${targetCode}.` });
    }
    
    const isAutoplay = Boolean(autoplay);
    player.autoplay = isAutoplay;
    
    if (room.gameState && room.gameState.players[playerId]) {
      room.gameState.players[playerId].autoplay = isAutoplay;
    }
    
    const { triggerBotCycle, broadcastGameState } = require("./socket/gameSocket");
    triggerBotCycle(io, room);
    broadcastGameState(io, room);

    console.log(`[admin] Toggled autoplay to ${isAutoplay} for player ${player.username} in room ${targetCode}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin edit user stats endpoint
adminRouter.post("/edit-stats", verifyAdmin, async (req, res) => {
  try {
    const { playerId, wins, games, level, totalNetWorthEarned } = req.body;
    if (!playerId) {
      return res.status(400).json({ ok: false, error: "playerId is required" });
    }
    
    const { User, inMemoryUsers, saveMemoryUsersToFile, getIsDbActive } = require("./socket/userModel");
    
    const updates = {};
    if (wins !== undefined) updates.wins = Number(wins);
    if (games !== undefined) updates.games = Number(games);
    if (level !== undefined) updates.level = Number(level);
    if (totalNetWorthEarned !== undefined) updates.totalNetWorthEarned = Number(totalNetWorthEarned);
    
    const dbActive = getIsDbActive();
    if (dbActive) {
      const updated = await User.findOneAndUpdate({ playerId }, updates, { returnDocument: 'after' }).lean();
      if (!updated) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      res.json({ ok: true, player: updated });
    } else {
      let found = null;
      for (const [email, u] of inMemoryUsers.entries()) {
        if (u.playerId === playerId) {
          const updated = { ...u, ...updates };
          inMemoryUsers.set(email, updated);
          found = updated;
          break;
        }
      }
      if (!found) {
        return res.status(404).json({ ok: false, error: "User not found in memory" });
      }
      saveMemoryUsersToFile();
      res.json({ ok: true, player: found });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin toggle user ban/suspension endpoint
adminRouter.post("/toggle-ban", verifyAdmin, async (req, res) => {
  try {
    const { playerId, isBanned, banReason } = req.body;
    if (!playerId) {
      return res.status(400).json({ ok: false, error: "playerId is required" });
    }
    
    const { User, inMemoryUsers, saveMemoryUsersToFile, getIsDbActive } = require("./socket/userModel");
    
    const updates = {
      isBanned: Boolean(isBanned),
      banReason: banReason || ""
    };
    
    const dbActive = getIsDbActive();
    if (dbActive) {
      const updated = await User.findOneAndUpdate({ playerId }, updates, { returnDocument: 'after' }).lean();
      if (!updated) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      res.json({ ok: true, player: updated });
    } else {
      let found = null;
      for (const [email, u] of inMemoryUsers.entries()) {
        if (u.playerId === playerId) {
          const updated = { ...u, ...updates };
          inMemoryUsers.set(email, updated);
          found = updated;
          break;
        }
      }
      if (!found) {
        return res.status(404).json({ ok: false, error: "User not found in memory" });
      }
      saveMemoryUsersToFile();
      res.json({ ok: true, player: found });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin feedbacks list endpoint
adminRouter.get("/feedback", verifyAdmin, async (req, res) => {
  try {
    const { getAllFeedback } = require("./socket/feedbackModel");
    const feedbacks = await getAllFeedback();
    res.json({ ok: true, feedbacks });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin players list endpoint
adminRouter.get("/players", verifyAdmin, async (req, res) => {
  try {
    const { getAllRegisteredUsers } = require("./socket/userModel");
    const players = await getAllRegisteredUsers();
    res.json({ ok: true, players });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api/admin", adminRouter);

app.use("/api/auth", authLimiter, authRouter);

// QA State Injection Endpoint for verification suite
app.post("/api/qa/inject", (req, res) => {
  const { roomCode, gameState, players, status } = req.body;
  if (!roomCode) return res.status(400).json({ ok: false, error: "Missing roomCode" });
  
  const targetCode = String(roomCode).toUpperCase();
  let room = rooms.get(targetCode);
  if (!room) {
    room = {
      code: targetCode,
      hostId: players?.[0]?.id || 'host-qa',
      status: status || 'playing',
      players: players || [],
      spectators: [],
      chatHistory: []
    };
    rooms.set(targetCode, room);
  }
  
  if (gameState) {
    room.gameState = gameState;
    room.status = status || 'playing';
  }

  // Update players array if provided
  if (players) {
    room.players = players;
  }

  if (typeof io !== 'undefined' && io) {
    broadcastGameState(io, room);
    emitRoomUpdated(io, room);
  }
  
  const roomClean = {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players,
    gameState: room.gameState
  };
  res.json({ ok: true, room: roomClean });
});

// Basic route
app.get("/", (req, res) => {
  res.send("🚀 Monopoly India Backend Running");
});

// Health-check endpoint (used by keep-alive ping)
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), rooms: Object.keys(rooms).length });
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  // ── Transport ────────────────────────────────────────────────────────────
  // Render.com free-tier HTTP proxy causes WebSocket upgrades to fail within
  // ~1 second, creating a reconnect death loop.  Force polling-only on both
  // client and server to avoid the upgrade dance entirely.
  transports: ['polling'],
  allowUpgrades: false,
  // Engine.IO v3 compatibility (some browsers / proxy setups)
  allowEIO3: true,
  // ── Ping/Pong timing ─────────────────────────────────────────────────────
  // pingInterval: how often the server sends a ping to detect dead connections
  // pingTimeout:  how long the server waits for a pong before declaring disconnect
  // Total dead-connection detection time = pingInterval + pingTimeout = 35s
  pingInterval: 25000,
  pingTimeout:  10000,
});

mountGameSocket(io);

// Port
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // ─── Keep-Alive Ping (prevents Render free tier spin-down) ───────────────
  // Render spins down free instances after ~15 minutes of inactivity.
  // We self-ping /health every 10 minutes so the server stays warm 24/7.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  setInterval(() => {
    const url = new URL(`${SELF_URL}/health`);
    const mod = url.protocol === "https:" ? require("https") : require("http");
    const req = mod.get(url.href, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          console.log(`[keep-alive] ✅ pong — uptime=${Math.floor(data.uptime)}s rooms=${data.rooms}`);
        } catch (_) {
          console.log(`[keep-alive] ✅ pong (non-JSON)`);
        }
      });
    });
    req.on("error", (err) => {
      console.warn(`[keep-alive] ⚠️ ping failed: ${err.message}`);
    });
    req.end();
  }, PING_INTERVAL_MS);
  // ──────────────────────────────────────────────────────────────────────────
});

// Process-level watchers for uncaught rejections/exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception thrown:", err);
});

