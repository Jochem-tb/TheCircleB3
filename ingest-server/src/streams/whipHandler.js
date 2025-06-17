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
    const sdpOffer = req.body;

    try {
        // STEP 1: Parse SDP offer
        const parsed = sdpTransform.parse(sdpOffer);
        const media0 = parsed.media[0];

        const fp = parsed.fingerprint || media0?.fingerprint;
        const iceUfrag = parsed.iceUfrag || media0?.iceUfrag;
        const icePwd = parsed.icePwd || media0?.icePwd;

        if (!fp || !iceUfrag || !icePwd) {
            throw new Error("Missing DTLS or ICE information in SDP offer");
        }

        // STEP 2: Create stream and transport if not already present
        if (!streamManager.hasStream(streamId)) {
            const stream = await streamManager.createStream(streamId);

            const transport = await createIngestTransport(streamId, {
                listenIps: [{ ip: "0.0.0.0", announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            transport.on("dtlsstatechange", (state) => {
                if (state === "closed") streamManager.removeStream(streamId);
            });
        }

        const stream = streamManager.getStream(streamId);
        const transport = getIngestTransport(streamId);

        // STEP 3: Connect transport with DTLS params
        await transport.connect({
            dtlsParameters: {
                role: "auto",
                fingerprints: [{ algorithm: fp.type, value: fp.hash }],
            },
        });

        // STEP 4: Produce tracks
        for (const m of parsed.media) {
            if (m.direction !== "sendonly") continue;

            const codec = m.rtp[0];
            const ssrc = m.ssrcs?.[0]?.id || Math.floor(Math.random() * 1e6);

            const rtpParameters = {
                codecs: [
                    {
                        mimeType:
                            m.type === "audio" ? "audio/opus" : "video/H264",
                        payloadType: codec.payload,
                        clockRate: codec.rate,
                        channels: m.type === "audio" ? 2 : undefined,
                        parameters: m.fmtp?.[0]?.config
                            ? Object.fromEntries(
                                  m.fmtp[0].config.split(";").map((e) => {
                                      const [k, v] = e.trim().split("=");
                                      return [k, v ?? ""];
                                  })
                              )
                            : {},
                        rtcpFeedback: m.rtcpFb ?? [],
                    },
                ],
                encodings: [{ ssrc }],
            };

            const producer = await transport.produce({
                kind: m.type,
                rtpParameters,
            });

            stream.setProducer(producer);
        }

        // STEP 5: Build full SDP answer
        const dtls = transport.dtlsParameters;
        const ice = transport.iceParameters;
        const candidates = transport.iceCandidates;
        const fpAnswer =
            dtls.fingerprints.find(
                (f) => f.algorithm.toLowerCase() === "sha-256"
            ) || dtls.fingerprints[0];

        const answer = {
            version: 0,
            origin: {
                username: "-",
                sessionId: 0,
                sessionVersion: 0,
                netType: "IN",
                ipVer: 4,
                address: "127.0.0.1",
            },
            name: "mediasoup",
            timing: { start: 0, stop: 0 },
            iceLite: true,
            media: [],
        };

        for (const [i, m] of parsed.media.entries()) {
            if (m.direction !== "sendonly") continue;

            const codec = m.rtp[0];

            answer.media.push({
                type: m.type,
                port: 7,
                protocol: "UDP/TLS/RTP/SAVPF",
                payloads: String(codec.payload),
                connection: { version: 4, ip: "127.0.0.1" },
                mid: m.mid || String(i),
                direction: "recvonly",
                rtp: [codec],
                fmtp: m.fmtp ?? [],
                rtcpFb: m.rtcpFb ?? [],
                setup: "active",
                iceUfrag: ice.usernameFragment,
                icePwd: ice.password,
                fingerprint: { type: fpAnswer.algorithm, hash: fpAnswer.value },
                candidates: candidates.map((c, idx) => ({
                    foundation: `fnd${idx}`,
                    component: 1,
                    transport: c.protocol,
                    priority: c.priority,
                    ip: c.ip,
                    port: c.port,
                    type: c.type,
                })),
                endOfCandidates: "end-of-candidates",
                iceOptions: "ice2",
                rtcpMux: "rtcp-mux",
            });
        }

        const answerSdp = sdpTransform.write(answer);

        // STEP 6: Send SDP answer
        res.status(201)
            .set("Location", `/whip/${streamId}`)
            .type("application/sdp")
            .send(answerSdp);

        // Optional: log transport stats
        const interval = setInterval(async () => {
            try {
                const stats = await transport.getStats();
                stats.forEach((stat) => {
                    if (stat.bytesReceived !== undefined) {
                        const kbps = (stat.bytesReceived / 1000).toFixed(1);
                        console.debug(
                            `[WHIP] ${new Date().toISOString()} ${streamId} ${
                                stat.kind
                            } kbps=${kbps}`
                        );
                    }
                });
            } catch (err) {
                console.error(`[WHIP] stats error for ${streamId}:`, err);
                clearInterval(interval);
            }
        }, 5000);
    } catch (err) {
        console.error("[WHIP] ingest error for", streamId, err);
        res.status(500).send(err.message);
    }
});

//Check if nessesary to have this endpoint
// DELETE /whip/:streamId -- teardown the ingest and all producers/viewers
router.delete("/:streamId", (req, res) => {
    const { streamId } = req.params;
    streamManager.removeStream(streamId);
    res.sendStatus(204);
});

export { router };
