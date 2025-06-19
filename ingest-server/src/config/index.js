// File: src/config/index.js
import os from "os";

const getLocalIp = () => {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
};

export default {
    httpPort: 8090,
    mediasoup: {
        listenIps: [{ ip: "0.0.0.0", announcedIp: getLocalIp() }],
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 10100,
            logLevel: "debug",
            logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
        },
        router: {
            mediaCodecs: [
                // Support VP8
                {
                    kind: "video",
                    mimeType: "video/VP8",
                    clockRate: 90000,
                    rtcpFeedback: [
                        { type: "nack" },
                        { type: "nack", parameter: "pli" },
                        { type: "ccm", parameter: "fir" },
                        { type: "goog-remb" },
                    ],
                    parameters: {},
                    preferredPayloadType: 96,
                },

                // Support VP9
                {
                    kind: "video",
                    mimeType: "video/VP9",
                    clockRate: 90000,
                    rtcpFeedback: [
                        { type: "nack" },
                        { type: "nack", parameter: "pli" },
                        { type: "goog-remb" },
                    ],
                },

                // Support H264 (packetization-mode=1)
                {
                    kind: "video",
                    mimeType: "video/H264",
                    clockRate: 90000,
                    parameters: {
                        "packetization-mode": "1",
                        "profile-level-id": "42e01f",
                        "level-asymmetry-allowed": "1",
                    },
                    rtcpFeedback: [
                        { type: "nack" },
                        { type: "nack", parameter: "pli" },
                        { type: "goog-remb" },
                    ],
                },

                // Support H264 (packetization-mode=0) for Safari
                {
                    kind: "video",
                    mimeType: "video/H264",
                    clockRate: 90000,
                    parameters: {
                        "packetization-mode": "0",
                        "profile-level-id": "42e01f",
                        "level-asymmetry-allowed": "1",
                    },
                    rtcpFeedback: [
                        { type: "nack" },
                        { type: "nack", parameter: "pli" },
                        { type: "goog-remb" },
                    ],
                },

                // Always leave Opus in
                {
                    kind: "audio",
                    mimeType: "audio/opus",
                    clockRate: 48000,
                    channels: 2,
                },
            ],
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
                {
                    urls: "turn:turn.example.com:3478",
                    username: "user",
                    credential: "pass",
                },
            ],
        },
    },
};
