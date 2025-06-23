
import http from 'http';
import url from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { getOrCreateChatRoom } from './serverManager.js';
import dotenv from 'dotenv';
dotenv.config();

// Create a WebSocket server
const server = http.createServer();
const wss = new WebSocketServer({ server });

// Listen for WebSocket connection events
wss.on('connection', (ws, req) => {
    console.log('New connection request:', req.url);

    // Parse the request URL to extract query parameters
    const { query } = url.parse(req.url, true);
    const { userId } = query;

    // If no userId is provided, reject the connection
    if (!userId) {
        console.log('Connection rejected: Missing userId');
        ws.send(JSON.stringify({ error: 'Missing userId in query string' }));
        ws.close();
        return;
    }

    // Log the connection and add the client to the corresponding chat room
    console.log(`Client connecting to chat room for userId: ${userId}`);
    const chatRoom = getOrCreateChatRoom(userId);
    chatRoom.addClient(ws);
});

// Start the server
server.listen(8080, () => {
    console.log('Chat master server running on port 8080');
});
