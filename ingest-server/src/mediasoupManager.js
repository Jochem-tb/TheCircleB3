import mediasoup from 'mediasoup';
import config from './config.js';

let worker, router;
let transports = new Map(); // keyed by streamId

export async function startMediasoup() {
  worker = await mediasoup.createWorker(config.mediasoup.worker);
  router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
  console.log('✅ mediasoup started');
}

export function getRouter() {
  return router;
}

export async function createTransport(streamId) {
  const transport = await router.createWebRtcTransport({
    listenIps: config.mediasoup.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transports.set(streamId, transport);
  return transport;
}

export function getTransport(streamId) {
  return transports.get(streamId);
}
