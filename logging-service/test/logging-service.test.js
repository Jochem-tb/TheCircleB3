const chai = require("chai");
const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const app = require("../index.js");
const Log = require("../models/Log");

const expect = chai.expect;

require("dotenv").config();

const SHARED_SECRET = process.env.HMAC_SECRET || "testsecret";
const TEST_PORT = process.env.PORT || 5200;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function signBody(ts, body) {
    const hmac = crypto.createHmac("sha256", SHARED_SECRET);
    hmac.update(ts + body);
    return hmac.digest("hex");
}

describe("Logging Service API", function () {
    before(async function () {
        // Wacht tot mongoose connectie klaar is
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        }
    });

    after(async function () {
        await mongoose.disconnect();
    });

    beforeEach(async function () {
        await Log.deleteMany({});
    });

    it("should reject missing authentication headers", async function () {
        const res = await request(BASE_URL)
            .post("/log")
            .send({ eventType: "stream_start", userId: "u1", sessionId: "s1" });
        expect(res.status).to.equal(400);
        expect(res.body).to.have.property("error");
    });

    it("should reject invalid or expired timestamp", async function () {
        const body = JSON.stringify({ eventType: "stream_start", userId: "u1", sessionId: "s1" });
        const ts = new Date(Date.now() - 600000).toISOString(); // 10 min geleden
        const sig = signBody(ts, body);

        const res = await request(BASE_URL)
            .post("/log")
            .set("X-Timestamp", ts)
            .set("X-Signature", sig)
            .send(body);

        expect(res.status).to.equal(401);
        expect(res.body).to.have.property("error");
    });

    it("should reject missing required fields", async function () {
        const body = JSON.stringify({ eventType: "stream_start", userId: "u1" }); // sessionId mist
        const ts = new Date().toISOString();
        const sig = signBody(ts, body);

        const res = await request(BASE_URL)
            .post("/log")
            .set("X-Timestamp", ts)
            .set("X-Signature", sig)
            .send(body);

        expect(res.status).to.equal(400);
        expect(res.body).to.have.property("error");
    });

    it("should log a valid event", async function () {
        const payload = {
            eventType: "stream_start",
            userId: "user123",
            sessionId: "sess456",
            metadata: { foo: "bar" }
        };
        const body = JSON.stringify(payload);
        const ts = new Date().toISOString();
        const sig = signBody(ts, body);

        const res = await request(BASE_URL)
            .post("/log")
            .set("X-Timestamp", ts)
            .set("X-Signature", sig)
            .send(body);

        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ status: "logged" });

        // Check of het in de database staat
        const logs = await Log.find({ userId: "user123", sessionId: "sess456" });
        expect(logs).to.have.lengthOf(1);
        expect(logs[0].eventType).to.equal("stream_start");
        expect(logs[0].metadata.foo).to.equal("bar");
    });

    it("should reject invalid JSON", async function () {
        const body = "{ eventType: 'stream_start' "; // ongeldig JSON
        const ts = new Date().toISOString();
        const sig = signBody(ts, body);

        const res = await request(BASE_URL)
            .post("/log")
            .set("X-Timestamp", ts)
            .set("X-Signature", sig)
            .send(body);

        expect(res.status).to.equal(400);
        expect(res.body).to.have.property("error");
    });
});