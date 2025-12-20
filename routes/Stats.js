const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find().populate('squad');
    res.json(users);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;