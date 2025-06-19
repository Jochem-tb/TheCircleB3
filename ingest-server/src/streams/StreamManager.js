// File: ingest-server/src/streams/StreamManager.js
import Stream from "./Stream.js";
import { createRouter, removeRouter } from "../mediasoup/routerManager.js";
import { removeIngestTransport } from "../mediasoup/transportManager.js";

class StreamManager {
    constructor() {
        this.streams = new Map();
    }
    
    async createStream(id) {
        await createRouter(id);
        const streamObject = new Stream(id);
        this.streams.set(id, streamObject);
        return streamObject;
    }
    getStream(id) {
        return this.streams.get(id);
    }
    hasStream(id) {
        return this.streams.has(id);
    }
    removeStream(id) {
        const streamObject = this.streams.get(id);
        if (streamObject) {
            streamObject.close();
            removeRouter(id);
            removeIngestTransport(id);
            this.streams.delete(id);
        }
    }
}
export default new StreamManager();
