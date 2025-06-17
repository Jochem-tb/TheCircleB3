import config from "../config/index.js";
import { getRouter } from "./routerManager.js";

const ingestTransports = new Map();
const viewerTransports = new Map();

export async function createIngestTransport(streamId) {
    const router = getRouter(streamId);
    const transport = await router.createWebRtcTransport({
        listenIps: config.mediasoup.listenIps,
        enableUdp: false,
        enableTcp: true,
        preferUdp: false,
        initialAvailableOutgoingBitrate: 1000000,
    });
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
}
