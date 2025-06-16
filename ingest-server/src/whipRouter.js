import express from "express";
import { createTransport, getRouter } from "./mediasoupManager.js";
import { handleWebRtcOffer } from "./streamManager.js";

import { v4 as uuid } from "uuid";

const router = express.Router();

/**
 * WHIP-like flow (simplified):
 * POST /whip/:streamId => SDP Offer from client (OBS, etc)
 * Response: SDP Answer
 */

router.post("/:streamId", async (req, res) => {
    const { streamId } = req.params;
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
    }
});

export default router;
