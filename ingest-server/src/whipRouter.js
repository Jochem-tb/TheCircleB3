import express from "express";
import { createTransport, getRouter } from "./mediasoupManager.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

/**
 * WHIP-like flow (simplified):
 * POST /whip/:streamId => SDP Offer from client (OBS, etc)
 * Response: SDP Answer
 */

router.post("/:streamId", async (req, res) => {
    const { streamId } = req.params;
    const sdpOffer = req.body.sdp;

    if (!sdpOffer) return res.status(400).send("Missing SDP offer");

    const transport = await createTransport(streamId);
    const { sdpAnswer } = await handleSdpExchange(transport, sdpOffer);

    res.json({ sdp: sdpAnswer });
});

// Stub — you'd use sdp-transform and mediasoup-sdp utils
async function handleSdpExchange(transport, sdpOffer) {
    // You'll need to implement proper SDP parsing (WHIP standard)
    // This is a placeholder for demonstration

    return { sdpAnswer: "fake-sdp-answer" };
}

export default router;
