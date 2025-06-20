const express = require('express');
const cors = require('cors');
const { verifySignature } = require('./src/utils/verifySignature.js');
const errorHandler = require('./src/utils/errorHandler.js');
const logger = require('./src/utils/logger.js');
const authRoutes = require('./src/routes/auth.routes.js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:4200', // Pas aan indien frontend elders draait
}));

// Routes
app.post('/verify', (req, res) => {
  const { name, publicKey, signature } = req.body || {};

  if (!name || !publicKey || !signature) {
    logger.error('Missing auth fields:', { name, publicKey, signature });
    return res.status(400).json({ error: 'Missing auth fields', validVerification: false });
  }

  const message = `I am ${name}`;
  const validSignature = verifySignature(message, publicKey, signature);

  if (validSignature) {
    return res.json({ validVerification: true, name });
  } else {
    return res.status(401).json({ error: 'Invalid signature', validVerification: false });
  }
});

app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Auth server is up and running!');
});

// Fallback error handler
app.use(errorHandler);

// Start server als direct uitgevoerd
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Auth server running on port ${port}`);
  });
}

module.exports = app;