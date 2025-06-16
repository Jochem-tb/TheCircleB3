import express from "express";
import config from "./config.js";
import { startMediasoup } from "./mediasoupManager.js";
import whipRouter from "./whipRouter.js";

const app = express();

app.use(express.json());
app.use(express.text({ type: "application/sdp" })); // for raw SDP

app.use("/whip", whipRouter);

app.listen(config.httpPort, async () => {
    console.log(`Ingest API listening on http://0.0.0.0:${config.httpPort}`);
    await startMediasoup();
});