import express from "express";
import http from "http";
import cors from "cors";
import config from "./config/index.js";
import { createWorkers } from "./mediasoup/workerManager.js";
import { router as whipRouter } from "./streams/whipHandler.js";
import registerViewerHandlers from "./viewers/viewerHandler.js";

const app = express();
app.use(express.json());
app.use(express.text({ type: "application/sdp" }));
app.use(cors({ origin: "*" }));
app.use("/whip", whipRouter);

const server = http.createServer(app);

(async () => {
    await createWorkers();
    server.listen(config.httpPort, () =>
        console.log(`Listening on port ${config.httpPort}`)
    );
    registerViewerHandlers(server);
})();
