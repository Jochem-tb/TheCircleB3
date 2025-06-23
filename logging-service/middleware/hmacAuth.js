const crypto = require("crypto");

const SHARED_SECRET = process.env.HMAC_SECRET;

function hmacAuth(req, res, next) {
  const ts = req.get("X-Timestamp");
  const sig = req.get("X-Signature");

  if (!ts || !sig) {
    return res.status(400).json({ error: "Missing authentication headers" });
  }
  // 1. Timestamp validatie (±5 min)
  const now = Date.now();
  const then = Date.parse(ts);
  if (isNaN(then) || Math.abs(now - then) > 300000) {
    return res.status(401).json({ error: "Invalid or expired timestamp" });
  }

  // 2. Bereken verwachte HMAC
  const hmac = crypto.createHmac("sha256", SHARED_SECRET);
  const payload = ts + req.rawBody;
  hmac.update(payload);
  const expected = hmac.digest("hex");

  // 3. Vergelijk de HMAC
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex")
    );

    if (!match) {
      console.warn("❌ HMAC mismatch!", { expected, received: sig });
      return res.status(401).json({ error: "Signature mismatch" });
    }

    next(); // ✅ Authenticated
  } catch (err) {
    console.error("❌ Error comparing HMAC signatures:", err);
    return res.status(400).json({ error: "Invalid signature format" });
  }
}

module.exports = hmacAuth;