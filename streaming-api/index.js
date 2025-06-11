import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 4000;

const HLS_PATH = "/app/hls";

// Endpoint to list active streams by checking folders in HLS_PATH
app.get("/streams", (req, res) => {
    fs.readdir(HLS_PATH, (err, files) => {
        if (err) return res.status(500).send("Error reading streams");
        res.json(files); // each folder is a stream name
    });
});

app.listen(PORT, () => {
    console.log(`Streaming API listening on port ${PORT}`);
});
