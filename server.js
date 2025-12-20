const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
const Component = require('./models/Component');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

connectDB();

// Add this at the top with your other routes
app.get('/', (req, res) => {
    res.status(200).send({
        status: "Online",
        message: "Auction API is running successfully!",
        version: "1.0.0"
    });
});

// --- API ---
app.post('/api/join', async (req, res) => {
    try {
        const { name, token } = req.body;
        const sessionToken = token.toUpperCase();
        let user = await User.findOne({ name: name.toUpperCase(), sessionToken });
        if (!user) {
            user = new User({ name: name.toUpperCase(), sessionToken, purse: 10000000, squad: [] });
            await user.save();
        }
        res.status(201).json(user);
    } catch (err) { res.status(500).json({ error: "Join Error" }); }
});

app.get('/api/components', async (req, res) => res.json(await Component.find()));

app.get('/api/leaderboard/:token', async (req, res) => {
    res.json(await User.find({ sessionToken: req.params.token.toUpperCase() }));
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    socket.on('join_room', (token) => socket.join(token.toUpperCase()));

    socket.on('start_item_auction', ({ id, sessionToken }) => {
        io.to(sessionToken.toUpperCase()).emit('new_item_live', id);
    });

    socket.on('place_bid', async ({ userId, componentId, bidAmount, sessionToken }) => {
        try {
            const component = await Component.findById(componentId);
            const user = await User.findById(userId);
            if (!user || !component || bidAmount <= component.currentBid || user.purse < bidAmount) return;

            component.currentBid = bidAmount;
            component.highestBidder = userId;
            component.highestBidderName = user.name; // Save name to DB
            await component.save();

            io.to(sessionToken.toUpperCase()).emit('bid_updated'); 
        } catch (err) { console.error(err); }
    });

    socket.on('finish_bid', async ({ componentId, sessionToken }) => {
        try {
            const component = await Component.findById(componentId);
            if (!component.highestBidder) return;

            const winner = await User.findById(component.highestBidder);
            // Deduct from Purse and Push to Squad
            winner.purse -= component.currentBid;
            winner.squad.push(componentId); 
            await winner.save();

            component.isSold = true;
            await component.save();

            io.to(sessionToken.toUpperCase()).emit('item_sold', {
                winnerName: winner.name,
                itemName: component.name
            });
        } catch (err) { console.error(err); }
    });

    socket.on('skip_item', ({ sessionToken }) => {
        io.to(sessionToken.toUpperCase()).emit('item_skipped');
    });
});
// server.js


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));