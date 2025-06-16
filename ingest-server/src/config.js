export default {
    httpPort: 8090,
    mediasoup: {
        listenIps: [{ ip: "0.0.0.0", announcedIp: "192.168.178.204" }],
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 10100,
            logLevel: "debug",
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
                    "level-asymmetry-allowed": "1"
                    },
                    rtcpFeedback: [
                    { type: "nack" },
                    { type: "nack", parameter: "pli" },
                    { type: "goog-remb" }
                    ]
                },
                {
                    kind: "audio",
                    mimeType: "audio/opus",
                    clockRate: 48000,
                    channels: 2
                }
            ]
        },
    },
};
