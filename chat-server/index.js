import http from 'http';
import url from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { getOrCreateChatRoom } from './serverManager.js';
import dotenv from 'dotenv';
dotenv.config();

// Lees poort uit .env of gebruik 8080 als fallback
const PORT = process.env.PORT || 8080;

// Maak HTTP + WebSocket server
const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    console.log('New connection request:', req.url);

    const { query } = url.parse(req.url, true);
    const { userId } = query;

    if (!userId) {
        console.log('Connection rejected: Missing userId');
        ws.send(JSON.stringify({ error: 'Missing userId in query string' }));
        ws.close();
        return;
    }

    console.log(`Client connecting to chat room for userId: ${userId}`);
    const chatRoom = getOrCreateChatRoom(userId);
    chatRoom.addClient(ws);
});

server.listen(PORT, () => {
    console.log(`Chat master server running on port ${PORT}`);
});