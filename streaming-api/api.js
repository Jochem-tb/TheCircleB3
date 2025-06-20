const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;

// Store active streamer list in memory (or use Redis/DB)
let activeStreamers = new Set();

app.use(cors());
app.use(express.json());

// Called from frontend or streaming server
app.post('/streams/start', (req, res) => {
  const { streamerId } = req.body;
  activeStreamers.add(streamerId);
  res.sendStatus(200);
});

app.post('/streams/stop', (req, res) => {
  const { streamerId } = req.body;
  activeStreamers.delete(streamerId);
  res.sendStatus(200);
});

app.get('/streams/active', (req, res) => {
  res.json(Array.from(activeStreamers));
});

app.listen(PORT, () => {
  console.log(`Streaming API running on http://localhost:${PORT}`);
});
