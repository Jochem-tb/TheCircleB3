import express from "express";
<<<<<<< Updated upstream
import { createTransport, getRouter } from "./mediasoupManager.js";
import { handleWebRtcOffer } from "./streamManager.js";

import { v4 as uuid } from "uuid";
=======
import { createTransport } from "./mediasoupManager.js";
import sdpTransform from "sdp-transform";
>>>>>>> Stashed changes

const router = express.Router();

router.post("/:streamId", async (req, res) => {
    const { streamId } = req.params;
<<<<<<< Updated upstream
    // For application/sdp, you should have express.text() in server.js
    const sdpOffer = req.body;

    if (!sdpOffer || !sdpOffer.startsWith("v=0")) {
        return res.status(400).send("Missing or invalid SDP offer");
    }

    try {
        // 1) Create a new WebRTC transport for this publisher
        const transport = await createTransport(streamId);

        // 2) Run the SDP handshake and get back your SDP answer
        const sdpAnswer = await handleWebRtcOffer(
            streamId,
            transport,
            sdpOffer
        );

        // 3) Send the SDP answer back as raw SDP
        res.type("application/sdp").send(sdpAnswer);
        // res.status(201).json({ sdp: sdpAnswer, transportId: transport.id });
        console.log(`WHIP publish started for stream ${streamId}`);
    } catch (err) {
        console.error("WHIP publish error:", err);
        res.status(500).send(err.toString());
=======
    const sdpOffer = req.body;

    console.log(`[WHIP] Incoming POST for streamId: ${streamId}`);
    console.log(`[WHIP] Received SDP offer:\n${sdpOffer}`);

    if (!sdpOffer) {
        console.error("[WHIP] Missing SDP offer");
        return res.status(400).send("Missing SDP offer");
    }

    try {
        const transport = await createTransport(streamId);
        console.log("[WHIP] Created transport:", transport.id);

        const offer = sdpTransform.parse(sdpOffer);
        const media = offer.media[0];
        const fingerprint = media.fingerprint || offer.fingerprint;
        const iceUfrag = media.iceUfrag || offer.iceUfrag;
        const icePwd = media.icePwd || offer.icePwd;

        if (!fingerprint || !iceUfrag || !icePwd) {
            throw new Error("Missing DTLS or ICE parameters in SDP offer");
        }

        await transport.connect({
            dtlsParameters: {
                role: 'auto',
                fingerprints: [
                    { algorithm: fingerprint.type, value: fingerprint.hash }
                ]
            }
        });

        const iceParams = transport.iceParameters;
        const dtlsParams = transport.dtlsParameters;
        const candidates = transport.iceCandidates;

        // Build SDP answer manually
        const sdpAnswerObj = {
            version: 0,
            origin: {
                username: '-',
                sessionId: 0,
                sessionVersion: 0,
                netType: 'IN',
                ipVer: 4,
                address: '127.0.0.1'
            },
            name: 'mediasoup',
            timing: { start: 0, stop: 0 },
            iceLite: true,
            media: []
        };

        // Accept incoming media
        for (const m of offer.media) {
            if (m.direction !== "sendonly") continue; // Only accept sendonly from OBS

            if (m.type === "audio") {
                const codec = m.rtp.find(c => c.codec.toLowerCase() === "opus");
                if (!codec) continue;

                const ssrc = m.ssrcs?.[0]?.id || 1111;

                await transport.produce({
                    kind: "audio",
                    rtpParameters: {
                        codecs: [{
                            mimeType: "audio/opus",
                            payloadType: codec.payload,
                            clockRate: codec.rate,
                            channels: 2
                        }],
                        encodings: [{ ssrc }]
                    }
                });

                console.log("🎤 Produced audio track with SSRC", ssrc);
            }

            if (m.type === "video") {
                const codec = m.rtp.find(c => c.codec.toLowerCase().includes("h264"));
                if (!codec) continue;

                const fmtp = m.fmtp?.find(f => f.payload === codec.payload);
                const parameters = {};
                if (fmtp?.config) {
                    fmtp.config.split(";").forEach(entry => {
                        const [key, val] = entry.trim().split("=");
                        parameters[key] = val ?? "";
                    });
                }

                const ssrc = m.ssrcs?.[0]?.id || 2222;

                await transport.produce({
                    kind: "video",
                    rtpParameters: {
                        codecs: [{
                            mimeType: "video/H264",
                            payloadType: codec.payload,
                            clockRate: codec.rate,
                            parameters,
                            rtcpFeedback: [
                                { type: "nack" },
                                { type: "nack", parameter: "pli" },
                                { type: "goog-remb" }
                            ]
                        }],
                        encodings: [{ ssrc }]
                    }
                });

                console.log("📹 Produced video track with SSRC", ssrc);
            }
        }

        const sdpAnswer = sdpTransform.write(sdpAnswerObj);

        console.log("[WHIP] Sending SDP answer:\n", sdpAnswer);
        res.type("application/sdp").send(sdpAnswer);
    } catch (err) {
        console.error("[WHIP] Error handling WHIP request:", err);
        res.status(500).send("Internal server error");
>>>>>>> Stashed changes
    }
});

export default router;
