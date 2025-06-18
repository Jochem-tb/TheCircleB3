const express = require('express');
const authController = require('../controllers/auth.controller');
const authRoutes = express.Router();

authRoutes.get('/challenge', authController.getChallenge);
authRoutes.post('/authenticate', authController.postAuthenticate);

module.exports = authRoutes;