const fs = require("fs");
const path = require("path");

class Logger {
    constructor(logFilePath = "app.log") {
        this.logFilePath = path.resolve(logFilePath);
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        fs.appendFile(this.logFilePath, logEntry, (err) => {
            if (err) {
                console.error("Failed to write log:", err);
            }
        });
    }

    info(message) {
        this.log("info", message);
    }

    warn(message) {
        this.log("warn", message);
    }

    error(message) {
        this.log("error", message);
    }
}

module.exports = new Logger();
