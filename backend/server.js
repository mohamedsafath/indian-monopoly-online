const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { rateLimit } = require("express-rate-limit");
require("dotenv").config();
const { connectDB } = require("./socket/roomModel");
const { seedDefaultUsers } = require("./socket/userModel");

connectDB().then(() => {
  seedDefaultUsers();
});

const { mountGameSocket, rooms, destroyRoom } = require("./socket/gameSocket");

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
  const secret = process.env.JWT_SECRET || 'SafathSruthiJwtSecretKey2026!';
  const signature = crypto.createHmac('sha256', secret).update(playerId).digest('hex');
  return `${playerId}.${signature}`;
};

// Verify the player signature token
const verifyToken = (token) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [playerId, signature] = parts;
  const secret = process.env.JWT_SECRET || 'SafathSruthiJwtSecretKey2026!';
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

// Temporary OTP store with email association
const pendingOtps = new Map();

// Authentication Router
const authRouter = express.Router();

// 1. Request verification OTP during registration
authRouter.post("/register-request", async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ ok: false, error: "Please fill in all fields." });
    }
    const targetEmail = email.trim().toLowerCase();
    
    // Validate Gmail email suffix
    if (!targetEmail.endsWith("@gmail.com")) {
      return res.status(400).json({ ok: false, error: "Please use a valid Gmail account (@gmail.com)." });
    }
    
    if (username.trim().length < 2) {
      return res.status(400).json({ ok: false, error: "Full Name must be at least 2 characters." });
    }
    
    // Check if duplicate email already registered
    const { findUserByEmail } = require("./socket/userModel");
    const existing = await findUserByEmail(targetEmail);
    if (existing) {
      return res.status(400).json({ ok: false, error: "This Gmail account is already registered! Please Sign In." });
    }
    
    // Generate a 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingOtps.set(targetEmail, {
      username: username.trim(),
      email: targetEmail,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes TTL
    });
    
    // Dispatch real email or fallback to console logs if SMTP credentials are not configured
    const { sendOtpEmail } = require("./services/emailService");
    const mailResult = await sendOtpEmail(targetEmail, otp);
    
    res.json({
      ok: true,
      message: mailResult.fallback
        ? "SMTP credentials not configured on backend. Falling back to console logging."
        : "A 6-digit verification code has been delivered directly to your Gmail inbox.",
      fallback: mailResult.fallback,
      debugOtp: mailResult.fallback ? otp : undefined
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Verify OTP and complete registration
authRouter.post("/register-verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ ok: false, error: "Missing email or OTP verification code." });
    }
    const targetEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    
    const record = pendingOtps.get(targetEmail);
    if (!record) {
      return res.status(400).json({ ok: false, error: "No pending registration request found." });
    }
    
    if (Date.now() > record.expiresAt) {
      pendingOtps.delete(targetEmail);
      return res.status(400).json({ ok: false, error: "Verification code expired. Please request a new code." });
    }
    
    if (record.otp !== cleanOtp) {
      return res.status(400).json({ ok: false, error: "Invalid verification code. Please try again." });
    }
    
    // OTP matches! Register user in persistent DB or in-memory registry
    const { registerUser } = require("./socket/userModel");
    const user = await registerUser(record.username, record.email);
    
    // Clean up OTP record
    pendingOtps.delete(targetEmail);
    
    const token = generateToken(user.playerId);
    res.json({ ok: true, user: { ...user, token } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. User Sign In (Login)
authRouter.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, error: "Please enter your Gmail address." });
    }
    const targetEmail = email.trim().toLowerCase();
    
    const { findUserByEmail } = require("./socket/userModel");
    const user = await findUserByEmail(targetEmail);
    
    if (!user) {
      return res.status(404).json({ ok: false, error: "Gmail is not registered. Please Sign Up first!" });
    }
    
    const token = generateToken(user.playerId);
    res.json({ ok: true, user: { ...user, token } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3.5. Google Sign-In (Auto-registers user if they do not exist)
authRouter.post("/google-login", async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing Gmail address." });
    }
    const targetEmail = email.trim().toLowerCase();
    
    if (!targetEmail.endsWith("@gmail.com")) {
      return res.status(400).json({ ok: false, error: "Please use a valid Gmail address (@gmail.com)." });
    }
    
    const { findUserByEmail, registerUser } = require("./socket/userModel");
    let user = await findUserByEmail(targetEmail);
    
    if (!user) {
      // Auto-register
      const defaultName = username || targetEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
      const nameCapitalized = defaultName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      user = await registerUser(nameCapitalized, targetEmail);
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
      bankruptcies
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
      bankruptcies
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
    const expectedSecret = process.env.ADMIN_SECRET || "SafathSruthiAdminSecret2026!";
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
    
    for (const room of rooms.values()) {
      const isPlaying = room.status === 'playing' || (room.gameState && room.gameState.status === 'playing');
      if (isPlaying) {
        gamesCount++;
      } else {
        lobbiesCount++;
      }
      
      activeRooms.push({
        code: room.code,
        status: isPlaying ? 'playing' : 'lobby',
        host: room.players.find(p => p.id === room.hostId)?.username || 'System',
        playerCount: room.players.length,
        spectatorCount: (room.spectators || []).length,
        createdAt: room.createdAt || Date.now()
      });
    }

    const { getIsDbActive } = require("./socket/roomModel");
    
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

// Basic route
app.get("/", (req, res) => {
  res.send("🚀 Monopoly India Backend Running");
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
});

mountGameSocket(io);

// Port
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Process-level watchers for uncaught rejections/exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception thrown:", err);
});

