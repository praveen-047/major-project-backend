// models/SharedFile.js
const mongoose = require("mongoose");

const SharedFileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  contentType: { type: String },
  size: { type: Number },
  uploader: { type: String, default: "unknown" }, // userId
  fromName: { type: String, default: "User" },
  roomId: { type: String, default: "global" },
  gridFsId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SharedFile", SharedFileSchema);
