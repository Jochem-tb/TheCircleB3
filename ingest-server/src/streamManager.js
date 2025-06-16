import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const activeStreams = new Map();

export function startStream(streamId) {
  return new Promise((resolve, reject) => {
    if (activeStreams.has(streamId)) {
      return reject(new Error('Stream already active'));
    }

    const outputPath = path.resolve(`recordings/${streamId}.mp4`);

    // Example: OBS WHIP sends stream over RTMP (tunneled)
    const ffmpeg = spawn('ffmpeg', [
      '-i', `rtmp://localhost/live/${streamId}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-f', 'mp4',
      outputPath
    ]);

    ffmpeg.stderr.on('data', data => {
      console.log(`[FFmpeg ${streamId}]: ${data}`);
    });

    ffmpeg.on('error', err => {
      console.error(`[FFmpeg ${streamId} Error]:`, err);
      activeStreams.delete(streamId);
      reject(err);
    });

    ffmpeg.on('close', code => {
      console.log(`[FFmpeg ${streamId}] exited with code ${code}`);
      activeStreams.delete(streamId);
    });

    activeStreams.set(streamId, ffmpeg);
    resolve();
  });
}

export function stopStream(streamId) {
  return new Promise((resolve, reject) => {
    const ffmpeg = activeStreams.get(streamId);
    if (!ffmpeg) return reject(new Error('Stream not active'));

    ffmpeg.kill('SIGINT');
    activeStreams.delete(streamId);
    resolve();
  });
}
