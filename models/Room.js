// backend/models/Room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

module.exports = mongoose.model("Room", roomSchema);
