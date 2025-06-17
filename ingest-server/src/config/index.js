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
                {
                    kind: "video",
                    mimeType: "video/H264",
                    clockRate: 90000,
                    parameters: {
                        "profile-level-id": "42e01f",
                        "packetization-mode": "1",
                        "level-asymmetry-allowed": "1",
                    },
                    rtcpFeedback: [
                        { type: "nack" },
                        { type: "nack", parameter: "pli" },
                        { type: "goog-remb" },
                    ],
                },
                {
                    kind: "audio",
                    mimeType: "audio/opus",
                    clockRate: 48000,
                    channels: 2,
                },
            ],
        },
    },
};
