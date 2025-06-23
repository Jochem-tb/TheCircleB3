require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const getRawBody = require("raw-body");

const Log = require("./models/Log");
const hmacAuth = require("./middleware/hmacAuth");

const app = express();

const uri = process.env.MONGODB_URI;

// Middleware
app.use(cors());

// Lees raw body in en parse handmatig naar JSON
app.use((req, res, next) => {
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
});

// Connectie met MongoDB
mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// HMAC-beveiligd log-endpoint
app.post("/log", hmacAuth, async (req, res) => {
  console.debug("Received /log request:", req.body);

  const { eventType, userId, sessionId, timestamp, metadata } = req.body;

  if (!eventType || !userId || !sessionId) {
    console.warn("Missing required fields in /log:", req.body);
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const entry = new Log({ eventType, userId, sessionId, timestamp, metadata });
    await entry.save();

    console.debug(`Logged event "${eventType}" for user "${userId}" in session "${sessionId}"`);
    res.json({ status: "logged" });
  } catch (err) {
    console.error("Error saving log entry to MongoDB:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server
const PORT = process.env.PORT || 5200;
app.listen(PORT, () => {
  console.log(`Logging API listening on port ${PORT}`);
});