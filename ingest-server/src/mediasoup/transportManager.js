import config from "../config/index.js";
import { getRouter } from "./routerManager.js";

const ingestTransports = new Map();
const viewerTransports = new Map();

export async function createIngestTransport(streamId = {}) {
    const router = getRouter(streamId);
    const transport = await router.createWebRtcTransport({
        listenIps: config.mediasoup.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: false,
        preferTcp: true,
        initialAvailableOutgoingBitrate: 1000000,
    });

    console.log(
        `[Ingest] Created transport for streamId ${streamId} (id=${transport.id})`
    );

    ingestTransports.set(streamId, transport);

    return transport;
}

export function getIngestTransport(streamId) {
    return ingestTransports.get(streamId);
}

export function removeIngestTransport(streamId) {
    const t = ingestTransports.get(streamId);
    if (t) {
        t.close();
        ingestTransports.delete(streamId);
    }
    console.log(`[Ingest] Removed transport for streamId ${streamId}`);
}

export async function createViewerTransport(viewerId, streamId) {
    const router = getRouter(streamId);
    const transport = await router.createWebRtcTransport({
        listenIps: config.mediasoup.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
    });
    console.log(
        `[Viewer] Created transport for viewerId ${viewerId} (id=${transport.id})`
    );
    viewerTransports.set(viewerId, transport);
    return transport;
}

export function getViewerTransport(viewerId) {
    return viewerTransports.get(viewerId);
}

export function removeViewerTransport(viewerId) {
    const t = viewerTransports.get(viewerId);
    if (t) {
        t.close();
        viewerTransports.delete(viewerId);
    }
    console.log(`[Viewer] Removed transport for viewerId ${viewerId}`);
}
