/**
 * backend/socket/feedbackModel.js
 * 
 * Persistent/in-memory storage for post-game match reviews.
 */

const mongoose = require('mongoose');
const { getIsDbActive } = require('./roomModel');
const fs = require('fs');
const path = require('path');

// 1. Feedback Schema definition for MongoDB
const FeedbackSchema = new mongoose.Schema({
  feedbackId: { type: String, unique: true, required: true },
  roomCode: { type: String, required: true },
  playerId: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String },
  rating: { type: Number, required: true, min: 1, max: 5 },
  category: { type: String, required: true },
  comment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);

// 2. In-Memory feedback fallback
const inMemoryFeedbacks = [];
const FALLBACK_FILE_PATH = path.join(__dirname, '..', 'feedback_fallback.json');

const loadMemoryFeedbackFromFile = () => {
  try {
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const raw = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8');
      const data = JSON.parse(raw);
      inMemoryFeedbacks.length = 0; // Clear existing array
      inMemoryFeedbacks.push(...data);
      console.log(`[memory] Loaded ${data.length} feedback records from persistent fallback file.`);
    }
  } catch (err) {
    console.error("[memory] Failed to load persistent fallback feedbacks:", err.message);
  }
};

const saveMemoryFeedbackToFile = () => {
  try {
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(inMemoryFeedbacks, null, 2), 'utf8');
    console.log(`[memory] Saved ${inMemoryFeedbacks.length} feedback records to persistent fallback file.`);
  } catch (err) {
    console.error("[memory] Failed to save persistent fallback feedbacks:", err.message);
  }
};

// Initialize by loading from fallback file
loadMemoryFeedbackFromFile();

/**
 * Add a new feedback submission
 */
const addFeedback = async (feedbackData) => {
  const { roomCode, playerId, username, email, rating, category, comment } = feedbackData;
  const feedbackId = `feedback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  
  const record = {
    feedbackId,
    roomCode: String(roomCode || 'UNKNOWN').toUpperCase(),
    playerId,
    username,
    email: email || '',
    rating: Math.max(1, Math.min(5, parseInt(rating) || 5)),
    category: category || 'General',
    comment: comment || '',
    createdAt: new Date()
  };

  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      const created = await Feedback.create(record);
      console.log(`[db] Registered feedback ${feedbackId} (Rating: ${rating})`);
      return created.toObject();
    } catch (err) {
      console.error(`[db] Failed to save feedback to MongoDB:`, err.message);
      // Fallback to memory on db failure
    }
  }

  // Fallback memory logic
  inMemoryFeedbacks.push(record);
  saveMemoryFeedbackToFile();
  console.log(`[memory] Registered feedback ${feedbackId} (Rating: ${rating})`);
  return record;
};

/**
 * Retrieve all feedback submissions
 */
const getAllFeedback = async () => {
  const dbActive = getIsDbActive();
  if (dbActive) {
    try {
      return await Feedback.find().sort({ createdAt: -1 }).lean();
    } catch (err) {
      console.error(`[db] Failed to query feedback list:`, err.message);
    }
  }

  // Fallback: sort in memory descending by date
  return [...inMemoryFeedbacks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

module.exports = {
  Feedback,
  addFeedback,
  getAllFeedback
};
