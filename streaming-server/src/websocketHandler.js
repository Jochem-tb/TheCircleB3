const WebSocket = require("ws");
const { Room } = require("./room");
const mediasoupWorker = require("./mediasoupWorker");
const { logEvent } = require("./logging/logger");
const { coinHandlerStart, coinHandlerStop } = require("./helpers");
const crypto = require('crypto')
const { getUserPublicKey } = require('./auth/publicKeyStore');
const rooms = new Map();
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
                        const { streamerId, kind, timestamp, rtpParameters, signature } = data;

                        // 1. Valideer aanwezigheid van vereiste velden
                        if (!streamerId || !kind || !timestamp || !rtpParameters || !signature) {
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Missing fields in produce message.",
                                })
                            );
                            return;
                        }

                        // 2. Herstel originele payloadstring
                        const payload = `${streamerId}|${kind}|${timestamp}|${JSON.stringify(rtpParameters)}`;

                        // 3. Haal public key op uit MongoDB
                        const publicKeyPem = await getUserPublicKey(streamerId);
                        console.log(`[DEBUG] Public key for ${streamerId}:`, publicKeyPem);

                        if (!publicKeyPem) {
                            console.warn(`⛔️ No public key found for streamer: ${streamerId}`);
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "No public key found for this streamer.",
                                })
                            );
                            return;
                        }

                        // 4. Verifieer de ondertekening
                        let isVerified = false;
                        try {
                            const publicKey = crypto.createPublicKey({
                                key: publicKeyPem,
                                format: "pem",
                            });

                            isVerified = crypto.verify(
                                "sha256",
                                Buffer.from(payload),
                                publicKey,
                                Buffer.from(signature, "base64")
                            );
                        } catch (err) {
                            console.error(`❌ Error verifying signature for ${streamerId}:`, err);
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Error verifying signature.",
                                })
                            );
                            return;
                        }

                        if (!isVerified) {
                            console.warn(`🔐 Invalid signature for produce by ${streamerId}`);
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Invalid signature for produce.",
                                })
                            );
                            return;
                        }

                        // 5. Produce de track

                        if (!room || !room.streamerTransport) {
                            ws.send(JSON.stringify({ type: "error", message: "No active stream room or transport." }));
                            return;
                        }

                        try {
                            const producer = await room.streamerTransport.produce({
                                kind,
                                rtpParameters,
                            });

                            room.streamerProducers.set(kind, producer);

                            console.log(`✅ Valid producer from ${streamerId}: ${kind}`);

                            ws.send(
                                JSON.stringify({
                                    type: "produced",
                                    id: producer.id,
                                    kind,
                                    callbackId: data.callbackId,
                                })
                            );
                        } catch (err) {
                            console.error(`❌ Failed to create producer for ${streamerId}:`, err);
                            ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Failed to create producer.",
                                })
                            );
                        }

                        break;
                    }
                    
                    case "create-viewer-transport": {
                        role = "viewer";
                        viewerId = data.viewerId;
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
