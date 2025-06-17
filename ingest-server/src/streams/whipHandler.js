import express from "express";
import sdpTransform from "sdp-transform";
import streamManager from "./StreamManager.js";
import {
    createIngestTransport,
    getIngestTransport,
} from "../mediasoup/transportManager.js";

const router = express.Router();

router.post("/:streamId", async (req, res) => {
    const { streamId } = req.params;
    const sdp = req.body;
    try {
        if (!streamManager.hasStream(streamId)) {
            const stream = await streamManager.createStream(streamId);
            const transport = await createIngestTransport(streamId);
            transport.on(
                "dtlsstatechange",
                (d) => d === "closed" && streamManager.removeStream(streamId)
            );
        }

        const stream = streamManager.getStream(streamId);
        const transport = getIngestTransport(streamId);

        const offer = sdpTransform.parse(sdp);
        const fp = offer.fingerprint || offer.media[0]?.fingerprint;
        await transport.connect({
            dtlsParameters: {
                role: "auto",
                fingerprints: [{ algorithm: fp.type, value: fp.hash }],
            },
        });

        for (const m of offer.media) {
            if (m.direction !== "sendonly") continue;
            const codec = m.rtp[0];
            const rtpParameters = {
                codecs: [
                    {
                        mimeType:
                            m.type === "audio" ? "audio/opus" : "video/H264",
                        payloadType: codec.payload,
                        clockRate: codec.rate,
                        channels: m.type === "audio" ? 2 : undefined,
                        parameters: {},
                    },
                ],
                encodings: [{ ssrc: m.ssrcs?.[0]?.id || Date.now() }],
            };
            const producer = await transport.produce({
                kind: m.type,
                rtpParameters,
            });
            stream.setProducer(producer);
        }

        // build simple SDP answer with ICE/DTLS (omitted here for brevity)
        const answerSdp = "v=0...";
        res.status(201).type("application/sdp").send(answerSdp);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

//Check if nessesary to have this endpoint
router.delete("/:streamId", (req, res) => {
    streamManager.removeStream(req.params.streamId);
    res.sendStatus(204);
});

export { router };
