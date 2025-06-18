const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const crypto = require('crypto');
const app = require('../index.js'); // pad naar jouw Express app

// Importeer en patch de fake user DB
const authService = require('../src/services/auth.services.js');

// ✨ Helper om tijdelijk een public key in te voegen
const injectTestPublicKey = (username, publicKey) => {
  if (authService.__setPublicKeyForTest) {
    authService.__setPublicKeyForTest(username, publicKey);
  } else {
    throw new Error("Voeg exports.__setPublicKeyForTest toe in auth.service.js voor test purposes");
  }
};

describe('Auth API', () => {
  const username = 'testuser';
  let publicKey;
  let privateKey;
  let challenge;

  before(() => {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;

    // Inject in fake user DB
    injectTestPublicKey(username, publicKey);
  });

  it('GET /auth/challenge geeft challenge terug', async () => {
    const res = await request(app)
      .get(`/auth/challenge?username=${username}`)
      .expect(200);

    expect(res.body).to.have.property('challenge');
    expect(res.body).to.have.property('public_key');
    challenge = res.body.challenge; // nodig voor volgende test
  });

  it('POST /auth/authenticate accepteert geldige signature', async () => {
    // Maak handtekening van challenge
    const signer = crypto.createSign('SHA256');
    signer.update(challenge);
    signer.end();

    const signature = signer.sign(privateKey).toString('base64');

    const res = await request(app)
      .post('/auth/authenticate')
      .send({
        username,
        signature,
        public_key: publicKey,
      })
      .expect(200);

    expect(res.text).to.contain(`Authenticated as ${username}`);
  });

    it('GET /auth/challenge faalt bij onbekende gebruiker', async () => {
    const res = await request(app)
      .get(`/auth/challenge?username=nonexistentuser`)
      .expect(404);

    expect(res.body).to.have.property('error');
    expect(res.body.error).to.equal('User not found');
  });

  it('POST /auth/authenticate faalt als er geen challenge bestaat', async () => {
    const fakeUser = 'nobody';
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const signature = crypto.createSign('SHA256')
      .update('fake-challenge')
      .end()
      .sign(keyPair.privateKey)
      .toString('base64');

    injectTestPublicKey(fakeUser, keyPair.publicKey);

    const res = await request(app)
      .post('/auth/authenticate')
      .send({
        username: fakeUser,
        signature,
        public_key: keyPair.publicKey,
      })
      .expect(400);

    expect(res.text).to.equal('Challenge not found or expired.');
  });

  it('POST /auth/authenticate faalt bij ongeldige signature', async () => {
    const res = await request(app)
      .post('/auth/authenticate')
      .send({
        username,
        signature: 'fouteSignatureBase64==',
        public_key: publicKey,
      })
      .expect(401);

    expect(res.text).to.equal('Invalid signature.');
  });

  it('POST /auth/authenticate faalt bij ontbrekende velden', async () => {
    const res = await request(app)
      .post('/auth/authenticate')
      .send({
        username,
        // ontbreekt signature en public_key
      })
      .expect(400);

    expect(res.body).to.have.property('error');
    expect(res.body.error).to.match('/missing/');
  });
});
