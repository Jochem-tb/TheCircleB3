// File: ingest-server/src/streams/Stream.js
import { getRouter } from "../mediasoup/routerManager.js";

export default class Stream {
    constructor(id) {
        this.id = id;
        this.producers = new Map();
        this.viewers = new Map();
        this._keyframesInterval = null;
    }

    setProducer(producer) {
        this.producers.set(producer.id, producer);
        if (this._keyframesInterval) {
            clearInterval(_keyframesInterval);
            this._keyframesInterval = setInterval(() => {
                this.producers.forEach((producer) => {
                    producer.requestKeyFrame();
                });
            }, 3000);
        }
    }

    addViewer(viewerId, viewerInstance) {
        this.viewers.set(viewerId, viewerInstance);
    }

    async consumeForViewer(viewerId, rtpCapabilities) {
        const transport =
            require("../mediasoup/transportManager.js").getViewerTransport(
                viewerId
            );
        const params = [];
        for (const prod of this.producers.values()) {
            if (
                !getRouter(this.id).canConsume({
                    producerId: prod.id,
                    rtpCapabilities,
                })
            )
                continue;
            const consumer = await transport.consume({
                producerId: prod.id,
                rtpCapabilities,
                paused: false,
            });
            this.viewers.get(viewerId).set(consumer.id, consumer);
            params.push({
                id: consumer.id,
                producerId: prod.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });
        }
        return params;
    }

    removeViewer(viewerId) {
        const consumer = this.viewers.get(viewerId);
        if (consumer) {
            consumer.close();
            this.viewers.delete(viewerId);
        }
    }

    close() {
        this._keyframesInterval = null;
        this.producers.forEach((p) => p.close());
        this.viewers.forEach((_, viewerId) =>
            require("../mediasoup/transportManager.js").removeViewerTransport(
                viewerId
            )
        );
    }
}
