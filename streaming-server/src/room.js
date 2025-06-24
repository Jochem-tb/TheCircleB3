class Room {
  constructor(streamerId) {
    this.streamerId = streamerId; // Streamer ID to uniquely identify the room
    this.router = null;            // Mediasoup router for handling media routing
    this.streamerTransport = null; // WebRTC transport for the streamer's media
    this.streamerProducers = new Map(); // Maps media type (audio/video) to their producers
    this.viewers = new Map();      // Maps viewer IDs to their transport and media consumers
    this.viewerCount = 0;
  }

  // Add a producer (video or audio) to the room
  addProducer(kind, producer) {
    if (this.streamerProducers.has(kind)) {
      console.warn(`Producer of kind '${kind}' already exists for this room`);
      return;
    }
    this.streamerProducers.set(kind, producer);
    console.log(`Producer of kind '${kind}' added for streamer ${this.streamerId}`);
  }

  // Remove a producer from the room
  removeProducer(kind) {
    if (!this.streamerProducers.has(kind)) {
      console.warn(`No producer of kind '${kind}' found for this room`);
      return;
    }
    this.streamerProducers.delete(kind);
    console.log(`Producer of kind '${kind}' removed for streamer ${this.streamerId}`);
  }

  // Add a viewer to the room
  addViewer(viewerId, transport) {
    if (this.viewers.has(viewerId)) {
      console.warn(`Viewer '${viewerId}' is already in the room`);
      return;
    }
    this.viewers.set(viewerId, { transport, consumers: new Map() });
    console.log(`Viewer '${viewerId}' added to the room for streamer ${this.streamerId}`);
  }

  // Remove a viewer from the room
  removeViewer(viewerId) {
    if (!this.viewers.has(viewerId)) {
      console.warn(`Viewer '${viewerId}' not found in the room`);
      return;
    }
    this.viewers.delete(viewerId);
    console.log(`Viewer '${viewerId}' removed from the room for streamer ${this.streamerId}`);
  }

  updateViewerCount(broadcastFn) {
    this.viewerCount = this.viewers.size;
    const message = {
      type: 'follower-count-update',
      count: this.viewerCount
    };
    if (broadcastFn) broadcastFn(message);
  }
}

module.exports.Room = Room;
