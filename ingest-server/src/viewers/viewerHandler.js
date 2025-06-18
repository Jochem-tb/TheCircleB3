import { Server } from "socket.io";
import streamManager from "../streams/StreamManager.js";
import {
    createViewerTransport,
    getViewerTransport,
    removeViewerTransport,
} from "../mediasoup/transportManager.js";
import Viewer from "./Viewer.js";
import { getRouter } from "../mediasoup/routerManager.js";

export default function registerViewerHandlers(httpServer) {
    const io = new Server(httpServer, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
        console.log(`Viewer connected: ${socket.id}`);
        socket.on("joinStream", async ({ streamId, rtpCapabilities }, cb) => {
            console.log(`Viewer ${socket.id} joining stream ${streamId}`);
            if (!streamManager.hasStream(streamId))
                return cb({ error: "Stream not found" });
            const transport = await createViewerTransport(socket.id, streamId);
            const viewer = new Viewer(socket.id, transport);
            streamManager.getStream(streamId).addViewer(socket.id, viewer);

            cb({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        });

        socket.on("getRouterRtpCapabilities", ({ streamId }, callback) => {
            const router = getRouter(streamId);
            if (!router) return callback({ error: "Stream not found" });
            callback(router.rtpCapabilities);
        });

        socket.on(
            "connectTransport",
            async ({ transportId, dtlsParameters }, cb) => {
                console.log(
                    `Viewer ${socket.id} connecting transport ${transportId}`
                );
                const transport = getViewerTransport(socket.id);
                await transport.connect({ dtlsParameters });
                cb("connected");
            }
        );

        socket.on("consume", async ({ streamId, rtpCapabilities }, cb) => {
            console.log(`Viewer ${socket.id} consuming stream ${streamId}`);
            const stream = streamManager.getStream(streamId);
            const viewer = stream.viewers.get(socket.id);
            const recvTransport = getViewerTransport(socket.id); // ✅ Use recv transport
            const infos = [];

            console.log(
                `Stream producers:`,
                Array.from(stream.producers.keys())
            );

            for (const producer of stream.producers.values()) {
                if (
                    !getRouter(streamId).canConsume({
                        producerId: producer.id,
                        rtpCapabilities,
                    })
                )
                    continue;

                const consumer = await recvTransport.consume({
                    // ✅ Correct transport
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: false,
                });

                viewer.consumers.set(consumer.id, consumer);

                infos.push({
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });
            }

            cb(infos);
        });

        socket.on("resume", async ({ consumerId }, cb) => {
            console.log(`Viewer ${socket.id} resuming consumer ${consumerId}`);
            // unpause the consumer so media flows
            for (const stream of streamManager.streams.values()) {
                const viewer = stream.viewers.get(socket.id);
                if (viewer?.consumers.has(consumerId)) {
                    await viewer.consumers.get(consumerId).resume();
                    break;
                }
            }
            cb();
        });

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
