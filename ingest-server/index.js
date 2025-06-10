const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();

const PORT = 4000;

// Folder to store recordings
const RECORDINGS_DIR = path.join(__dirname, 'recordings');

app.use(express.json());

// Example: POST /start with JSON: { "streamKey": "streamer1" }
app.post('/start', (req, res) => {
  const { streamKey } = req.body;
  if (!streamKey) return res.status(400).send("Missing streamKey");

  const input = `rtmp://localhost:1935/live/${streamKey}`;
  const output = `rtmp://streaming-server:1935/live/${streamKey}`;
  const recordPath = path.join(RECORDINGS_DIR, streamKey);

  const ffmpegCmd = `ffmpeg -i ${input} -c:v libx264 -preset veryfast -crf 23 -c:a aac -f flv ${output}`;
  console.log(`[FFMPEG] Starting stream for ${streamKey}...`);

  const ffmpeg = exec(ffmpegCmd, { cwd: recordPath }, (error, stdout, stderr) => {
    if (error) console.error(`[FFMPEG] Error: ${error.message}`);
    if (stderr) console.error(`[FFMPEG] STDERR: ${stderr}`);
  });

  res.status(200).send(`Started streaming for ${streamKey}`);
});

app.listen(PORT, () => {
  console.log(`Ingest server running on http://localhost:${PORT}`);
});
