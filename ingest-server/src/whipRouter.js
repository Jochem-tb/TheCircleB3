import express from 'express';
import { startStream, stopStream } from './streamManager.js';

const router = express.Router();

/**
 * WHIP follows:
 * POST /whip/stream-id  -> start new stream
 * DELETE /whip/stream-id -> stop stream
 */

router.post('/:streamId', async (req, res) => {
  const { streamId } = req.params;
  try {
    await startStream(streamId);
    res.status(201).send(`Stream ${streamId} started`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.delete('/:streamId', async (req, res) => {
  const { streamId } = req.params;
  try {
    await stopStream(streamId);
    res.status(200).send(`Stream ${streamId} stopped`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
