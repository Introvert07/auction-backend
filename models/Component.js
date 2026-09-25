const mongoose = require('mongoose');

// FIX: items are now scoped to a sessionToken (a "room"). Before, all rooms
// shared one global list of items/bids/sold-flags, so starting a new room
// (or restarting the same one) showed stale data from whatever room used
// it last. Every query now filters by sessionToken.
const ComponentSchema = new mongoose.Schema({
  sessionToken: { type: String, required: true, uppercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  basePrice: { type: Number, required: true, default: 0 },
  currentBid: { type: Number, default: 0 },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  highestBidderName: { type: String, default: '' }, // Critical for displaying names
  isSold: { type: Boolean, default: false },
  order: { type: Number, default: 0 } // controls the sequence items appear in
}, { timestamps: true });

ComponentSchema.index({ sessionToken: 1, isSold: 1 });
ComponentSchema.index({ sessionToken: 1, order: 1 });

module.exports = mongoose.model('Component', ComponentSchema);