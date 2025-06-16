import express from 'express';
import { verifySignature } from './utils/crypto.js';

const app = express();
app.use(express.json());

app.post('/verify', (req, res) => {
    const { name, publicKey, signature } = req.body || {};

    if (!name || !publicKey || !signature) {
        return res.status(400).json({ error: 'Missing auth fields', validVerification: false });
    }

    const validSignature = verifySignature(`I am ${name}`, publicKey, signature);

    if (validSignature) {
        return res.json({ validVerification: true, name });
    } else {
        return res.status(401).json({ error: 'Invalid signature', validVerification: false });
    }
});

app.listen(3000, () => {
    console.log('Auth server running on http://localhost:3000');
});
