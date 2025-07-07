const generateChallenge = require('../utils/challenge');
const { verifySignatureChallenge } = require('../utils/verifySignature');
const logger = require('../utils/logger');
const { connect } = require('../utils/mongodbClient');

const challenges = {};

exports.generateChallengeForUser = async (username) => {
  const db = await connect();
  logger.info('Looking up username:', username);

  const user = await db.collection('User').findOne({ userName: username });

  if (!user) {
    logger.error(`User not found for username: ${username}`);
    throw new Error('User not found in database');
  }

  const publicKey = user.publicKey;

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

  return verifySignatureChallenge(challenge, public_key, signature);
};

exports.getPublicKey = async (username) => {
  const db = await connect();
  logger.info('Fetching public key for username:', username);

  const user = await db.collection('User').findOne({ userName: username });

  if (!user) {
    logger.error(`User not found for username: ${username}`);
    throw new Error('User not found in database');
  }

  if (!user.publicKey) {
    logger.error(`Public key not found for username: ${username}`);
    throw new Error('Public key not found for user');
  }

  return user.publicKey;
};

exports._challenges = challenges;