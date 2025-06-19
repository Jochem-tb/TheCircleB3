// File: ingest-server/src/viewers/viewerHandler.js
import { Server } from "socket.io";
import streamManager from "../streams/StreamManager.js";
import {
    createViewerTransport,
    getViewerTransport,
    removeViewerTransport,
} from "../mediasoup/transportManager.js";
import Viewer from "./Viewer.js";
import { getRouter, displayRouters } from "../mediasoup/routerManager.js";

export default function registerViewerHandlers(httpServer) {
    const io = new Server(httpServer, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
        console.log(`[connection] Viewer connected: ${socket.id}`);

        // 1️⃣ Send router RTP capabilities for this stream
        socket.on("getRouterRtpCapabilities", ({ streamId }, callback) => {
            const router = getRouter(streamId);
            console.log(
                `[getRouterRtpCapabilities] Viewer ${socket.id} requesting RTP capabilities for stream ${streamId}`
            );
            if (!router) return callback({ error: "Stream not found" });
            console.log(
                "📦 [getRouterRtpCapabilities] Consumer rtpParameters:",
                JSON.stringify(router.rtpCapabilities)
            );
            console.log(displayRouters());
            callback(router.rtpCapabilities);
        });

        // 2️⃣ Create recv transport for viewer
        socket.on("joinStream", async ({ streamId, rtpCapabilities }, cb) => {
            console.log(
                `[joinStream] Viewer ${socket.id} joining stream ${streamId}`
            );
            if (!streamManager.hasStream(streamId))
                return cb({ error: "Stream not found" });

            // Create a mediasoup transport for consuming
            const transport = await createViewerTransport(socket.id, streamId);
            console.log(
                `▶️ [joinStream]  transport ${transport.id} created for Socket.ID ${socket.id} `
            );
            // Store the viewer instance
            const viewer = new Viewer(socket.id, transport);
            console.log(
                `▶️ [joinStream] Viewer instance created for Socket.ID ${socket.id}`
            );
            streamManager.getStream(streamId).addViewer(socket.id, viewer);
            console.log(
                `▶️ [joinStream] Viewer ${
                    socket.id
                } added to stream ${streamId}, total viewers: ${
                    streamManager.getStream(streamId).viewers.size
                }`
            );

            // Return transport parameters to client
            cb({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        });

        // 3️⃣ Complete DTLS handshake
        socket.on(
            "connectTransport",
            async ({ transportId, dtlsParameters }, cb) => {
                console.log(
                    `[connectTransport] Viewer ${socket.id} connecting transport ${transportId}`
                );
                const transport = getViewerTransport(socket.id);
                console.log(
                    `▶️ [connectTransport] Transport found for Socket.ID ${socket.id}: ${transport.id}`
                );
                await transport.connect({ dtlsParameters });

                console.log(
                    `▶️ [connectTransport] Viewer ${socket.id} transport connected, dumping stats:`
                );

                const statsInterval = setInterval(async () => {
                    try {
                        const statsMap = await transport.getStats();
                        statsMap.forEach((stat) => {
                            // Print every stat entry
                            console.log("[SERVER STAT]", stat);
                        });
                    } catch (err) {
                        console.log("Error fetching transport stats", err);
                        clearInterval(statsInterval);
                    }
                }, 10000);

                cb("connected");
            }
        );

        // 4️⃣ Consume all existing producers
        socket.on("consume", async ({ streamId, rtpCapabilities }, cb) => {
            const stream = streamManager.getStream(streamId);
            const viewer = stream.viewers.get(socket.id);
            const recvTransport = getViewerTransport(socket.id);
            const consumerInfos = [];

            for (const producer of stream.producers.values()) {
                if (
                    !getRouter(streamId).canConsume({
                        producerId: producer.id,
                        rtpCapabilities,
                    })
                ) {
                    console.warn(
                        `Cannot consume producer ${producer.id} for viewer ${socket.id} - RTP capabilities mismatch`
                    );
                    continue;
                }

                const consumer = await recvTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                });

                // 🔧 Filter codecs (verwijder rtx)
                consumer.rtpParameters.codecs =
                    consumer.rtpParameters.codecs.filter(
                        (c) => !c.mimeType.includes("rtx")
                    );

                // 🔧 Strip 'rtx' veld uit encodings
                consumer.rtpParameters.encodings =
                    consumer.rtpParameters.encodings.map((e) => {
                        const { rtx, ...rest } = e;
                        return rest;
                    });

                await consumer.requestKeyFrame();
                console.log(`Requested keyframe for consumer ${consumer.id}`);

                console.log(
                    "🔍 Consumer RTP Parameters:",
                    consumer.rtpParameters
                );
                console.log(
                    "🧪 Producer RTP Parameters:",
                    producer.rtpParameters
                );

                console.log(
                    "Producer encodings:",
                    producer.rtpParameters.encodings
                );
                console.log(
                    "Consumer encodings:",
                    consumer.rtpParameters.encodings
                );

                viewer.consumers.set(consumer.id, consumer);
                consumerInfos.push({
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });

                // Request a keyframe immediately after creating the consumer
                await consumer.requestKeyFrame();
                console.log(`Requested keyframe for consumer ${consumer.id}`);
            }

            cb(consumerInfos);
        });

        // 5️⃣ Resume consumer on demand
        socket.on("resume", async ({ consumerId }, cb) => {
            console.log(
                `[resume] Viewer ${socket.id} resuming consumer ${consumerId}`
            );

            // Find and resume the consumer
            for (const stream of streamManager.streams.values()) {
                const viewer = stream.viewers.get(socket.id);
                console.log(
                    `▶️ [resume] Checking stream ${stream.id} for viewer ${socket.id}`
                );
                if (viewer && viewer.consumers.has(consumerId)) {
                    console.log(
                        `▶️ [resume] Found consumer ${consumerId} for viewer ${socket.id} i am going to RESUME IT NOW`
                    );
                    const consumer = viewer.consumers.get(consumerId);
                    console.log(`⏯️ About to resume consumer ${consumer.id}`);
                    await consumer.resume();
                    console.log(`▶️ Resumed consumer ${consumer.id}`);
                    break;
                }
            }
            cb();
        });

        socket.on("requestKeyFrame", async ({ consumerId }, cb) => {
            console.log(
                `[requestKeyFrame] Viewer ${socket.id} requested keyframe for consumer ${consumerId}`
            );
            // Find the right consumer and ask it for a keyframe
            for (const stream of streamManager.streams.values()) {
                console.log(
                    `▶️ [requestKeyFrame] Checking stream ${stream.id} for viewer ${socket.id}`
                );
                const viewer = stream.viewers.get(socket.id);
                console.log(
                    `▶️ [requestKeyFrame] Checking viewer ${socket.id} for consumer ${consumerId}`
                );
                if (viewer && viewer.consumers.has(consumerId)) {
                    const consumer = viewer.consumers.get(consumerId);
                    console.log(
                        `▶️ [requestKeyFrame] Found consumer ${consumerId} for viewer ${socket.id}`
                    );
                    try {
                        await consumer.requestKeyFrame();
                        cb({ success: true });
                    } catch (err) {
                        console.error(
                            `Error requesting keyframe on consumer ${consumerId}`,
                            err
                        );
                        cb({ error: err.message });
                    }
                    return;
                }
            }
            cb({ error: "Consumer not found" });
        });

        socket.on("debug", async ({ streamId, rtpCapabilities }) => {
            console.log(
                `[debug] Viewer ${socket.id} requesting debug info for stream ${streamId}`
            );
            const stream = streamManager.getStream(streamId);
            if (!stream) {
                console.error(`Stream ${streamId} not found`);
                return;
            }
            console.log(
                `▶️ [debug] Stream found: ${streamId}, Producers: ${[
                    ...stream.producers.keys(),
                ]}`
            );

            const router = getRouter(streamId);
            if (!router) {
                console.error(`Router for stream ${streamId} not found`);
                return;
            }

            const producers = stream.producers;
            for (const producer of producers.values()) {
                // console.log(
                //     `▶️ [debug] Producer ID: ${producer.id}, Kind: ${
                //         producer.kind
                //     }, RTP Parameters: ${JSON.stringify(
                //         producer.rtpParameters
                //     )}`
                // );
                const canConsume = router.canConsume({
                    producerId: producer.id,
                    rtpCapabilities: rtpCapabilities,
                });
                console.log("canConsume?", canConsume); // must be true
            }

            console.log(
                `▶️ [debug] Router RTP capabilities:`,
                JSON.stringify(router.rtpCapabilities)
            );
        });

        // 6️⃣ Handle disconnection
        socket.on("disconnect", () => {
            console.log(`Viewer disconnected: ${socket.id}`);
            for (const stream of streamManager.streams.values()) {
                if (stream.viewers.has(socket.id)) {
                    stream.removeViewer(socket.id);
                    removeViewerTransport(socket.id);
                }
            }
        });
    });
}
