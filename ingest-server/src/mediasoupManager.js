import mediasoup from "mediasoup";
import config from "./config.js";

let worker, router;
let transports = new Map(); // keyed by streamId

export async function startMediasoup() {
    worker = await mediasoup.createWorker(config.mediasoup.worker);
    router = await worker.createRouter({
        mediaCodecs: config.mediasoup.router.mediaCodecs,
    });
    console.log("✅ mediasoup started");
}

export function getRouter() {
    return router;
}

export async function createTransport(streamId) {
    const transport = await router.createWebRtcTransport({
        listenIps: config.mediasoup.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
    });

    transports.set(streamId, transport);
    return transport;
}

export function getTransport(streamId) {
    return transports.get(streamId);
}

export async function handleWebRtcOffer(transport, sdpOffer) {
    const sdpTransform = (await import("sdp-transform")).default;
    const parsedSdp = sdpTransform.parse(sdpOffer);

    const dtlsParameters = sdpTransform
        .parse(sdpOffer)
        .media.find((m) => m.protocol.includes("UDP")).fingerprint;

    const remoteDtls = {
        role: "auto",
        fingerprints: [
            {
                algorithm: dtlsParameters.hash,
                value: dtlsParameters.fingerprint,
            },
        ],
    };

    await transport.connect({ dtlsParameters: remoteDtls });

    // Just return dummy answer for now
    return {
        sdpAnswer: buildFakeSdpAnswer(transport),
    };
}

function buildFakeSdpAnswer(transport) {
    const { iceParameters, iceCandidates, dtlsParameters } = transport;

    return [
        "v=0",
        "o=- 0 0 IN IP4 127.0.0.1",
        "s=mediasoup",
        "t=0 0",
        `a=ice-ufrag:${iceParameters.usernameFragment}`,
        `a=ice-pwd:${iceParameters.password}`,
        ...iceCandidates.map(
            (c) => `a=candidate:1 1 udp 2130706431 ${c.ip} ${c.port} typ host`
        ),
        "a=end-of-candidates",
        `a=setup:passive`,
        `a=fingerprint:${dtlsParameters.fingerprints[0].algorithm} ${dtlsParameters.fingerprints[0].value}`,
        "m=audio 9 UDP/TLS/RTP/SAVPF 111",
        "c=IN IP4 0.0.0.0",
        "a=mid:audio",
        "a=rtpmap:111 opus/48000/2",
        "a=sendrecv",
        "a=rtcp-mux",
        "m=video 9 UDP/TLS/RTP/SAVPF 96",
        "c=IN IP4 0.0.0.0",
        "a=mid:video",
        "a=rtpmap:96 H264/90000",
        "a=sendrecv",
        "a=rtcp-mux",
    ].join("\r\n");
}
