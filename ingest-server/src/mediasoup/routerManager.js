import { getWorker } from "./workerManager.js";
import config from "../config/index.js";

const routers = new Map();

export async function createRouter(streamId) {
    const worker = getWorker();
    const router = await worker.createRouter({
        mediaCodecs: config.mediasoup.router.mediaCodecs,
    });
    routers.set(streamId, router);
    console.log(
        `[Router] Created router for streamId ${streamId} (id=${router.id})`
    );
    return router;
}

export function getRouter(streamId) {
    return routers.get(streamId);
}

export function displayRouters() {
    console.log("Current Routers:");
    routers.forEach((router, streamId) => {
        console.log(
            `Stream ID: ${streamId}, Router ID: ${router.id}, Router Info:`,
            router
        );
    });
}

export function removeRouter(streamId) {
    const r = routers.get(streamId);
    if (r) {
        r.close();
        routers.delete(streamId);
    }
}
