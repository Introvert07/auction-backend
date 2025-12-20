const mongoose = require('mongoose');

const ComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  basePrice: { type: Number, required: true },
  currentBid: { type: Number, default: 0 },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  highestBidderName: { type: String, default: "" }, // Critical for displaying names
  isSold: { type: Boolean, default: false }
});

module.exports = mongoose.model('Component', ComponentSchema);