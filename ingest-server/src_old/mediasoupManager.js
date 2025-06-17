import mediasoup from "mediasoup";
import config from "./config.js";

let worker, router;
let transports = new Map();

export async function startMediasoup() {
  console.info("[mediasoup] Starting worker ...");
  worker = await mediasoup.createWorker(config.mediasoup.worker);
  router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
  console.info("[mediasoup] Worker and router initialized");
}

export function getRouter() {
  return router;
}

export async function createTransport(streamId) {
  console.info(`[mediasoup] Creating WebRTC transport (TCP only) for streamId ${streamId}`);
  // enforce TCP-only
  const transport = await router.createWebRtcTransport({
    listenIps: config.mediasoup.listenIps,
    enableUdp: false,
    enableTcp: true,
    preferUdp: false,
    initialAvailableOutgoingBitrate: 1000000
  });
  console.info(`[mediasoup] Transport created (id=${transport.id}) for streamId ${streamId}`);
  transports.set(streamId, transport);
  return transport;
}

export function getTransport(streamId) {
  return transports.get(streamId);
}
