/**
 * backend/socket/matchModel.js
 * 
 * Persistent/in-memory match history registry for Monopoly India.
 * Stores every completed game with its elapsed duration, competitors, winner, and final rankings.
 */

const mongoose = require('mongoose');
const { getIsDbActive } = require('./roomModel');

// 1. Match Schema definition for MongoDB
const MatchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true, required: true },
  date: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 }, // in seconds
  players: [{ type: String }],            // array of player usernames
  winner: { type: String },               // username of the match champion
  rankings: [mongoose.Schema.Types.Mixed] // final player assets and cash ranking logs
});

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);

// 2. In-Memory match ledger fallback
const inMemoryMatches = [];

/**
 * Save a completed match to MongoDB or memory fallback
 * 
 * @param {Object} matchData — the completed match record
 */
const saveMatch = async (matchData) => {
  const dbActive = getIsDbActive();
  
  if (dbActive) {
    try {
      await Match.create(matchData);
      console.log(`[db] Completed match ${matchData.matchId} persisted successfully.`);
    } catch (err) {
      console.error(`[db] Failed to save match ${matchData.matchId}:`, err.message);
    }
  } else {
    // Memory mode: append to local ledger
    inMemoryMatches.push({ ...matchData, date: new Date() });
    console.log(`[memory] Completed match ${matchData.matchId} stored locally. Total matches: ${inMemoryMatches.length}`);
  }
};

/**
 * Fetch matches where a specific player participated
 * 
 * @param {string} playerIdOrName — the unique playerId or player username
 * @returns {Promise<Array>} — sorted array of match objects
 */
const getPlayerMatches = async (playerIdOrName) => {
  if (!playerIdOrName) return [];
  
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      return await Match.find({
        $or: [
          { "players": playerIdOrName },
          { "rankings.playerId": playerIdOrName },
          { "rankings.username": playerIdOrName }
        ]
      }).sort({ date: -1 }).lean();
    } catch (err) {
      console.error(`[db] Failed to fetch matches for ${playerIdOrName}:`, err.message);
    }
  }

  // Memory mode: filter local ledger
  return inMemoryMatches
    .filter(m => 
      m.players.includes(playerIdOrName) || 
      m.rankings.some(r => r.playerId === playerIdOrName || r.username === playerIdOrName)
    )
    .sort((a, b) => b.date - a.date);
};

module.exports = {
  Match,
  saveMatch,
  getPlayerMatches
};
