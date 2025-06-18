import mediasoup from "mediasoup";
import config from "../config/index.js";
import os from "os";

const workers = [];
let nextWorker = 0;

export async function createWorkers() {
    const { rtcMinPort, rtcMaxPort, logLevel, logTags } =
        config.mediasoup.worker;
    const num = Object.keys(os.cpus()).length;
    for (let i = 0; i < num; i++) {
        const worker = await mediasoup.createWorker({
            rtcMinPort,
            rtcMaxPort,
            logLevel,
            logTags,
        });
        worker.on("died", () => setTimeout(() => process.exit(1), 2000));
        workers.push(worker);
    }
}

export function getWorker() {
    const worker = workers[nextWorker];
    nextWorker = (nextWorker + 1) % workers.length;
    return worker;
}
