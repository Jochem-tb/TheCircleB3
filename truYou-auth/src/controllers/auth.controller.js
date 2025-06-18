const authServices = require('../services/auth.services');
const logger = require('../utils/logger');
const handleError = require('../utils/errorHandler');

exports.getChallenge = (req, res) => {
  try {
    const username = req.query.username;
    logger.info(`Generating challenge for user: ${username}`);
  
    if (!username) {
      logger.error('Username is required for challenge generation.');
      return res.status(400).send('Username is required.');
    }

    const result = authServices.generateChallengeForUser(username);
    console.info(`Challenge generated for user: ${username}`, result);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.postAuthenticate = (req, res) => {
  try {
    const { username, signature, public_key } = req.body;
    logger.info(`Authenticating user: ${username}`);

    if (!username || !signature || !public_key) {
      logger.error('Missing required fields for authentication:', { username, signature, public_key });
      return res.status(400).send('Missing required fields: username, signature, or public_key.');
    }

    const result = authServices.verifyUser(username, signature, public_key);
    console.info(`Authentication result for user ${username}:`, result);

    if (result) {
      res.send(`Authenticated as ${username}`);
    } else {
      res.status(401).send('Invalid signature.');
    }
  } catch (err) {
    next(err);
  }
};