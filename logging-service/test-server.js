const express = require("express");
const app = express();

app.use(express.json());

app.post("/test", (req, res) => {
  console.log("✅ /test route hit");
  res.json({ status: "ok", body: req.body });
});

app.listen(5200, () => {
  console.log("✅ Test server running on http://localhost:5200");
});