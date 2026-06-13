/**
 * backend/socket/userModel.js
 * 
 * Persistent/in-memory user registry for Monopoly India.
 * Tracks detailed lifetime profile statistics including wins, losses, loans, and net worth.
 */

const mongoose = require('mongoose');
const { getIsDbActive } = require('./roomModel');

// 1. User Schema definition for MongoDB
const UserSchema = new mongoose.Schema({
  playerId: { type: String, unique: true, required: true },
  username: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  avatar: { type: String },
  level: { type: Number, default: 1 },
  wins: { type: Number, default: 0 },
  games: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  loansTaken: { type: Number, default: 0 },
  propertiesPurchased: { type: Number, default: 0 },
  totalNetWorthEarned: { type: Number, default: 0 },
  propertiesMortgaged: { type: Number, default: 0 },
  propertiesRepossessed: { type: Number, default: 0 },
  auctionsWon: { type: Number, default: 0 },
  rentPaid: { type: Number, default: 0 },
  rentEarned: { type: Number, default: 0 },
  bankruptcies: { type: Number, default: 0 },
  hotelsBuilt: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// 2. In-Memory user registry fallback
const inMemoryUsers = new Map();

const fs = require('fs');
const path = require('path');
const FALLBACK_FILE_PATH = path.join(__dirname, '..', 'users_fallback.json');

const loadMemoryUsersFromFile = () => {
  try {
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const raw = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8');
      const data = JSON.parse(raw);
      for (const u of data) {
        inMemoryUsers.set(u.email.toLowerCase(), u);
      }
      console.log(`[memory] Loaded ${data.length} registered user profiles from persistent fallback file.`);
    }
  } catch (err) {
    console.error("[memory] Failed to load persistent fallback users:", err.message);
  }
};

const saveMemoryUsersToFile = () => {
  try {
    const list = Array.from(inMemoryUsers.values());
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.log(`[memory] Saved ${list.length} user profiles to persistent fallback file.`);
  } catch (err) {
    console.error("[memory] Failed to save persistent fallback users:", err.message);
  }
};

/**
 * Seed default mock accounts on startup (No-op/fallback load only - no hardcoded users)
 */
const seedDefaultUsers = async () => {
  const dbActive = getIsDbActive();
  if (!dbActive) {
    loadMemoryUsersFromFile();
  }
};

/**
 * Find user by email (case-insensitive)
 */
const findUserByEmail = async (email) => {
  if (!email) return null;
  const targetEmail = email.trim().toLowerCase();
  
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      return await User.findOne({ email: targetEmail }).lean();
    } catch (err) {
      console.error(`[db] findUserByEmail failed for ${targetEmail}:`, err.message);
    }
  }
  
  return inMemoryUsers.get(targetEmail) || null;
};

/**
 * Find user by playerId
 */
const findUserById = async (playerId) => {
  if (!playerId) return null;
  
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      return await User.findOne({ playerId }).lean();
    } catch (err) {
      console.error(`[db] findUserById failed for ${playerId}:`, err.message);
    }
  }
  
  // Memory mode: search by playerId
  for (const u of inMemoryUsers.values()) {
    if (u.playerId === playerId) {
      return u;
    }
  }
  return null;
};

/**
 * Register a new user profile
 */
