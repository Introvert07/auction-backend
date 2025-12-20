// reset.js
const mongoose = require('mongoose');
const Component = require('./models/Component');
const User = require('./models/User');
require('dotenv').config();

const resetGame = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    
    // 1. Reset all items to unsold and 0 bids
    await Component.updateMany({}, {
        currentBid: 0,
        highestBidder: null,
        highestBidderName: "",
        isSold: false
    });

    // 2. Clear all users (optional - removes previous teams)
    await User.deleteMany({});

    console.log("✅ Database Reset! Ready for new Session.");
    process.exit();
};

resetGame();