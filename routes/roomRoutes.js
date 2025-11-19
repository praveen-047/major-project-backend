const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ========================
// Auth middleware (cookie-based)
// ========================
const authMiddleware = (req, res, next) => {
  // Try Authorization header OR cookie
  const token = req.headers["authorization"] || req.cookies?.jwt_token;
  if (!token) return res.status(401).json({ error_msg: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error_msg: "Invalid token" });
  }
};


// ========================
// Create Room
// ========================
router.post("/create", authMiddleware, async (req, res) => {
  const { roomId, password } = req.body;

  if (!roomId || !password) {
    return res.status(400).json({ error_msg: "Room ID and password are required" });
  }

  try {
    const existing = await Room.findOne({ roomId });
    if (existing) return res.status(400).json({ error_msg: "Room already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const room = new Room({ roomId, password: hashedPassword });
    await room.save();

    res.status(201).json({ 
      success_msg: "Room created successfully", 
      room: { roomId: room.roomId } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

// ========================
// Join Room
// ========================
router.post("/join", authMiddleware, async (req, res) => {
  const { roomId, password } = req.body;

  if (!roomId || !password) {
    return res.status(400).json({ error_msg: "Room ID and password are required" });
  }

  try {
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ error_msg: "Room not found" });

    const isMatch = await bcrypt.compare(password, room.password);
    if (!isMatch) return res.status(401).json({ error_msg: "Incorrect password" });

    res.status(200).json({ 
      success_msg: "Joined room successfully", 
      room: { roomId: room.roomId } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

module.exports = router;