const registerUser = async (username, email) => {
  const targetEmail = email.trim().toLowerCase();
  const playerId = `google_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.floor(Math.random() * 10000)}`;
  
  const record = {
    playerId,
    username,
    email: targetEmail,
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`,
    level: 1,
    wins: 0,
    games: 0,
    losses: 0,
    loansTaken: 0,
    propertiesPurchased: 0,
    totalNetWorthEarned: 15000, // starting baseline net worth
    propertiesMortgaged: 0,
    propertiesRepossessed: 0,
    auctionsWon: 0,
    rentPaid: 0,
    rentEarned: 0,
    bankruptcies: 0,
    hotelsBuilt: 0,
    isBanned: false,
    banReason: ''
  };

  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      const created = await User.create(record);
      console.log(`[db] Registered persistent user profile: ${targetEmail}`);
      return created.toObject();
    } catch (err) {
      console.error(`[db] Failed to save user registry:`, err.message);
      throw err;
    }
  }

  // Memory mode fallback
  inMemoryUsers.set(targetEmail, record);
  saveMemoryUsersToFile();
  console.log(`[memory] Registered local user profile: ${targetEmail}`);
  return record;
};

/**
 * Update user profile statistics when a match concludes
 */
const updateUserStats = async (
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
) => {
  const parsedWins = parseInt(wins) || 0;
  const parsedGames = parseInt(games) || 0;
  const parsedLosses = parseInt(losses) || 0;
  const parsedLoans = parseInt(loansTaken) || 0;
  const parsedProps = parseInt(propertiesPurchased) || 0;
  const parsedNetWorth = parseInt(totalNetWorthEarned) || 0;
  const parsedMortgages = parseInt(propertiesMortgaged) || 0;
  const parsedRepossessed = parseInt(propertiesRepossessed) || 0;
  const parsedAuctions = parseInt(auctionsWon) || 0;
  const parsedRentPaid = parseInt(rentPaid) || 0;
  const parsedRentEarned = parseInt(rentEarned) || 0;
  const parsedBankruptcies = parseInt(bankruptcies) || 0;
  const parsedHotelsBuilt = parseInt(hotelsBuilt) || 0;

  const calculatedLevel = Math.floor(parsedWins * 0.3) + 1;

  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      const updated = await User.findOneAndUpdate(
        { playerId },
        {
          wins: parsedWins,
          games: parsedGames,
          losses: parsedLosses,
          loansTaken: parsedLoans,
          propertiesPurchased: parsedProps,
          totalNetWorthEarned: parsedNetWorth,
          propertiesMortgaged: parsedMortgages,
          propertiesRepossessed: parsedRepossessed,
          auctionsWon: parsedAuctions,
          rentPaid: parsedRentPaid,
          rentEarned: parsedRentEarned,
          bankruptcies: parsedBankruptcies,
          hotelsBuilt: parsedHotelsBuilt,
          level: calculatedLevel
        },
        { new: true }
      ).lean();
      if (updated) {
        console.log(`[db] Updated stats for player ${playerId}: Wins ${parsedWins}, Games ${parsedGames}, Level ${calculatedLevel}`);
        return updated;
      }
    } catch (err) {
      console.error(`[db] Failed to update stats for player ${playerId}:`, err.message);
    }
  }

  // Memory mode: lookup and update
  for (const [email, u] of inMemoryUsers.entries()) {
    if (u.playerId === playerId) {
      const updated = {
        ...u,
        wins: parsedWins,
        games: parsedGames,
        losses: parsedLosses,
        loansTaken: parsedLoans,
        propertiesPurchased: parsedProps,
        totalNetWorthEarned: parsedNetWorth,
        propertiesMortgaged: parsedMortgages,
        propertiesRepossessed: parsedRepossessed,
        auctionsWon: parsedAuctions,
        rentPaid: parsedRentPaid,
        rentEarned: parsedRentEarned,
        bankruptcies: parsedBankruptcies,
        hotelsBuilt: parsedHotelsBuilt,
        level: calculatedLevel
      };
      inMemoryUsers.set(email, updated);
      console.log(`[memory] Updated stats for player ${playerId}: Wins ${parsedWins}, Games ${parsedGames}, Level ${calculatedLevel}`);
      saveMemoryUsersToFile();
      return updated;
    }
  }

  return null;
};

const getAllRegisteredUsers = async () => {
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      return await User.find().sort({ level: -1, wins: -1 }).lean();
    } catch (err) {
      console.error("[db] Failed to get all users:", err.message);
    }
  }
  return Array.from(inMemoryUsers.values()).sort((a, b) => b.level - a.level || b.wins - a.wins);
};

const isAdmin = (email) => {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  const adminEmailsVar = process.env.ADMIN_EMAILS || "msafath2004@gmail.com,mariannesruthi@gmail.com";
  const adminEmails = adminEmailsVar.split(",").map(e => e.trim().toLowerCase());
  return adminEmails.includes(target);
};

const updateAvatar = async (playerId, avatar) => {
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      const updated = await User.findOneAndUpdate(
        { playerId },
        { avatar },
        { new: true }
      ).lean();
      if (updated) {
        console.log(`[db] Updated avatar for player ${playerId}`);
        return updated;
      }
    } catch (err) {
      console.error(`[db] Failed to update avatar for player ${playerId}:`, err.message);
    }
  }

  // Memory mode fallback
  for (const [email, u] of inMemoryUsers.entries()) {
    if (u.playerId === playerId) {
      const updated = { ...u, avatar };
      inMemoryUsers.set(email, updated);
      console.log(`[memory] Updated avatar for player ${playerId}`);
      saveMemoryUsersToFile();
      return updated;
    }
  }
  return null;
};

module.exports = {
  User,
  seedDefaultUsers,
  findUserByEmail,
  findUserById,
  registerUser,
  updateUserStats,
  isAdmin,
  getAllRegisteredUsers,
  updateAvatar
};
