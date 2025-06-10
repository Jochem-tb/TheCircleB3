import express from "express";
import WebSocket from "ws";
import http from "http";
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", function connection(ws, req) {
    const streamId = new URL(
        req.url,
        `http://${req.headers.host}`
    ).pathname.slice(1);

    if (!chatRooms[streamId]) chatRooms[streamId] = new Set();
    chatRooms[streamId].add(ws);

    ws.on("message", function incoming(message) {
        for (const client of chatRooms[streamId]) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    });

    ws.on("close", () => chatRooms[streamId].delete(ws));
});
