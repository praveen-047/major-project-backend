
// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Middleware: try Authorization header or cookie
// const authMiddleware = (req, res, next) => {
//   const token = req.headers['authorization'] || req.cookies?.jwt_token;
//   if (!token) return res.status(401).json({ error_msg: "No token provided" });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.userId = decoded.id;
//     next();
//   } catch (err) {
//     return res.status(401).json({ error_msg: "Invalid token" });
//   }
// };

const authMiddleware = (req, res, next) => {
  // FIRST try cookie
  let token = req.cookies?.jwt_token;

  // THEN try Authorization header
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace("Bearer ", "");
  }

  if (!token) {
    return res.status(401).json({ error_msg: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error_msg: "Invalid token" });
  }
};


// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error_msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

// Signup (does NOT auto-login)
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error_msg: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ success_msg: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

// Login (sets httpOnly cookie)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error_msg: "Invalid email" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error_msg: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    // Set cookie (httpOnly, secure only on production)
    res.cookie("jwt_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
});


    // return user (no password)
    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    res.json({ success_msg: "Login successful", user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error_msg: "Server error" });
  }
});

module.exports = router;

