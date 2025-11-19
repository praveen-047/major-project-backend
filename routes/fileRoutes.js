// routes/fileRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const SharedFile = require("../models/SharedFile"); // small metadata collection

// Use memory storage so we get buffer and can write to GridFSBucket
const upload = multer({ storage: multer.memoryStorage() });

module.exports = (io) => {
  // helper to get GridFSBucket (ensure mongoose connected)
  const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "files" });

  // Upload endpoint
  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // Identify uploader from cookie or Authorization header (JWT)
      let token = req.headers.authorization || req.cookies?.jwt_token;
      let decoded = null;
      try { if (token) decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { /* ignore */ }

      const uploaderId = decoded?.id || "unknown";
      const fromName = req.body.fromName || "User";
      const roomId = req.body.roomId || "global";

      const bucket = getBucket();

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: {
          uploader: uploaderId,
          roomId,
          originalname: req.file.originalname,
          fromName
        }
      });

      uploadStream.end(req.file.buffer);

      uploadStream.on("finish", async () => {
        try {
          const fileId = uploadStream.id.toString();
          const fileUrl = `/api/files/${fileId}`;

          // store a lightweight metadata document for quick queries / admin UI
          try {
            await SharedFile.create({
              fileId,
              filename: req.file.originalname,
              contentType: req.file.mimetype,
              size: req.file.size,
              uploader: uploaderId,
              fromName,
              roomId,
              gridFsId: uploadStream.id
            });
          } catch (metaErr) {
            console.warn("Failed to save SharedFile meta:", metaErr);
          }

          // Broadcast to the room via socket.io (if available)
          try {
            if (io && roomId) {
              io.to(roomId).emit("file-shared", {
                fileId,
                fileName: req.file.originalname,
                mime: req.file.mimetype,
                size: req.file.size,
                fileUrl,
                fromId: uploaderId,
                fromName,
                roomId
              });
            }
          } catch (emitErr) {
            console.warn("file-shared emit failed:", emitErr);
          }

          return res.json({
            fileId,
            fileName: req.file.originalname,
            fileUrl,
            roomId,
            fromId: uploaderId
          });
        } catch (errFinish) {
          console.error("Upload finish error:", errFinish);
          return res.status(500).json({ error: "Upload error (finish)" });
        }
      });

      uploadStream.on("error", (err) => {
        console.error("uploadStream error:", err);
        return res.status(500).json({ error: "Upload failed" });
      });

    } catch (err) {
      console.error("Upload exception:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Download endpoint
  router.get("/:id", async (req, res) => {
    try {
      const bucket = getBucket();
      const fileId = new mongoose.Types.ObjectId(req.params.id);

      // find file metadata first
      const cursor = bucket.find({ _id: fileId });
      const files = await cursor.toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const fileMeta = files[0];
      res.setHeader("Content-Type", fileMeta.contentType || "application/octet-stream");
      // Optional: set content-disposition to force download with original filename:
      res.setHeader("Content-Disposition", `attachment; filename="${fileMeta.filename}"`);

      const downloadStream = bucket.openDownloadStream(fileId);
      downloadStream.on("error", (err) => {
        console.error("Download stream error:", err);
        return res.status(404).end();
      });
      downloadStream.pipe(res);
    } catch (err) {
      console.error("Download error:", err);
      return res.status(400).json({ error: "Invalid file id" });
    }
  });

  return router;
};
