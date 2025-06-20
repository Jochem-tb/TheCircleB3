const WebSocket = require('ws');
const { Room } = require('./room');
const mediasoupWorker = require('./mediasoupWorker');
const { coinHandlerStart } = require('./helpers');
const { coinHandlerStop } = require('./helpers');

// Store rooms globally for the WebSocket server
const rooms = new Map();

let coinInterval;

module.exports.rooms = rooms; // Export rooms for use in server.js

// Setup the WebSocket server and handle incoming connections
module.exports.setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    let role, room, streamerId, viewerId;

    ws.on('message', async (msg) => {
      const data = JSON.parse(msg);
      try {
        switch (data.type) {
          case 'create-room': {
            // Streamer is creating a new room
            streamerId = data.streamerId;
            role = 'streamer';
            room = new Room(streamerId);
            room.router = await mediasoupWorker.createRouter();
            rooms.set(streamerId, room);
            console.log(`Room created for streamer: ${streamerId}`);
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
              preferUdp: false,
              preferTCP: false, // Prioritize UDP
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
            room = rooms.get(data.streamerId);
            if (!room || !room.router) {
              console.warn(`No router for streamer ${data.streamerId}`);
              return;
            }
            ws.send(JSON.stringify({
              type: 'router-rtp-capabilities',
              data: room.router.rtpCapabilities // Send router RTP capabilities
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
              kind: data.kind,
              rtpParameters: data.rtpParameters
            });
            room.streamerProducers.set(data.kind, producer);
            console.log(`Streamer ${streamerId} produced: ${data.kind}`);
            ws.send(JSON.stringify({ type: 'produced', id: producer.id }));
            coinHandlerStart()
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

          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', () => {
      // Handle WebSocket closure
      if (role === 'streamer' && streamerId) {
        console.log(`Streamer '${streamerId}' disconnected and room removed`); // Log when streamer disconnects
        rooms.delete(streamerId); // Remove the room from rooms map
        coinHandlerStop()
      } else if (role === 'viewer' && viewerId) {
        console.log(`Viewer '${viewerId}' disconnected`); // Log when viewer disconnects
      }
    });
  });
};