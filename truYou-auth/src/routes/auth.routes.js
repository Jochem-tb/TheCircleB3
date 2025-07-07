const express = require('express');
const authController = require('../controllers/auth.controller');
const authRoutes = express.Router();

authRoutes.get('/challenge', authController.getChallenge);
authRoutes.post('/authenticate', authController.postAuthenticate);
authRoutes.get('/public-key/:username', authController.getPublicKey);

module.exports = authRoutes;