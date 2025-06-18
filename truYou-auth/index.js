const express = require('express')
const verifySignature = require('./src/utils/crypto.js');
const errorHandler = require('./src/utils/errorHandler.js');
const logger = require('./src/utils/logger.js');
const authRoutes = require('./src/routes/auth.routes.js');

const app = express();
app.use(express.json());

app.post('/verify', (req, res) => {
    const { name, publicKey, signature } = req.body || {};

    if (!name || !publicKey || !signature) {
        console.error('Missing auth fields:', { name, publicKey, signature });
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

app.use(errorHandler);

const port = process.env.PORT || 3000;

app.listen(3000, () => {
    logger.info(`Auth server running on port ${port}`);
});
