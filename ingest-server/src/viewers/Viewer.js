export default class Viewer {
    constructor(id, transport) {
        this.id = id;
        this.transport = transport;
        this.consumers = new Map();
    }

    async consume(producerId, rtpCapabilities) {
        const consumer = await this.transport.consume({
            producerId,
            rtpCapabilities,
            paused: false,
        });
        this.consumers.set(consumer.id, consumer);
        return {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        };
    }

    close() {
        this.consumers.forEach((c) => c.close());
        this.transport.close();
    }
}
