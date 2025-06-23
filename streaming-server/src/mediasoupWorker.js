const mediasoup = require('mediasoup');

let worker;
let router;

// Start the Mediasoup worker (creates the Mediasoup process)
module.exports.startWorker = async () => {
  try {
    // Create the Mediasoup worker
    worker = await mediasoup.createWorker();
    console.log('Mediasoup worker created'); // Log when the worker is successfully created
  } catch (error) {
    console.error('Error creating Mediasoup worker:', error);
  }
};

// Stop the Mediasoup worker (closes the worker and its resources)
module.exports.stopWorker = () => {
  if (worker) {
    worker.close();
    console.log('Mediasoup worker stopped');
  } else {
    console.warn('No Mediasoup worker to stop');
  }
};

// Create a Mediasoup router (handles media transport between devices)
module.exports.createRouter = async () => {
  if (!worker) {
    throw new Error('Mediasoup worker not initialized');
  }

  try {
    // Create the Mediasoup router with supported media codecs
    router = await worker.createRouter({
      mediaCodecs: [
        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }, // Video codec: VP8
        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 } // Audio codec: Opus
      ]
    });
    console.log('Mediasoup router created');
  } catch (error) {
    console.error('Error creating Mediasoup router:', error);
  }
  return router; // Return the created router
};

// Getter to retrieve the worker
module.exports.getWorker = () => worker;
