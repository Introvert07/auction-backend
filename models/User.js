const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, uppercase: true },
  sessionToken: { type: String, required: true, uppercase: true },
  purse: { type: Number, default: 10000000 }, // 1 Crore
  squad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Component' }],
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

// Prevents two people from racing to create duplicate team records
// with the same name in the same session.
UserSchema.index({ name: 1, sessionToken: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);