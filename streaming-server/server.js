const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');
const cors = require('cors');

// Initialize Express app with CORS setup
const app = express();
app.use(cors({
  origin: '*', // In production, replace '*' with the specific domain
}));

// Create the HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // Maps streamer ID to the associated room
let worker; // Mediasoup worker for media processing

// Start the Mediasoup worker for media routing
(async () => {
  worker = await mediasoup.createWorker();
  console.log('Mediasoup worker created');
})();

// Room class for managing streamers and their viewers
class Room {
  constructor(streamerId) {
    this.streamerId = streamerId;  // Store the streamer's ID
    this.router = null;             // Mediasoup router for handling media
    this.streamerTransport = null;  // WebRTC transport for streamer's media
    this.streamerProducers = new Map(); // Tracks producers (streamer's media)
    this.viewers = new Map();       // Tracks connected viewers
  }
}

// Route to list all active streams (i.e., rooms with active streamers)
app.get('/streams', (req, res) => {
  const activeStreams = Array.from(rooms.entries()) // Get all rooms
    .filter(([_, room]) => room.streamerProducers.size > 0) // Only include rooms with active producers
    .map(([streamerId]) => ({ streamerId })); // Extract streamer IDs
  res.json(activeStreams); // Send the list of active streams as a response
});

// WebSocket connection handling for streamers and viewers
wss.on('connection', async (ws) => {
  let role, room, streamerId, viewerId;

  console.log('New WebSocket connection established');

  // Handle incoming WebSocket messages (from streamers or viewers)
  ws.on('message', async (msg) => {
    const data = JSON.parse(msg); // Parse the incoming message

    switch (data.type) {
      case 'create-room': {
        // Streamer is creating a new room
        streamerId = data.streamerId;
        role = 'streamer';
        room = new Room(streamerId);
        room.router = await worker.createRouter({
          mediaCodecs: [
            { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }, // Video codec
            { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 } // Audio codec
          ]
        });
        rooms.set(streamerId, room); // Save the room for the streamer
        console.log(`Room created for streamer: ${streamerId}`);
        printRoomList();
        ws.send(JSON.stringify({ type: 'room-created' }));
        break;
      }

      case 'create-streamer-transport': {
        // Streamer is creating a transport for their media stream
        if (!room?.router) return;
        const transport = await room.router.createWebRtcTransport({
          listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true // Prioritize UDP for better streaming performance
        });
        room.streamerTransport = transport;
        console.log(`Streamer transport created for ${streamerId}`);
        ws.send(JSON.stringify({
          type: 'streamer-transport-created',
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        }));
        break;
      }

      case 'get-router-rtp-capabilities': {
        // Send the RTP capabilities of the router to the client
        const room = rooms.get(data.streamerId);
        if (!room || !room.router) {
          console.warn(`No router for streamer ${data.streamerId}`);
          return;
        }
        ws.send(JSON.stringify({
          type: 'router-rtp-capabilities',
          data: room.router.rtpCapabilities
        }));
        break;
      }

      case 'connect-streamer-transport': {
        // Streamer connects their WebRTC transport
        if (!room?.streamerTransport) return;
        await room.streamerTransport.connect({ dtlsParameters: data.dtlsParameters });
        console.log(`Streamer transport connected for ${streamerId}`);
        ws.send(JSON.stringify({ type: 'streamer-transport-connected' }));
        break;
      }

      case 'produce': {
        // Streamer is producing media (audio/video)
        if (!room?.streamerTransport) return;
        const producer = await room.streamerTransport.produce({
          kind: data.kind, // Audio or video
          rtpParameters: data.rtpParameters // RTP parameters for the stream
        });
        room.streamerProducers.set(data.kind, producer);
        console.log(`Streamer ${streamerId} produced: ${data.kind}`);
        ws.send(JSON.stringify({ type: 'produced', id: producer.id }));
        break;
      }

      case 'create-viewer-transport': {
        // Viewer is connecting to a stream
        role = 'viewer';
        viewerId = data.viewerId;
        room = rooms.get(data.streamerId);
        if (!room || !room.router) {
          console.warn(`Viewer tried to join unknown room: ${data.streamerId}`);
          return;
        }
        const transport = await room.router.createWebRtcTransport({
          listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true
        });
        room.viewers.set(viewerId, { transport, consumers: new Map() });
        console.log(`Viewer ${viewerId} connected to streamer ${data.streamerId}`);
        ws.send(JSON.stringify({
          type: 'viewer-transport-created',
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        }));
        break;
      }

      case 'connect-viewer-transport': {
        // Viewer connects their WebRTC transport
        if (!room || !room.viewers.has(data.viewerId)) return;
        const viewer = room.viewers.get(data.viewerId);
        await viewer.transport.connect({ dtlsParameters: data.dtlsParameters });
        console.log(`Viewer transport connected: ${data.viewerId}`);
        ws.send(JSON.stringify({ type: 'viewer-transport-connected' }));
        break;
      }

      case 'consume': {
        // Viewer starts consuming a media stream
        if (!room || !room.viewers.has(data.viewerId)) return;
        const producer = room.streamerProducers.get(data.kind);
        if (!producer) {
          console.warn(`No producer of kind '${data.kind}' for stream`);
          return;
        }

        const viewer = room.viewers.get(data.viewerId);
        const consumer = await viewer.transport.consume({
          producerId: producer.id,
          rtpCapabilities: data.rtpCapabilities,
          paused: false
        });

        viewer.consumers.set(data.kind, consumer);
        console.log(`Viewer ${data.viewerId} consuming ${data.kind}`);
        consumer.on('transportclose', () => {
          console.log(`Consumer transport closed (${data.kind})`);
        });

        ws.send(JSON.stringify({
          type: 'consumed',
          params: {
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          }
        }));
        break;
      }
    }
  });

  // Handle WebSocket closure
  ws.on('close', () => {
    if (role === 'streamer' && streamerId) {
      console.log(`Streamer '${streamerId}' disconnected and room removed`);
      rooms.delete(streamerId);
      printRoomList();
    } else if (role === 'viewer' && viewerId) {
      console.log(`Viewer '${viewerId}' disconnected`);
    }
  });
});

// Helper function to log active rooms (streamers)
function printRoomList() {
  const ids = Array.from(rooms.keys());
  console.log(`Current streamers: ${ids.length > 0 ? ids.join(', ') : '(none)'}`);
}

// Start the server and listen on port 3002
server.listen(3002, () => {
  console.log('Mediasoup streaming server listening on http://localhost:3002');
});
