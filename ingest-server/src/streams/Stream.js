import { getRouter } from '../mediasoup/routerManager.js';

export default class Stream {
  constructor(id) {
    this.id = id;
    this.producers = new Map();
    this.viewers = new Map();
  }

  setProducer(producer) {
    this.producers.set(producer.id, producer);
  }

  addViewer(viewerId) {
    this.viewers.set(viewerId, new Map());
  }

  async consumeForViewer(viewerId, rtpCapabilities) {
    const transport = require('../mediasoup/transportManager.js').getViewerTransport(viewerId);
    const params = [];
    for (const prod of this.producers.values()) {
      if (!getRouter(this.id).canConsume({ producerId: prod.id, rtpCapabilities })) continue;
      const consumer = await transport.consume({ producerId: prod.id, rtpCapabilities, paused: false });
      this.viewers.get(viewerId).set(consumer.id, consumer);
      params.push({ id: consumer.id, producerId: prod.id, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
    }
    return params;
  }

  removeViewer(viewerId) {
    const consumers = this.viewers.get(viewerId);
    if (consumers) {
      for (const c of consumers.values()) c.close();
      this.viewers.delete(viewerId);
    }
  }

  close() {
    this.producers.forEach(p => p.close());
    this.viewers.forEach((_, viewerId) => require('../mediasoup/transportManager.js').removeViewerTransport(viewerId));
  }
}