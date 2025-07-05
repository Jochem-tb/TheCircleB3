const { connect } = require('../mongodbClient');

async function getUserPublicKey(userName) {
    const db = await connect();
    const user = await db.collection('User').findOne({ userName });

    if (!user || !user.publicKey) {
        console.warn(`⚠️ No public key found for user: ${userName}`);
        return null;
    }

    return user.publicKey;
}

module.exports = { getUserPublicKey };