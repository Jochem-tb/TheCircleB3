const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*', // change later, this is for development only
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();

let worker;
(async () => {
  worker = await mediasoup.createWorker();
  console.log('Mediasoup worker created');
})();

class Room {
  constructor(streamerId) {
    this.streamerId = streamerId;
    this.router = null;
    this.streamerTransport = null;
    this.streamerProducers = new Map();
    this.viewers = new Map();
  }
}

// Endpoint to get active streamers
app.get('/streams', (req, res) => {
  const activeStreams = Array.from(rooms.entries())
    .filter(([_, room]) => room.streamerProducers.size > 0)
    .map(([streamerId]) => ({ streamerId }));
  res.json(activeStreams);
});

wss.on('connection', async (ws) => {
  let role, room, streamerId, viewerId;

  console.log('New WebSocket connection established');

  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);

    switch (data.type) {
      case 'create-room': {
        // Creating a room for the streamer
        streamerId = data.streamerId;
        role = 'streamer';
        room = new Room(streamerId);
        room.router = await worker.createRouter({
          mediaCodecs: [
            { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
            { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 }
          ]
        });
        rooms.set(streamerId, room);
        console.log(`Room created for streamer: ${streamerId}`);
        printRoomList();
        ws.send(JSON.stringify({ type: 'room-created' }));
        break;
      }

      case 'create-streamer-transport': {
        // Creating transport for the streamer's WebRTC
        if (!room?.router) return;
        const transport = await room.router.createWebRtcTransport({
          listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true
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
        // Sending router RTP capabilities
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
        // Connecting the streamer's WebRTC transport
        if (!room?.streamerTransport) return;
        await room.streamerTransport.connect({ dtlsParameters: data.dtlsParameters });
        console.log(`Streamer transport connected for ${streamerId}`);
        ws.send(JSON.stringify({ type: 'streamer-transport-connected' }));
        break;
      }

      case 'produce': {
        // Producing a stream from the streamer
        if (!room?.streamerTransport) return;
        const producer = await room.streamerTransport.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters
        });
        room.streamerProducers.set(data.kind, producer);
        console.log(`Streamer ${streamerId} produced: ${data.kind}`);
        ws.send(JSON.stringify({ type: 'produced', id: producer.id }));
        break;
      }

      case 'create-viewer-transport': {
        // Creating transport for the viewer to connect to the stream
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

        console.log(`Viewer connected: ${viewerId} to streamer: ${data.streamerId}`);
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
        // Connecting the viewer's WebRTC transport
        if (!room || !room.viewers.has(data.viewerId)) return;
        const viewer = room.viewers.get(data.viewerId);
        await viewer.transport.connect({ dtlsParameters: data.dtlsParameters });
        console.log(`Viewer transport connected: ${data.viewerId}`);
        ws.send(JSON.stringify({ type: 'viewer-transport-connected' }));
        break;
      }

      case 'consume': {
        // The viewer consumes the stream produced by the streamer
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

  ws.on('close', () => {
    // Handle WebSocket closure and clean up rooms
    if (role === 'streamer' && streamerId) {
      console.log(`Streamer '${streamerId}' disconnected and room removed`);
      rooms.delete(streamerId);
      printRoomList();
    } else if (role === 'viewer' && viewerId) {
      console.log(`Viewer '${viewerId}' disconnected`);
    }
  });
});

function printRoomList() {
  // Print out the list of current streamers
  const ids = Array.from(rooms.keys());
  console.log(`Current streamers: ${ids.length > 0 ? ids.join(', ') : '(none)'}`);
}

server.listen(3002, () => {
  console.log('Mediasoup streaming server listening on http://localhost:3002');
});
