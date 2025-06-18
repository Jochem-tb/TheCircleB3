const generateChallenge = require('../utils/challenge');
const verifySignature = require('../utils/verifySignature');
const logger = require('../utils/logger');

// Fake DB
const userPublicKeys = {
  alice: `-----BEGIN PUBLIC KEY-----
... public key hier ...
-----END PUBLIC KEY-----`,
};

const challenges = {};

exports.generateChallengeForUser = (username) => {
  const publicKey = userPublicKeys[username];

  if (!publicKey) {
    logger.error(`User not found: ${username}`);
    throw new Error('User not found');
  }

  const challenge = generateChallenge();
  challenges[username] = challenge;

  return {
    challenge,
    public_key: publicKey,
  };
};

exports.verifyUser = (username, signature, public_key) => {
  const challenge = challenges[username];
  if (!challenge) {
    logger.error(`Challenge not found or expired for user: ${username}`);
    throw new Error('Challenge not found or expired.');
  }

  return verifySignature(challenge, public_key, signature);
};


// Alleen voor tests: public key toevoegen aan fake "DB"
exports.__setPublicKeyForTest = (username, pubKey) => {
  userPublicKeys[username] = pubKey;
};

// Eventueel voor debug in testomgeving
exports._userPublicKeys = userPublicKeys;
exports._challenges = challenges;