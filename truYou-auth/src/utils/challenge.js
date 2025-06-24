const crypto = require('crypto');

function generateChallenge() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = generateChallenge;