const WebSocket = require('ws');
const { Room } = require('./room');
const mediasoupWorker = require('./mediasoupWorker');
const { logEvent } = require('./logging/logger');

const rooms = new Map();
module.exports.rooms = rooms;

module.exports.setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    let role, room, streamerId, viewerId;

    ws.on('message', async (msg) => {
      const data = JSON.parse(msg);

      try {
        switch (data.type) {
          case 'create-room': {
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
            if (!room?.router) return;
            const transport = await room.router.createWebRtcTransport({
              listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
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
            room = rooms.get(data.streamerId);
            if (!room?.router) return;
            ws.send(JSON.stringify({
              type: 'router-rtp-capabilities',
              data: room.router.rtpCapabilities
            }));
            break;
          }

          case 'connect-streamer-transport': {
            if (!room?.streamerTransport) return;
            await room.streamerTransport.connect({ dtlsParameters: data.dtlsParameters });
            console.log(`Streamer transport connected for ${streamerId}`);
            ws.send(JSON.stringify({ type: 'streamer-transport-connected' }));
            break;
          }

          case 'produce': {
            if (!room?.streamerTransport) return;

            const producer = await room.streamerTransport.produce({
              kind: data.kind,
              rtpParameters: data.rtpParameters
            });

            room.streamerProducers.set(data.kind, producer);
            console.log(`Streamer ${streamerId} produced: ${data.kind}`);

            if (!room.hasLoggedStart) {
              await logEvent({
                eventType: 'stream_start',
                userId: streamerId,
                sessionId: streamerId,
                metadata: {
                  kind: data.kind,
                  ip: ws._socket?.remoteAddress
                }
              });
              room.hasLoggedStart = true;
            }

            ws.send(JSON.stringify({ type: 'produced', id: producer.id }));
            break;
          }

          case 'create-viewer-transport': {
            role = 'viewer';
            viewerId = data.viewerId;
            streamerId = data.streamerId; 
            room = rooms.get(data.streamerId);
            if (!room?.router) return;

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

            await logEvent({
              eventType: "follow_start",
              userId: viewerId,
              sessionId: data.streamerId,
              metadata: {
                ip: ws._socket?.remoteAddress
              }
            });

            break;
          }

          case 'connect-viewer-transport': {
            if (!room || !room.viewers.has(data.viewerId)) return;
            const viewer = room.viewers.get(data.viewerId);
            await viewer.transport.connect({ dtlsParameters: data.dtlsParameters });
            console.log(`Viewer transport connected: ${data.viewerId}`);
            ws.send(JSON.stringify({ type: 'viewer-transport-connected' }));
            break;
          }

          case 'consume': {
            if (!room || !room.viewers.has(data.viewerId)) return;
            const producer = room.streamerProducers.get(data.kind);
            if (!producer) return;

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

    ws.on('close', async () => {
      if (role === 'streamer' && streamerId && room?.hasLoggedStart) {
        await logEvent({
          eventType: "stream_stop",
          userId: streamerId,
          sessionId: streamerId
        });
        console.log(`Streamer '${streamerId}' disconnected and room removed`);
        rooms.delete(streamerId);
      } else if (role === 'viewer' && viewerId) {
        if (streamerId) {
          await logEvent({
            eventType: "follow_end",
            userId: viewerId,
            sessionId: streamerId
          });
        } else {
              console.warn(`⚠️ Cannot log follow_end: missing streamerId for viewer ${viewerId}`);
        }
          console.log(`Viewer '${viewerId}' disconnected`);
      }
    });
  });
};