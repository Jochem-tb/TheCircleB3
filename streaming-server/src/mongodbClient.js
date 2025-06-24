const { MongoClient } = require('mongodb');
require('dotenv').config(); // load .env variables

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

let db;

async function connect() {
  if (!db) {
    db = await client.connect()
    db = await client.db('TheCircleDB');
  }
  return db;
}

module.exports = { connect, client };