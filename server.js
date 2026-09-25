const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
const Component = require('./models/Component');
const AuctionState = require('./models/AuctionState');
require('dotenv').config();

const app = express();

// ---------------------------------------------------------------------------
// CORS — allow the frontend origin in production, wildcard for local dev.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'https://fluxauction.vercel.app';

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.options('/*splat', cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN },
  // Increase ping timeout for flaky connections on phones
  pingTimeout: 30000,
  pingInterval: 10000,
});

connectDB();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_TIMER_SECONDS = 30;
const DEFAULT_BID_INCREMENT = 200000;
const DEFAULT_PURSE = 10000000; // 1 Crore
const BID_THROTTLE_MS = 500;   // stops rapid double-click / spam bids

// ---------------------------------------------------------------------------
// Simple in-memory mutex per room – prevents two simultaneous writes
// (e.g. two "finish_bid" or "force_sell" events arriving at the same instant)
// from stepping on each other. Only one async critical section runs per room
// at a time; the rest await in line.
// ---------------------------------------------------------------------------
const roomLocks = new Map();

function getRoomLock(token) {
  if (!roomLocks.has(token)) {
    roomLocks.set(token, Promise.resolve());
  }
  return roomLocks.get(token);
}

function withRoomLock(token, fn) {
  const prev = getRoomLock(token);
  const next = prev.then(() => fn()).catch((err) => {
    console.error(`[Room ${token}] lock-guarded error:`, err);
  });
  roomLocks.set(token, next);
  return next;
}

// ---------------------------------------------------------------------------
// Admin verification — server-side, not trust-the-client
// ---------------------------------------------------------------------------
async function verifyAdmin(userId, sessionToken) {
  if (!userId || !sessionToken) return false;
  const admin = await User.findById(userId).catch(() => null);
  return !!(admin && admin.isAdmin && admin.sessionToken === sessionToken);
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'Online',
    message: 'FLUX AUCTION API is running ⚡',
    version: '4.0.0',
  });
});

const techItems = [
  // Frontend
  { name: "React.js", basePrice: 500000 }, { name: "Next.js", basePrice: 500000 }, { name: "Three.js", basePrice: 500000 },
  { name: "Tailwind CSS", basePrice: 500000 }, { name: "Material UI", basePrice: 500000 }, { name: "GSAP", basePrice: 500000 },
  { name: "Redux", basePrice: 500000 }, { name: "Vite", basePrice: 500000 },
  // Backend
  { name: "Node.js", basePrice: 500000 }, { name: "Python FastAPI", basePrice: 500000 }, { name: "MongoDB", basePrice: 500000 },
  { name: "MySQL", basePrice: 500000 }, { name: "Firebase", basePrice: 500000 }, { name: "Redis", basePrice: 500000 },
  { name: "GraphQL", basePrice: 500000 }, { name: "Docker", basePrice: 500000 }, { name: "AWS", basePrice: 500000 },
  // AI/ML
  { name: "ChatGPT API", basePrice: 500000 }, { name: "Pandas", basePrice: 500000 }, { name: "TensorFlow", basePrice: 500000 },
  { name: "PyTorch", basePrice: 500000 }, { name: "OpenCV", basePrice: 500000 },
  // Mobile
  { name: "Flutter", basePrice: 500000 }, { name: "React Native", basePrice: 500000 }, { name: "Swift", basePrice: 500000 },
  { name: "Kotlin", basePrice: 500000 },
  // Hardware
  { name: "Raspberry Pi 5", basePrice: 500000 }, { name: "Arduino Uno", basePrice: 500000 }, { name: "ESP32", basePrice: 500000 },
  { name: "NVIDIA Jetson", basePrice: 500000 }, { name: "Servo Motor", basePrice: 500000 }
];

