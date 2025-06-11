require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB using URI from .env
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1); // Exit if no DB connection
    });

// Define a Mongoose schema & model for logs
const logSchema = new mongoose.Schema({
    level: { type: String, enum: ["info", "warn", "error"], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const Log = mongoose.model("Log", logSchema);

class Logger {
    async log(level, message) {
        try {
            const logEntry = new Log({ level, message });
            await logEntry.save();
            console.debug(
                `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
            ); // Also print to console
        } catch (err) {
            console.error("Failed to save log to MongoDB:", err);
        }
    }

    info(message) {
        return this.log("info", message);
    }

    warn(message) {
        return this.log("warn", message);
    }

    error(message) {
        return this.log("error", message);
    }
}

const logger = new Logger();

app.post("/log", async (req, res) => {
    console.debug("Received log request");
    const { level = "info", message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    if (!["info", "warn", "error"].includes(level)) {
        return res.status(400).json({ error: "Invalid log level" });
    }

    await logger[level](message);

    res.json({ status: "logged", level, message });
});

const PORT = process.env.PORT || 5200;
app.listen(PORT, () => {
    console.log(`Logging API listening on port ${PORT}`);
});
