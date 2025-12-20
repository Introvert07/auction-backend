const User = require('../models/User');
const Component = require('../models/Component');

module.exports = (io) => {
  let timer;
  let timeLeft = 30;

  io.on('connection', (socket) => {
    console.log('User joined:', socket.id);

    // Handle New Bid
    socket.on('place_bid', async ({ username, componentId, bidAmount }) => {
      const component = await Component.findById(componentId);
      const user = await User.findOne({ username });

      if (bidAmount <= component.currentBid) return; // Ignore lower bids
      if (user.purse < bidAmount) return; // Insufficient funds

      component.currentBid = bidAmount;
      component.highestBidder = username;
      await component.save();

      // Broadcast to everyone
      io.emit('update_bid', {
        componentId,
        newBid: bidAmount,
        highestBidder: username
      });
    });

    socket.on('disconnect', () => console.log('User left'));
  });
};