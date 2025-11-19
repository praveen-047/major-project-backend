


// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const cookie = require("cookie");

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://major-project-frontend-cyan.vercel.app"
  ],
  credentials: true,
}));
app.options("/*", cors());


app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

// Models
const User = require("./models/User");

// --------------------------
// MONGO connection
// --------------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.error("❌ MongoDB Error:", err.message));

// create HTTP + socket.io server BEFORE mounting routes that need io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "https://major-project-frontend-cyan.vercel.app", methods: ["GET", "POST"], credentials: true },
});

// give other modules (routes) access to io by requiring a factory (see fileRoutes below)
const fileRoutes = require("./routes/fileRoutes")(io);
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/roomRoutes");

// mount routes
app.use("/api/files", fileRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// --------------------------
// Simple user list endpoint
// --------------------------
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// avatar update endpoint (unchanged from your original)
app.put("/api/avatar", async (req, res) => {
  try {
    const token = req.headers.authorization || req.cookies?.jwt_token;
    if (!token) return res.status(401).json({ error_msg: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error_msg: "Avatar is required" });

    const user = await User.findByIdAndUpdate(decoded.id, { avatar }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ error_msg: "User not found" });

    res.json({ success: true, avatar: user.avatar });
  } catch (err) {
    console.error("PUT /api/avatar error:", err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

// --------------------------
// SOCKET.IO: rooms + events (kept as your working logic)
// --------------------------
const rooms = {};
const getRoomUsers = (roomId) => Object.values(rooms[roomId] || {});

io.use((socket, next) => {
  try {
    let token = socket.handshake.auth?.token;
    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (cookieHeader) {
        const parsed = cookie.parse(cookieHeader || "");
        if (parsed?.jwt_token) token = parsed.jwt_token;
      }
    }
    if (!token) return next(new Error("Auth error: token missing"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.log("Socket auth failed:", err.message);
    next(new Error("Auth error: invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinRoom", async ({ roomId, avatar }) => {
    try {
      socket.roomId = roomId;
      const user = await User.findById(socket.userId).select("name avatar");
      if (!user) return;

      socket.join(roomId);
      if (!rooms[roomId]) rooms[roomId] = {};

      rooms[roomId][socket.userId] = {
        userId: socket.userId,
        username: user.name,
        avatar: avatar?.avatar || user.avatar,
        x: 100, y: 100,
        socketId: socket.id
      };

      socket.emit("currentPositions", rooms[roomId]);
      socket.to(roomId).emit("userJoined", rooms[roomId][socket.userId]);
      io.to(roomId).emit("onlineUsers", getRoomUsers(roomId));
    } catch (err) {
      console.error("joinRoom error:", err);
    }
  });

  socket.on("move", ({ roomId, x, y }) => {
    if (rooms[roomId] && rooms[roomId][socket.userId]) {
      rooms[roomId][socket.userId].x = x;
      rooms[roomId][socket.userId].y = y;
      socket.to(roomId).emit("userMoved", { userId: socket.userId, x, y });
    }
  });

  socket.on("video-toggle", ({ enabled }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("video-toggle", { userId: socket.userId, enabled });
  });

  socket.on("chat", ({ roomId, message }) => {
    socket.to(roomId).emit("chat", { from: socket.userId, message });
  });

  socket.on("signal", (msg = {}) => {
    try {
      const { to } = msg;
      const roomId = socket.roomId;
      const target = rooms[roomId]?.[to];
      if (target?.socketId) {
        io.to(target.socketId).emit("signal", { ...msg, from: socket.userId });
      }
    } catch (err) {
      console.error("signal err:", err);
    }
  });

  socket.on("disconnecting", () => {
    const joinedRooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    joinedRooms.forEach((roomId) => {
      if (rooms[roomId] && rooms[roomId][socket.userId]) {
        delete rooms[roomId][socket.userId];
        io.to(roomId).emit("userLeft", { userId: socket.userId });
        io.to(roomId).emit("onlineUsers", Object.values(rooms[roomId]));
      }
    });
    console.log("Disconnected:", socket.userId);
  });
});

// start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
