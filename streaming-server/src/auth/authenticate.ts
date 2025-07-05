import express from 'express';
import { storeUserPublicKey } from './publicKeyStore';

const router = express.Router();

router.post('/auth/authenticate', async (req, res) => {
    const { username, signature, public_key } = req.body;

    if (!username || !signature || !public_key) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    storeUserPublicKey(username, public_key);

    return res.json({ authenticated: true, username });
});

export default router;