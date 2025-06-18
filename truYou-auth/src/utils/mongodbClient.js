const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://ntpn294:1234@thecircleb3.ohuzlst.mongodb.net/TheCircleDB';

const client = new MongoClient(uri);

let db;

async function connect() {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

module.exports = { connect, client };
