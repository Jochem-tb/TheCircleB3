require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const getRawBody = require("raw-body");

const Log = require("./models/Log");
const hmacAuth = require("./middleware/hmacAuth");

const app = express();
app.use(cors());

// MongoDB verbinding
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// 🔁 Alleen raw body verwerken voor /log route
const rawBodyParser = (req, res, next) => {
  getRawBody(req, {
    length: req.headers["content-length"],
    limit: "1mb",
    encoding: true
  }, (err, string) => {
    if (err) return next(err);
    req.rawBody = string;

    try {
      req.body = JSON.parse(string);
    } catch (parseError) {
      return res.status(400).json({ error: "Invalid JSON in request body" });
    }

    next();
  });
};

// ✅ Test endpoint zonder raw-body
app.post("/test", express.json(), (req, res) => {
  console.log("✅ /test endpoint reached!");
  console.log("Body:", req.body);
  res.json({ status: "ok", received: req.body });
});

// ✅ Beveiligd log-endpoint
app.post("/log", rawBodyParser, hmacAuth, async (req, res) => {
  console.log("✔️ Binnen /log endpoint");
  console.log("Body ontvangen:", req.body);

  const { eventType, userId, sessionId, timestamp, metadata } = req.body;

  if (!eventType || !userId || !sessionId) {
    console.warn("⚠️ Missing required fields in /log:", req.body);
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const entry = new Log({ eventType, userId, sessionId, timestamp, metadata });
    await entry.save();

    console.debug(`📝 Logged event "${eventType}" for user "${userId}" in session "${sessionId}"`);
    res.json({ status: "logged" });
  } catch (err) {
    console.error("❌ Error saving log entry to MongoDB:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server
const PORT = process.env.PORT || 5200;
app.listen(PORT, () => {
  console.log(`🚀 Logging API listening on port ${PORT}`);
});