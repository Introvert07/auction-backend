const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sessionToken: { type: String, required: true },
  purse: { type: Number, default: 10000000 }, // 1 Crore
  squad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Component' }]
});

module.exports = mongoose.model('User', UserSchema);