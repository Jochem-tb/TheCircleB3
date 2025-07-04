import fetch from "node-fetch";
import axios from "axios";
import crypto from "crypto";
import { AUTH_SERVER_URL } from "../config/config.js";
import { connect } from "../service/mongoDBConn.js";

class ChatRoom {
  constructor(userId) {
    this.userId = userId; // Streamer ID
    this.clients = new Set();
  }

  addClient(ws) {
    ws.on("message", (raw) => this.handleMessage(ws, raw));

    ws.on("close", () => {
      this.clients.delete(ws);
      console.log(
        `Client disconnected from room ${this.userId}. Clients left: ${this.clients.size}`
      );
    });

    this.clients.add(ws);
    console.log(
      `Client connected to room ${this.userId}. Total clients: ${this.clients.size}`
    );
  }

  async handleMessage(ws, raw) {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return ws.send(JSON.stringify({ error: "Invalid JSON" }));
    }

    if (!msg.authenticated) return;

    const { userName, messageText, signature, timestamp , msgHash} = msg;
    if (!userName || !messageText || !signature || !timestamp || !msgHash) {
      return ws.send(JSON.stringify({ error: "Missing fields in message" }));
    }

    //Make a hash to check if it is altered
    function createHMAC(message, key) {
      return crypto.createHmac("sha256", key).update(message).digest("hex");
    }

    const ownHash = createHMAC(msg.messageText, "mySecretKey");

    if(ownHash !== msg.msgHash){
      return ws.send(JSON.stringify({ error: "Message got tempered with" }));
    }

    // 🔐 Prepare the signed string
    const signedPayload = `${userName}|${messageText}|${timestamp}`;

    try {
      const db = await connect();
      const users = db.collection("User");
      const user = await users.findOne({ userName });

      if (!user || !user.publicKey) {
        return ws.send(JSON.stringify({ error: "User or publicKey not found" }));
      }

      // ✅ Verify the digital signature
      const isVerified = crypto.verify(
        "sha256",
        Buffer.from(signedPayload),
        {
          key: user.publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(signature, "base64")
      );

      if (!isVerified) {
        return ws.send(JSON.stringify({ error: "Signature verification failed" }));
      }

      // ✅ Store in MongoDB
      await users.updateOne(
        { userName },
        {
          $push: {
            chatMessages: {
              messageText,
              timestamp,
            },
          },
        }
      );

      // 📢 Broadcast to all clients
      const message = {
        userName,
        messageText,
        timestamp,
      };

      // ✅ Log naar logging-service
    //   this.logChatEvent({
    //     userName: msg.userName,
    //     messageText: msg.messageText,
    //     timestamp,
    //   }).catch((err) => {
    //     console.error("Logging failed:", err.message);
    //   });


      this.broadcast(JSON.stringify(message));
    } catch (err) {
      console.error("❌ Internal error in handleMessage:", err);
      return ws.send(JSON.stringify({ error: "Internal server error" }));
    }
  }

  broadcast(data) {
    console.log(`Broadcasting message to room ${this.userId}:`, data);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

//   async logChatEvent({ userName, messageText, timestamp }) {
//     if (!userName || !messageText) {
//       console.warn("⚠️ logChatEvent: Missing userName or messageText");
//       return;
//     }

//     const event = {
//       eventType: "message_sent",
//       userId: userName,
//       sessionId: this.userId,
//       timestamp,
//       metadata: { messageText: messageText.trim() },
//     };

//     const body = JSON.stringify(event);
//     const ts = new Date().toISOString();
//     const secret = process.env.HMAC_SECRET;

//     const signature = crypto
//       .createHmac("sha256", secret)
//       .update(ts + body)
//       .digest("hex");

//     await axios.post(process.env.LOGGING_URL, body, {
//       headers: {
//         "Content-Type": "application/json",
//         "X-Timestamp": ts,
//         "X-Signature": signature,
//       },
//       timeout: 2000,
//     });
//   }

  async verifyWithAuthServer(name, publicKey, signature) {
    try {
      const res = await fetch(`${AUTH_SERVER_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, publicKey, signature }),
      });

      const result = await res.json();
      return result.validVerification === true;
    } catch (err) {
      console.error("Auth server error:", err);
      return false;
    }
  }
}

export default ChatRoom;