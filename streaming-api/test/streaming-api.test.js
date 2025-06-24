const { expect } = require("chai");
const request = require("supertest");
const app = require("../api.js");

let server;
before((done) => { // Start the server before running tests
  server = app.listen(4001, done);
});

after((done) => { // Close the server after tests
  server.close(done);
});

describe("Streaming API", () => {
  it("should start a stream", async () => {
    const res = await request(server)
      .post("/streams/start")
      .send({ streamerId: "test123" });
    expect(res.status).to.equal(200);
  });

  it("should list active streamers", async () => {
    const res = await request(server)
      .get("/streams/active");
    expect(res.status).to.equal(200);
    expect(res.body).to.include("test123");
  });

  it("should stop a stream", async () => {
    const res = await request(server)
      .post("/streams/stop")
      .send({ streamerId: "test123" });
    expect(res.status).to.equal(200);
  });

  it("should not list stopped streamer", async () => {
    const res = await request(server)
      .get("/streams/active");
    expect(res.status).to.equal(200);
    expect(res.body).to.not.include("test123");
  });
});