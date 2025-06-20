import crypto from "crypto";
import { MongoClient } from "mongodb";

const secret = process.env.LOGGING_HMAC_SECRET || "supersecretkey";
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = "thecircle";
const collectionName = "logs";

let dbClient;
async function getDbCollection() {
    if (!dbClient) {
        dbClient = new MongoClient(uri);
        await dbClient.connect();
    }
    return dbClient.db(dbName).collection(collectionName);
}

function generateSignature(payload) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest("hex");
}

export async function logEvent({ event, streamId, userId, viewerId = null, details = {} }) {
    const timestamp = new Date().toISOString();
    const payload = { event, streamId, userId, viewerId, details, timestamp };
    const signature = generateSignature(payload);
    const logEntry = { ...payload, signature };
    const collection = await getDbCollection();
    await collection.insertOne(logEntry);
    console.log(`[LOG] ${event} →`, logEntry);
}