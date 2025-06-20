import fetch from 'node-fetch'; // This line is needed to import fetch in Node.js
import { AUTH_SERVER_URL } from '../config/config.js';

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
    async handleMessage(ws, raw) {
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

            console.log(`Authentication request for user: ${name}`);
            //  Verify the signature with the auth server
            const validVerification = await this.verifyWithAuthServer(name, publicKey, signature);

            if (validVerification) {
                console.log(`User ${name} authenticated successfully.`);
                // Store user info on the socket for later use
                ws.user = { name, publicKey };
                ws.send(JSON.stringify({ status: 'authenticated', name }));
            } else {
                console.error(`Authentication failed for user: ${name}`);
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

        this.logChatEvent(chat).catch(err =>
            console.error("Logging failed:", err.message)
        );

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

    async logChatEvent({ sender, messageText, timestamp }) {
        const event = {
        eventType: "message_sent",
        userId:    sender,               // TruYou‐ID of user‐naam
        sessionId: this.userId,          // hier gebruik je de ChatRoom.userId als sessie‐ID
        timestamp,
        metadata:  { messageText }
        };

        const body = JSON.stringify(event);
        const ts   = new Date().toISOString();
        const secret = process.env.HMAC_SECRET;
        const payload = ts + body;
        const signature = crypto
            .createHmac("sha256", secret)
            .update(payload)
            .digest("hex");

        await axios.post(process.env.LOGGING_URL, event, {
            headers: {
                "Content-Type": "application/json",
                "X-Timestamp":   ts,
                "X-Signature":   signature
            },
            timeout: 2000
        });
    }    

    // Verify the user's signature with the auth server.
    async verifyWithAuthServer(name, publicKey, signature) {
        try {
            const res = await fetch(`${AUTH_SERVER_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, publicKey, signature })
            });

            const result = await res.json();
            return result.validVerification === true;
        } catch (err) {
            console.error('Auth server error:', err);
            return false;
        }
    }
}

export default ChatRoom;
