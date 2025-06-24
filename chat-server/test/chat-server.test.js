import chai from 'chai';
import supertest from 'supertest';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';

const { expect } = chai;
const SERVER_PORT = 8081;
const SERVER_URL = `ws://localhost:${SERVER_PORT}`;
const HTTP_URL = `http://localhost:${SERVER_PORT}`;
let serverProcess;

describe('Chat Server', function () {
    this.timeout(10000);

    before((done) => {
        // Start the server as a child process
        serverProcess = spawn('node', ['index.js'], {
            cwd: process.cwd(),
            env: { ...process.env, PORT: SERVER_PORT },
            stdio: 'inherit',
        });
        setTimeout(done, 2000);
    });

    after((done) => {
        if (serverProcess) {
            serverProcess.kill();
        }
        setTimeout(done, 1000);
    });

    it('should reject connection without userId', (done) => {
        const ws = new WebSocket(`${SERVER_URL}`);
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.have.property('error');
            expect(msg.error).to.match(/userId/i);
            ws.close();
            done();
        });
    });

    it('should accept connection with userId and broadcast messages', (done) => {
        const ws1 = new WebSocket(`${SERVER_URL}/?userId=testuser`);
        const ws2 = new WebSocket(`${SERVER_URL}/?userId=testuser`);

        ws1.on('open', () => {
            ws2.on('open', () => {
                ws1.send(
                    JSON.stringify({
                        authenticated: true,
                        userName: 'alice',
                        messageText: 'Hello world!',
                    })
                );
            });
        });

        ws2.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.include({ userName: 'alice', messageText: 'Hello world!' });
            expect(msg).to.have.property('timestamp');
            ws1.close();
            ws2.close();
            done();
        });
    });

    it('should return error for invalid JSON', (done) => {
        const ws = new WebSocket(`${SERVER_URL}/?userId=errortest`);
        ws.on('open', () => {
            ws.send('not a json');
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.have.property('error');
            expect(msg.error).to.match(/invalid json/i);
            ws.close();
            done();
        });
    });

    it('should return error for missing messageText', (done) => {
        const ws = new WebSocket(`${SERVER_URL}/?userId=missingmsg`);
        ws.on('open', () => {
            ws.send(
                JSON.stringify({
                    authenticated: true,
                    userName: 'bob',
                })
            );
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.have.property('error');
            expect(msg.error).to.match(/messageText/i);
            ws.close();
            done();
        });
    });

    it('should accept connection with userId and broadcast messages', (done) => {
        const ws1 = new WebSocket(`${SERVER_URL}/?userId=testuser`);
        const ws2 = new WebSocket(`${SERVER_URL}/?userId=testuser`);

        let received = 0;
        ws1.on('open', () => {
            ws2.on('open', () => {
                // Send a valid message from ws1
                ws1.send(
                    JSON.stringify({
                        authenticated: true,
                        userName: 'alice',
                        messageText: 'Hello world!',
                    })
                );
            });
        });

        ws2.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.include({ userName: 'alice', messageText: 'Hello world!' });
            expect(msg).to.have.property('timestamp');
            ws1.close();
            ws2.close();
            done();
        });
    });

    it('should return error for invalid JSON', (done) => {
        const ws = new WebSocket(`${SERVER_URL}/?userId=errortest`);
        ws.on('open', () => {
            ws.send('not a json');
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.have.property('error');
            expect(msg.error).to.match(/invalid json/i);
            ws.close();
            done();
        });
    });

    it('should return error for missing messageText', (done) => {
        const ws = new WebSocket(`${SERVER_URL}/?userId=missingmsg`);
        ws.on('open', () => {
            ws.send(
                JSON.stringify({
                    authenticated: true,
                    userName: 'bob',
                })
            );
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg).to.have.property('error');
            expect(msg.error).to.match(/messageText/i);
            ws.close();
            done();
        });
    });
});