const { MongoClient } = require('mongodb');
// require('dotenv').config(); // load .env variables

const uri = 'mongodb://localhost:27017/';

const client = new MongoClient(uri);

let db;

async function connect() {
  if (!db) {
    db = await client.connect()
    db = await client.db('Circle');
    console.log(await db)
  }
  return db;
}

module.exports = { connect, client };
