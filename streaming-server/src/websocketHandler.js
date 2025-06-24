const WebSocket = require("ws");
const { Room } = require("./room");
const mediasoupWorker = require("./mediasoupWorker");
const { logEvent } = require("./logging/logger");
const { coinHandlerStart, coinHandlerStop } = require("./helpers");

const rooms = new Map();
const viewerStreams = new Map(); // Map<viewerId, Set<streamerId>>
module.exports.rooms = rooms;

module.exports.setupWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on("connection", (ws) => {
        console.log("New WebSocket connection established");

        let role, room, streamerId, viewerId;

        ws.on("message", async (msg) => {
            const data = JSON.parse(msg);

            try {
                switch (data.type) {
                    case "create-room": {
                        streamerId = data.streamerId;
                        role = "streamer";
                        room = new Room(streamerId);
                        room.router = await mediasoupWorker.createRouter();
                        room.viewers = new Map();
                        room.streamerProducers = new Map();
                        room.hasLoggedStart = false;
                        room.viewerCount = 0;

                        // Voeg updateViewerCount methode toe
                        room.updateViewerCount = (broadcastFn) => {
                            room.viewerCount = room.viewers.size;
                            const message = {
                                type: "follower-count-update",
                                count: room.viewerCount,
                            };
                            if (broadcastFn) broadcastFn(message);
                        };

                        rooms.set(streamerId, room);

                        // Notify all clients a new stream started
                        wss.clients.forEach((client) => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(
                                    JSON.stringify({
                                        type: "stream-started",
                                        streamerId: streamerId,
                                    })
                                );
                            }
                        });
                        ws.role = "streamer";
                        ws.streamerId = streamerId;
                        console.log(`Room created for streamer: ${streamerId}`);
                        ws.send(JSON.stringify({ type: "room-created" }));
                        break;
                    }

                    case "create-streamer-transport": {
                        if (!room?.router) return;
                        const transport =
                            await room.router.createWebRtcTransport({
                                listenIps: [
                                    { ip: "127.0.0.1", announcedIp: null },
                                ],
                                enableUdp: true,
                                enableTcp: true,
                                preferUdp: true,
                            });
                        room.streamerTransport = transport;
                        console.log(
                            `Streamer transport created for ${streamerId}`
                        );
                        ws.send(
                            JSON.stringify({
                                type: "streamer-transport-created",
                                params: {
                                    id: transport.id,
                                    iceParameters: transport.iceParameters,
                                    iceCandidates: transport.iceCandidates,
                                    dtlsParameters: transport.dtlsParameters,
                                },
                            })
                        );
                        break;
                    }

                    case "get-router-rtp-capabilities": {
                        room = rooms.get(data.streamerId);
                        if (!room?.router) return;
                        ws.send(
                            JSON.stringify({
                                type: "router-rtp-capabilities",
                                data: room.router.rtpCapabilities,
                            })
                        );
                        break;
                    }

                    case "connect-streamer-transport": {
                        if (!room?.streamerTransport) return;
                        await room.streamerTransport.connect({
                            dtlsParameters: data.dtlsParameters,
                        });
                        console.log(
                            `Streamer transport connected for ${streamerId}`
                        );
                        ws.send(
                            JSON.stringify({
                                type: "streamer-transport-connected",
                            })
                        );
                        break;
                    }

                    case "produce": {
                        if (!room?.streamerTransport) return;

                        const producer = await room.streamerTransport.produce({
                            kind: data.kind,
                            rtpParameters: data.rtpParameters,
                        });

                        room.streamerProducers.set(data.kind, producer);
                        console.log(
                            `Streamer ${streamerId} produced: ${data.kind}`
                        );

                        if (!room.hasLoggedStart) {
                            await logEvent({
                                eventType: "stream_start",
                                userId: streamerId,
                                sessionId: streamerId,
                                metadata: {
                                    kind: data.kind,
                                    ip: ws._socket?.remoteAddress,
                                },
                            });
                            room.hasLoggedStart = true;
                        }

                        ws.send(
                            JSON.stringify({
                                type: "produced",
                                id: producer.id,
                            })
                        );

                        if (data.kind === "video") {
                            console.log(
                                `Starting coin handler for ${streamerId}`
                            );
                            await coinHandlerStart(data.streamerId);
                        }

                        break;
                    }

                    case "create-viewer-transport": {
                        role = "viewer";
                        viewerId = data.viewerId;

                        viewerStreams;

                        if (!viewerStreams.has(viewerId)) {
                            viewerStreams.set(viewerId, new Set());
                        }

                        const viewerSet = viewerStreams.get(viewerId);
                        if (viewerSet.size >= 4) {
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message:
                                        "Viewer cannot watch more than 4 streams at the same time.",
                                })
                            );
                            return;
                        }
                        if (viewerSet.has(data.streamerId)) {
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Already watching this stream.",
                                })
                            );
                            return;
                        }
                        viewerSet.add(data.streamerId);

                        streamerId = data.streamerId;
                        room = rooms.get(data.streamerId);
                        if (!room?.router) return;

                        const transport =
                            await room.router.createWebRtcTransport({
                                listenIps: [
                                    { ip: "127.0.0.1", announcedIp: null },
                                ],
                                enableUdp: true,
                                enableTcp: true,
                                preferUdp: true,
                            });

                        room.viewers.set(viewerId, {
                            transport,
                            consumers: new Map(),
                            ws,
                        });
                        console.log(
                            `Viewer ${viewerId} connected to streamer ${data.streamerId}`
                        );

                        ws.role = "viewer";
                        ws.viewerId = viewerId;
                        ws.streamerId = streamerId;

                        ws.send(
                            JSON.stringify({
                                type: "viewer-transport-created",
                                params: {
                                    id: transport.id,
                                    iceParameters: transport.iceParameters,
                                    iceCandidates: transport.iceCandidates,
                                    dtlsParameters: transport.dtlsParameters,
                                },
                            })
                        );

                        room.updateViewerCount((msg) => {
                            const streamerWs = [...wss.clients].find(
                                (client) =>
                                    client.role === "streamer" &&
                                    client.streamerId === streamerId
                            );
                            if (streamerWs && streamerWs.readyState === 1) {
                                streamerWs.send(JSON.stringify(msg));
                            }
                        });

                        await logEvent({
                            eventType: "follow_start",
                            userId: viewerId,
                            sessionId: data.streamerId,
                            metadata: {
                                ip: ws._socket?.remoteAddress,
                            },
                        });

                        break;
                    }

                    case "connect-viewer-transport": {
                        if (!room || !room.viewers.has(data.viewerId)) return;
                        const viewer = room.viewers.get(data.viewerId);
                        await viewer.transport.connect({
                            dtlsParameters: data.dtlsParameters,
                        });
                        console.log(
                            `Viewer transport connected: ${data.viewerId}`
                        );
                        ws.send(
                            JSON.stringify({
                                type: "viewer-transport-connected",
                            })
                        );
                        break;
                    }

                    case "consume": {
                        if (!room || !room.viewers.has(data.viewerId)) return;
                        const producer = room.streamerProducers.get(data.kind);
                        if (!producer) return;

                        const viewer = room.viewers.get(data.viewerId);
                        const consumer = await viewer.transport.consume({
                            producerId: producer.id,
                            rtpCapabilities: data.rtpCapabilities,
                            paused: false,
                        });

                        viewer.consumers.set(data.kind, consumer);
                        console.log(
                            `Viewer ${data.viewerId} consuming ${data.kind}`
                        );

                        consumer.on("transportclose", () => {
                            console.log(
                                `Consumer transport closed (${data.kind})`
                            );
                        });

                        ws.send(
                            JSON.stringify({
                                type: "consumed",
                                params: {
                                    id: consumer.id,
                                    producerId: producer.id,
                                    kind: consumer.kind,
                                    rtpParameters: consumer.rtpParameters,
                                },
                            })
                        );

                        break;
                    }

                    case "get-follower-count": {
                        const room = rooms.get(data.streamerId);
                        const count = room?.viewers?.size || 0;
                        ws.send(
                            JSON.stringify({
                                type: "follower-count-update",
                                count,
                            })
                        );
                        break;
                    }

                    default:
                        console.log("Unknown message type:", data.type);
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        });

        ws.on("close", async () => {
            // let clients know stream is closed
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(
                        JSON.stringify({
                            type: "stream-stopped",
                            streamerId: streamerId,
                        })
                    );
                }
            });

            if (role === "streamer" && streamerId && room?.hasLoggedStart) {
                await logEvent({
                    eventType: "stream_stop",
                    userId: streamerId,
                    sessionId: streamerId,
                });

                console.log(
                    `Streamer '${streamerId}' disconnected and room removed`
                );
                coinHandlerStop(streamerId);
                rooms.delete(streamerId);
            } else if (role === "viewer" && viewerId) {
                if (streamerId) {
                    const room = rooms.get(streamerId);
                    if (room) {
                        room.viewers.delete(viewerId);

                        room.updateViewerCount((msg) => {
                            const streamerWs = [...wss.clients].find(
                                (client) =>
                                    client.role === "streamer" &&
                                    client.streamerId === streamerId
                            );
                            if (streamerWs && streamerWs.readyState === 1) {
                                streamerWs.send(JSON.stringify(msg));
                            }
                        });

                        await logEvent({
                            eventType: "follow_end",
                            userId: viewerId,
                            sessionId: streamerId,
                        });

                        const streams = viewerStreams.get(viewerId);
                        if (streams) {
                            streams.delete(streamerId);
                            if (streams.size === 0) {
                                viewerStreams.delete(viewerId);
                            }
                        }
                    }
                } else {
                    console.warn(
                        `⚠️ Cannot log follow_end: missing streamerId for viewer ${viewerId}`
                    );
                }

                console.log(`Viewer '${viewerId}' disconnected`);
            }
        });
    });
};
