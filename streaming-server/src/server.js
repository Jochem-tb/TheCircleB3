const express = require('express');
require("dotenv").config();
const http = require('http');
const cors = require('cors');
const websocketHandler = require('./websocketHandler');
const mediasoupWorker = require('./mediasoupWorker');
const { printRoomList } = require('./helpers');
const { rooms } = require('./websocketHandler'); // Import for rooms map

// Initialize Express app with CORS setup
const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Allow all origins, change for production
}));

// Create the HTTP server and WebSocket server
const server = http.createServer(app);

// Start the Mediasoup worker for media routing
mediasoupWorker.startWorker();
console.log('Mediasoup worker started');

// Setup WebSocket server
websocketHandler.setupWebSocket(server);
console.log('WebSocket server is now listening for connections');

// Add route for getting all streamers
app.get('/streams', (req, res) => {
  const activeStreams = Array.from(rooms.entries())
    .filter(([_, room]) => room.streamerProducers.size > 0)
    .map(([streamerId]) => ({ streamerId }));

  console.log(`Active streams: ${activeStreams.length}`);

  res.json(activeStreams);
});

// Start the server and log the success
server.listen(3002, () => {
  console.log('Mediasoup streaming server listening on http://localhost:3002');
});
