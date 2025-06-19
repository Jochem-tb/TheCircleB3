const generateChallenge = require('../utils/challenge');
const verifySignature = require('../utils/verifySignature');
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

  return verifySignature(challenge, public_key, signature);
};

exports._challenges = challenges;