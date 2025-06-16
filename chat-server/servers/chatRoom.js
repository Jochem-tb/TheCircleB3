// Import the verifySignature function to check message auth
import { verifySignature } from '../utils/crypto.js';

class ChatRoom {
    constructor(userId) {
        // Each ChatRoom is uniquely identified by a userId (the streamer ID)
        this.userId = userId;

        // Set to keep track of all WebSocket clients in this room
        this.clients = new Set();
    }


    // Add WebSocket client to the chat room.
    // Set up message and disconnect handlers.
    addClient(ws) {
        ws.on('message', raw => this.handleMessage(ws, raw));

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log(`Client disconnected from room ${this.userId}. Clients left: ${this.clients.size}`);
        });

        this.clients.add(ws);
        console.log(`Client connected to room ${this.userId}. Total clients: ${this.clients.size}`);
    }


    //Handle incoming messages.
    handleMessage(ws, raw) {
        let msg;

        // Parse JSON message
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        }

        // Handle authentication
        if (msg.type === 'auth') {
            const { name, publicKey, signature } = msg.data || {};

            // Ensure required auth fields are present
            if (!name || !publicKey || !signature) {
                ws.send(JSON.stringify({ error: 'Missing auth fields' }));
                return ws.close();
            }

            // Verify signature against the name claim
            const valid = verifySignature(`I am ${name}`, publicKey, signature);
            if (valid) {
                // Store user info on the socket for later use
                ws.user = { name, publicKey };
                ws.send(JSON.stringify({ status: 'authenticated', name }));
            } else {
                ws.send(JSON.stringify({ error: 'Invalid signature' }));
                ws.close();
            }
            return; // Exit after auth
        }

        // Ensure the user is authenticated before processing messages
        if (!ws.user) {
            return ws.send(JSON.stringify({ error: 'Not authenticated' }));
        }

        // Validate that the message has text
        if (!msg.messageText) {
            return ws.send(JSON.stringify({ error: 'Missing messageText' }));
        }

        // Build a message object
        const message = {
            sender: ws.user.name,
            messageText: msg.messageText,
            timestamp: new Date().toISOString()
        };

        this.broadcast(JSON.stringify(message));
    }

    //Sends a message to all connected clients in the chat room.
    broadcast(data) {
        for (const client of this.clients) {
            // Only send to clients with an open connection
            if (client.readyState === 1) {
                client.send(data);
            }
        }
    }
}

export default ChatRoom;
