import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config(); // Load .env variables

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

async function connect() {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

// ✅ Use ES module export
export { connect, client };
