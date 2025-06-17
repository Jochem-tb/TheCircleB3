import { Server } from "socket.io";
import streamManager from "../streams/StreamManager.js";
import {
    createViewerTransport,
    getViewerTransport,
    removeViewerTransport,
} from "../mediasoup/transportManager.js";
import Viewer from "./Viewer.js";

export default function registerViewerHandlers(httpServer) {
    const io = new Server(httpServer, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
        socket.on(
            "joinStream",
            async ({ streamId, rtpCapabilities }, callback) => {
                if (!streamManager.hasStream(streamId))
                    return callback({ error: "Stream not found" });
                const transport = await createViewerTransport(
                    socket.id,
                    streamId
                );
                const viewer = new Viewer(socket.id, transport);
                streamManager.getStream(streamId).addViewer(socket.id);

                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            }
        );

        socket.on(
            "connectTransport",
            async ({ transportId, dtlsParameters }, callback) => {
                const transport = getViewerTransport(socket.id);
                await transport.connect({ dtlsParameters });
                callback("connected");
            }
        );

        socket.on(
            "consume",
            async ({ streamId, rtpCapabilities }, callback) => {
                const stream = streamManager.getStream(streamId);
                const viewer = streamManager
                    .getStream(streamId)
                    .viewers.get(socket.id);
                const params = [];
                for (const prod of stream.producers.values()) {
                    if (
                        !streamManager
                            .getStream(streamId)
                            .producers.has(prod.id)
                    )
                        continue;
                    const p = await viewer.consume(prod.id, rtpCapabilities);
                    params.push(p);
                }
                callback(params);
            }
        );

        socket.on("disconnect", () => {
            // cleanup per-stream
            for (const [id, stream] of streamManager.streams) {
                if (stream.viewers.has(socket.id)) {
                    stream.removeViewer(socket.id);
                    removeViewerTransport(socket.id);
                }
            }
        });
    });
}
