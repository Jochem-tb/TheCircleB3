const crypto = require("crypto");

const SHARED_SECRET = process.env.HMAC_SECRET;  // zet in .env: HMAC_SECRET=eenHeelGeheim

/**
 * Middleware controleert:
 *  - X-Timestamp header binnen acceptabel venster (bv. ±5 min)
 *  - X-Signature HMAC_SHA256(timestamp + body) tegen header X-Signature
 */
function hmacAuth(req, res, next) {
  const ts = req.get("X-Timestamp");
  const sig = req.get("X-Signature");

  if (!ts || !sig) {
    return res.status(400).json({ error: "Missing authentication headers" });
  }

  // 1. Timestamp validatie (±300s)
  const now = Date.now();
  const then = Date.parse(ts);
  if (isNaN(then) || Math.abs(now - then) > 300000) {
    return res.status(401).json({ error: "Invalid or expired timestamp" });
  }

  // 2. Compute HMAC over ts + raw body
  const hmac = crypto.createHmac("sha256", SHARED_SECRET);
  const payload = ts + req.rawBody;
  hmac.update(payload);
  const expected = hmac.digest("hex");

  // 3. Compare signatures (gebruik constant-time compare in real productie)
  if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))) {
    return res.status(401).json({ error: "Signature mismatch" });
  }

  // Authenticated!
  next();
}

module.exports = hmacAuth;