// ---------------------------------------------------------------------------
// Room setup / restart
// ---------------------------------------------------------------------------
app.post('/api/room/setup', async (req, res) => {
  try {
    const { token, items, adminId } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    const sessionToken = token.toUpperCase().trim();

    if (!(await verifyAdmin(adminId, sessionToken))) {
      return res.status(403).json({ error: 'Only the room admin can set up or restart this room.' });
    }

    await withRoomLock(sessionToken, async () => {
      // Wipe old data for this room
      await Component.deleteMany({ sessionToken });
      await AuctionState.deleteMany({ sessionToken });
      await User.updateMany(
        { sessionToken, isAdmin: { $ne: true } },
        { $set: { purse: DEFAULT_PURSE, squad: [] } }
      );

      // Use provided items or fallback to default techItems
      const itemsToUse = (Array.isArray(items) && items.length > 0) ? items : techItems;

      const docs = itemsToUse
        .map((it, idx) => ({
          sessionToken,
          name: String(it.name || '').trim(),
          basePrice: Number(it.basePrice) || 0,
          order: idx,
        }))
        .filter((d) => d.name.length > 0);

      if (docs.length === 0) {
        return res.status(400).json({ error: 'No valid items provided.' });
      }

      await Component.insertMany(docs);
      clearRoomTimer(sessionToken);

      // Broadcast to everyone in the room
      io.to(sessionToken).emit('room_reset');

      res.status(200).json({ ok: true, count: docs.length });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Room setup failed.' });
  }
});

// ---------------------------------------------------------------------------
// Join / create team
// ---------------------------------------------------------------------------
app.post('/api/join', async (req, res) => {
  try {
    const { name, token } = req.body;
    if (!token || !name) {
      return res.status(400).json({ error: 'Name and token are required' });
    }

    const sessionToken = token.toUpperCase().trim();
    const teamName = name.toUpperCase().trim();

    if (!teamName || teamName.length < 1 || teamName.length > 30) {
      return res.status(400).json({ error: 'Team name must be 1-30 characters' });
    }

    const isAdmin = teamName === 'ADMIN';

    let user = await User.findOne({ name: teamName, sessionToken });
    if (!user) {
      try {
        user = await User.create({
          name: teamName,
          sessionToken,
          purse: DEFAULT_PURSE,
          squad: [],
          isAdmin,
        });
      } catch (e) {
        // Duplicate key — two tabs hit "join" at the same instant
        if (e.code === 11000) {
          user = await User.findOne({ name: teamName, sessionToken });
        } else throw e;
      }
    }

    // Notify all connected clients that a new team joined
    if (!isAdmin) {
      io.to(sessionToken).emit('team_joined', {
        _id: user._id,
        name: user.name,
        purse: user.purse,
      });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Join failed. Try again.' });
  }
});

// ---------------------------------------------------------------------------
// Fetch items scoped to this room
// ---------------------------------------------------------------------------
app.get('/api/components/:token', async (req, res) => {
  try {
    const sessionToken = req.params.token.toUpperCase().trim();
    const items = await Component.find({ sessionToken }).sort({ order: 1, createdAt: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load items' });
  }
});

// ---------------------------------------------------------------------------
// Leaderboard scoped to this room
// ---------------------------------------------------------------------------
app.get('/api/leaderboard/:token', async (req, res) => {
  try {
    const sessionToken = req.params.token.toUpperCase().trim();
    const users = await User.find({ sessionToken, isAdmin: { $ne: true } }).sort({ purse: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ---------------------------------------------------------------------------
// Per-socket bid throttle (prevents double-click / spam)
// ---------------------------------------------------------------------------
const lastBidAt = new Map();

// ---------------------------------------------------------------------------
// Per-room auto-resolve timers
// ---------------------------------------------------------------------------
const roomTimers = new Map();

function clearRoomTimer(sessionToken) {
  const handle = roomTimers.get(sessionToken);
  if (handle) {
    clearTimeout(handle);
    roomTimers.delete(sessionToken);
  }
}

// ---------------------------------------------------------------------------
// Shared "sell to highest bidder" logic
// Uses findOneAndUpdate with isSold:false filter to prevent double-sell
// ---------------------------------------------------------------------------
async function sellToHighestBidder(sessionToken, componentId) {
  // Atomically mark as sold only if not already sold
  const component = await Component.findOneAndUpdate(
    { _id: componentId, sessionToken, isSold: false },
    { isSold: true },
    { new: true }
  );

  if (!component || !component.highestBidder) {
    // Already sold or no bidder — nothing to do
    if (component && !component.highestBidder) {
      // Revert the isSold flag since there's no winner
      await Component.findByIdAndUpdate(componentId, { isSold: false });
    }
    return false;
  }

  const winner = await User.findById(component.highestBidder);
  if (!winner) return false;

  // Deduct purse and add to squad atomically
  await User.findByIdAndUpdate(winner._id, {
    $inc: { purse: -component.currentBid },
    $addToSet: { squad: component._id },
  });

  // Clear the active item
  await AuctionState.findOneAndUpdate(
    { sessionToken },
    { activeItemId: null, timerEndsAt: null }
  );

  io.to(sessionToken).emit('item_sold', {
    componentId: String(component._id),
    winnerName: winner.name,
    winnerId: String(winner._id),
    itemName: component.name,
    price: component.currentBid,
  });

  return true;
}

async function skipCurrentItem(sessionToken) {
  await AuctionState.findOneAndUpdate(
    { sessionToken },
    { activeItemId: null, timerEndsAt: null }
  );
  io.to(sessionToken).emit('item_skipped');
}

function scheduleAutoResolve(sessionToken, componentId, ms) {
  clearRoomTimer(sessionToken);
  const handle = setTimeout(() => {
    withRoomLock(sessionToken, async () => {
      const component = await Component.findById(componentId);
      if (!component || component.isSold) return;
      if (component.highestBidder) {
        await sellToHighestBidder(sessionToken, componentId);
      } else {
        await skipCurrentItem(sessionToken);
      }
    });
  }, ms + 500); // 500ms grace period so last-second bids land
  roomTimers.set(sessionToken, handle);
}

// ---------------------------------------------------------------------------
// Socket.IO — real-time communication
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  // ---- Join Room ----
  socket.on('join_room', async (token) => {
    if (!token) return;
    const sessionToken = String(token).toUpperCase().trim();
    socket.join(sessionToken);
    socket.data.sessionToken = sessionToken;

    // Send current state to the connecting client
    try {
      const state = await AuctionState.findOne({ sessionToken });
      const activeComponent = state?.activeItemId
        ? await Component.findById(state.activeItemId)
        : null;

      socket.emit('sync_state', {
        activeItemId: state?.activeItemId || null,
        bidIncrement: state?.bidIncrement || DEFAULT_BID_INCREMENT,
        timerEndsAt: state?.timerEndsAt || null,
        activeComponent: activeComponent || null,
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Start Item Auction ----
  socket.on('start_item_auction', async ({ id, sessionToken, timerSeconds, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      await withRoomLock(token, async () => {
        // Check no other item is already live
        const existingState = await AuctionState.findOne({ sessionToken: token });
        if (existingState?.activeItemId) {
          socket.emit('bid_rejected', { reason: 'Another item is already live. Finish it first.' });
          return;
        }

        const component = await Component.findOne({ _id: id, sessionToken: token });
        if (!component || component.isSold) {
          socket.emit('bid_rejected', { reason: 'Item not found or already sold.' });
          return;
        }

        // Reset the component's bid state for a fresh auction
        component.currentBid = 0;
        component.highestBidder = null;
        component.highestBidderName = '';
        await component.save();

        await AuctionState.findOneAndUpdate(
          { sessionToken: token },
          { activeItemId: id, timerEndsAt: null },
          { upsert: true }
        );

        io.to(token).emit('new_item_live', {
          itemId: id,
          basePrice: component.basePrice,
          itemName: component.name,
        });
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Place Bid ----
  socket.on('place_bid', async ({ userId, componentId, bidAmount, sessionToken }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();

      // Throttle check — prevents rapid double-clicks
      const now = Date.now();
      const last = lastBidAt.get(socket.id) || 0;
      if (now - last < BID_THROTTLE_MS) {
        return socket.emit('bid_rejected', { reason: 'Too fast! Wait a moment.' });
      }
      lastBidAt.set(socket.id, now);

      const [user, state] = await Promise.all([
        User.findById(userId),
        AuctionState.findOne({ sessionToken: token }),
      ]);

      if (!user || user.sessionToken !== token) {
        return socket.emit('bid_rejected', { reason: 'Invalid user for this room.' });
      }

      if (!state || String(state.activeItemId) !== String(componentId)) {
        return socket.emit('bid_rejected', { reason: 'This item is not currently live.' });
      }

      if (user.purse < bidAmount) {
        return socket.emit('bid_rejected', { reason: 'Insufficient budget.' });
      }

      if (bidAmount <= 0) {
        return socket.emit('bid_rejected', { reason: 'Invalid bid amount.' });
      }

      // ATOMIC UPDATE — only succeeds if currentBid is still < bidAmount
      // This is the core race-condition fix: the DB itself is the arbiter.
      const component = await Component.findOneAndUpdate(
        {
          _id: componentId,
          sessionToken: token,
          isSold: false,
          currentBid: { $lt: bidAmount },
        },
        {
          currentBid: bidAmount,
          highestBidder: userId,
          highestBidderName: user.name,
        },
        { new: true }
      );

      if (!component) {
        return socket.emit('bid_rejected', { reason: 'Someone beat you — bid higher!' });
      }

      // Broadcast to everyone in the room
      io.to(token).emit('bid_updated', {
        componentId,
        currentBid: component.currentBid,
        highestBidderName: component.highestBidderName,
        highestBidderId: String(component.highestBidder),
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Finish Bid (Mark Sold) ----
  socket.on('finish_bid', async ({ componentId, sessionToken, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      await withRoomLock(token, async () => {
        clearRoomTimer(token);
        const success = await sellToHighestBidder(token, componentId);
        if (!success) {
          socket.emit('bid_rejected', { reason: 'No bidder on this item, or already sold.' });
        }
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Force Sell ----
  socket.on('force_sell', async ({ sessionToken, componentId, winnerUserId, price, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) {
        return socket.emit('bid_rejected', { reason: 'Only the admin can do that.' });
      }

      await withRoomLock(token, async () => {
        // Atomically mark as sold
        const component = await Component.findOneAndUpdate(
          { _id: componentId, sessionToken: token, isSold: false },
          { isSold: true },
          { new: true }
        );

        if (!component) {
          return socket.emit('bid_rejected', { reason: 'Item not available (already sold or not found).' });
        }

        const winner = await User.findOne({ _id: winnerUserId, sessionToken: token });
        if (!winner) {
          // Revert
          await Component.findByIdAndUpdate(componentId, { isSold: false });
          return socket.emit('bid_rejected', { reason: 'Team not found in this room.' });
        }

        const finalPrice = Number(price) || component.currentBid || component.basePrice || 0;

        // Update component with winner info
        component.currentBid = finalPrice;
        component.highestBidder = winner._id;
        component.highestBidderName = winner.name;
        await component.save();

        // Deduct purse and add to squad
        await User.findByIdAndUpdate(winner._id, {
          $inc: { purse: -finalPrice },
          $addToSet: { squad: component._id },
        });

        // If this was the currently-live item, close it properly
        const state = await AuctionState.findOne({ sessionToken: token });
        if (state && String(state.activeItemId) === String(componentId)) {
          clearRoomTimer(token);
          await AuctionState.findOneAndUpdate(
            { sessionToken: token },
            { activeItemId: null, timerEndsAt: null }
          );
        }

        io.to(token).emit('item_sold', {
          componentId: String(component._id),
          winnerName: winner.name,
          winnerId: String(winner._id),
          itemName: component.name,
          price: finalPrice,
        });
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Skip Item ----
  socket.on('skip_item', async ({ sessionToken, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      await withRoomLock(token, async () => {
        clearRoomTimer(token);

        // Reset the active item's bid state so it can be re-auctioned
        const state = await AuctionState.findOne({ sessionToken: token });
        if (state?.activeItemId) {
          await Component.findByIdAndUpdate(state.activeItemId, {
            currentBid: 0,
            highestBidder: null,
            highestBidderName: '',
          });
        }

        await skipCurrentItem(token);
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Set Bid Increment ----
  socket.on('set_bid_increment', async ({ sessionToken, amount, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      const value = Math.max(1000, Number(amount) || DEFAULT_BID_INCREMENT);
      await AuctionState.findOneAndUpdate(
        { sessionToken: token },
        { bidIncrement: value },
        { upsert: true }
      );
      io.to(token).emit('increment_updated', value);
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Pause/Resume Timer ----
  socket.on('pause_timer', async ({ sessionToken, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      clearRoomTimer(token);
      const state = await AuctionState.findOne({ sessionToken: token });
      if (!state?.timerEndsAt) return;

      const remaining = Math.max(0, new Date(state.timerEndsAt).getTime() - Date.now());
      await AuctionState.findOneAndUpdate(
        { sessionToken: token },
        { timerEndsAt: null, $set: { pausedTimeRemaining: remaining } }
      );

      io.to(token).emit('timer_paused', { remaining });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('resume_timer', async ({ sessionToken, adminId }) => {
    try {
      const token = String(sessionToken).toUpperCase().trim();
      if (!(await verifyAdmin(adminId, token))) return;

      const state = await AuctionState.findOne({ sessionToken: token });
      if (!state?.activeItemId || !state.pausedTimeRemaining) return;

      const timerEndsAt = new Date(Date.now() + state.pausedTimeRemaining);
      await AuctionState.findOneAndUpdate(
        { sessionToken: token },
        { timerEndsAt, $unset: { pausedTimeRemaining: 1 } }
      );

      scheduleAutoResolve(token, state.activeItemId, state.pausedTimeRemaining);
      io.to(token).emit('timer_resumed', { timerEndsAt });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- Cleanup on disconnect ----
  socket.on('disconnect', () => {
    lastBidAt.delete(socket.id);
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 FLUX AUCTION server running on port ${PORT}`)
);