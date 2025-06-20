require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

const Log      = require("./models/Log");
const hmacAuth = require("./middleware/hmacAuth");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1) Connectie met MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// 2) HMAC-beveiligd log-endpoint
app.post("/log", hmacAuth, async (req, res) => {
  console.debug("Received /log request:", req.body);

  const { eventType, userId, sessionId, timestamp, metadata } = req.body;

  // Basisvalidatie
  if (!eventType || !userId || !sessionId) {
    console.warn("Missing required fields in /log:", req.body);
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Opslaan in MongoDB
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

// 3) Server starten
const PORT = process.env.PORT || 5200;
app.listen(PORT, () => {
  console.log(`Logging API listening on port ${PORT}`);
});