// Zorg dat je een .env hebt met minimaal:
// - LOGGING_URL=dummy
// - HMAC_SECRET=dummy
// - MONGODB_URI

const chai = require('chai');
const request = require('supertest');
const expect = chai.expect;

describe('Streaming Server API', function () {

    it('GET /streams should return an array', async function () {
        const res = await request('http://localhost:3002')
            .get('/streams')
            .expect(200);
        expect(res.body).to.be.an('array');
    });

    it('GET /streams should return empty array if no streams', async function () {
        const res = await request('http://localhost:3002')
            .get('/streams')
            .expect(200);
        expect(res.body).to.be.an('array').that.is.empty;
    });

    it('OPTIONS /streams should return 204 for CORS preflight', async function () {
        const res = await request('http://localhost:3002')
            .options('/streams')
            .expect(204);
    });

    it('should have CORS headers on /streams', async function () {
        const res = await request('http://localhost:3002')
            .get('/streams')
            .expect(200);
        expect(res.headers).to.have.property('access-control-allow-origin');
    });
});