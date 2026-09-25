const mongoose = require('mongoose');

const AuctionStateSchema = new mongoose.Schema({
  sessionToken: { type: String, required: true, unique: true, uppercase: true, trim: true },
  activeItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Component', default: null },
  bidIncrement: { type: Number, default: 200000 },
  timerEndsAt: { type: Date, default: null },
  pausedTimeRemaining: { type: Number, default: null },
});

module.exports = mongoose.model('AuctionState', AuctionStateSchema);