const crypto = require("crypto");
const axios = require("axios");

const HMAC_SECRET = process.env.HMAC_SECRET;
const LOGGING_URL = process.env.LOGGING_URL; // Pas aan als logging-service elders draait

/**
 * Log een event via HMAC-beveiligde HTTP POST
 */
async function logEvent({ eventType, userId, sessionId, metadata = {} }) {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    eventType,
    userId,
    sessionId,
    timestamp,
    metadata
  });

  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(timestamp + body);
  const signature = hmac.digest("hex");

  try {
    const res = await axios.post(LOGGING_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature
      }
    });

    if (res.data?.status === "logged") {
      console.log(`[LOGGING] Logged ${eventType} for ${userId} in ${sessionId}`);
    } else {
      console.warn("[LOGGING] Unexpected response from logging-service:", res.data);
    }
  } catch (err) {
    console.error(`[LOGGING]  Failed to log event: ${eventType}`, err.message);
  }
}

module.exports = { logEvent };