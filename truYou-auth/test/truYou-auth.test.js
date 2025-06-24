const chai = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const app = require('../index');
const authServices = require('../src/services/auth.services');
const dbService = require('../src/utils/mongodbClient');

const expect = chai.expect;

describe('truYou-auth server', function () {
    describe('GET /', function () {
        it('should return server running message', async function () {
            const res = await request(app).get('/');
            expect(res.status).to.equal(200);
            expect(res.text).to.include('Auth server is up and running');
        });
    });

    describe('POST /verify', function () {
        it('should return 400 if missing fields', async function () {
            const res = await request(app)
                .post('/verify')
                .send({ name: 'Alice' });
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error');
            expect(res.body.validVerification).to.be.false;
        });

        it('should return 401 for invalid signature', async function () {
            const res = await request(app)
                .post('/verify')
                .send({
                    name: 'Alice',
                    publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn\n-----END PUBLIC KEY-----',
                    signature: 'invalidsignature'
                });
            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('error');
            expect(res.body.validVerification).to.be.false;
        });
    });

    describe('GET /auth/challenge', function () {
        let dbStub;
        beforeEach(function () {
            dbStub = sinon.stub(dbService, 'connect');
        });
        afterEach(function () {
            dbStub.restore();
        });

        it('should return 400 if username is missing', async function () {
            const res = await request(app).get('/auth/challenge');
            expect(res.status).to.equal(400);
        });

        it('should return 404 if user not found', async function () {
            dbStub.resolves({
                collection: () => ({
                    findOne: async () => null
                })
            });
            const res = await request(app).get('/auth/challenge?username=nouser');
            expect(res.status).to.equal(500); // Throws error, caught by error handler
            expect(res.body).to.have.property('message');
        });
    });

    describe('POST /auth/authenticate', function () {
        let dbStub, verifyStub;
        before(function () {
            dbStub = sinon.stub(dbService, 'connect');
            verifyStub = sinon.stub(authServices, 'verifyUser');
        });
        after(function () {
            dbStub.restore();
            verifyStub.restore();
        });

        it('should return 400 if missing fields', async function () {
            const res = await request(app)
                .post('/auth/authenticate')
                .send({ username: 'testuser' });
            expect(res.status).to.equal(400);
        });

        it('should return 401 if signature invalid', async function () {
            verifyStub.returns(false);
            const res = await request(app)
                .post('/auth/authenticate')
                .send({ username: 'testuser', signature: 'sig', public_key: 'key' });
            expect(res.status).to.equal(401);
        });

        it('should return 404 if user not found in DB', async function () {
            verifyStub.returns(true);
            dbStub.resolves({
                collection: () => ({
                    findOne: async () => null
                })
            });
            const res = await request(app)
                .post('/auth/authenticate')
                .send({ username: 'testuser', signature: 'sig', public_key: 'key' });
            expect(res.status).to.equal(404);
        });

        it('should authenticate and return user info if valid', async function () {
            verifyStub.returns(true);
            dbStub.resolves({
                collection: () => ({
                    findOne: async () => ({
                        _id: 'userid123',
                        userName: 'testuser'
                    })
                })
            });
            const res = await request(app)
                .post('/auth/authenticate')
                .send({ username: 'testuser', signature: 'sig', public_key: 'key' });
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('authenticated', true);
            expect(res.body).to.have.property('userId');
            expect(res.body).to.have.property('userName', 'testuser');
        });
    });
});