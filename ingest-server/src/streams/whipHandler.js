import express from "express";
import sdpTransform from "sdp-transform";
import streamManager from "./StreamManager.js";
import {
    createIngestTransport,
    getIngestTransport,
} from "../mediasoup/transportManager.js";
import { getRouter } from "../mediasoup/routerManager.js";

const router = express.Router();

router.post("/:streamId", async (req, res) => {
    const { streamId } = req.params;
    const sdpOffer = req.body;

    try {
        // STEP 1: Parse SDP offer
        console.log(`[WHIP] Received SDP offer for streamId ${streamId}`);
        const parsed = sdpTransform.parse(sdpOffer);
        const media0 = parsed.media[0];

        // Extract ICE and DTLS params from SDP offer (handle fallback)
        console.log(`[WHIP] Parsing SDP offer for streamId ${streamId}`);
        const fingerprint = parsed.fingerprint || media0?.fingerprint;
        const iceUfrag = parsed.iceUfrag || media0?.iceUfrag;
        const icePwd = parsed.icePwd || media0?.icePwd;

        if (!fingerprint || !iceUfrag || !icePwd) {
            throw new Error("Missing DTLS or ICE information in SDP offer");
        }

        // STEP 2: Create stream and transport if not exists
        console.log(
            "Step 2: Creating stream and transport for streamId",
            streamId
        );
        if (!streamManager.hasStream(streamId)) {
            await streamManager.createStream(streamId);

            const transport = await createIngestTransport(streamId);

            transport.on("dtlsstatechange", (state) => {
                if (state === "closed") streamManager.removeStream(streamId);
            });

            transport.on("icestatechange", (state) => {
                console.log(`[WHIP] ICE state for ${streamId}:`, state);
            });

            transport.on("trace", (trace) => {
                console.debug(`[TRACE] ${streamId}`, trace);
            });
        }

        const stream = streamManager.getStream(streamId);
        const transport = getIngestTransport(streamId);

        // STEP 3: Connect transport with DTLS params from offer
        console.log("Step 3: Connecting transport for streamId");
        await transport.connect({
            dtlsParameters: {
                role: "auto",
                fingerprints: [
                    { algorithm: fingerprint.type, value: fingerprint.hash },
                ],
            },
            // mediasoup expects iceParameters here as well
            iceParameters: {
                usernameFragment: iceUfrag,
                password: icePwd,
                iceLite: true,
            },
        });

        // STEP 4: Produce tracks
        console.log("Step 4: Producing tracks for streamId", streamId);
        for (const m of parsed.media) {
            const codecs = [];
            const payloadTypeToCodec = new Map();

            // Build a map of payloadType -> codec info
            for (const rtp of m.rtp) {
                const codec = {
                    kind: m.type,
                    mimeType: `${m.type}/${rtp.codec.toUpperCase()}`,
                    payloadType: rtp.payload,
                    clockRate: rtp.rate,
                    channels: m.type === "audio" ? 2 : undefined,
                    parameters: {},
                    rtcpFeedback: m.rtcpFb ?? [],
                };

                payloadTypeToCodec.set(rtp.payload, codec);
            }

            // Parse fmtp config and apply to codecs
            for (const fmtp of m.fmtp ?? []) {
                const codec = payloadTypeToCodec.get(fmtp.payload);
                if (!codec) continue;

                const params = Object.fromEntries(
                    fmtp.config.split(";").map((e) => {
                        const [k, v] = e.trim().split("=");
                        return [k, v ?? ""];
                    })
                );

                codec.parameters = params;
            }

            for (const pt of m.payloads.split(" ")) {
                const payload = Number(pt);
                const codec = payloadTypeToCodec.get(payload);
                if (!codec) continue;

                // If it's RTX, make sure apt (associated payload type) exists
                if (
                    codec.mimeType.toLowerCase().includes("rtx") &&
                    codec.parameters?.apt &&
                    !payloadTypeToCodec.has(Number(codec.parameters.apt))
                ) {
                    console.log(
                        `[WHIP] Skipping invalid RTX payload=${pt} with missing apt=${codec.parameters?.apt}`
                    );
                    continue;
                }

                codecs.push(codec);
            }

            console.log(`[WHIP] Final codecs for ${m.type}:`, codecs);

            // 🔥 Call transport.produce() here!
            const producer = await transport.produce({
                kind: m.type,
                rtpParameters: {
                    codecs,
                    encodings: [{ ssrc: m.ssrc }],
                    rtcp: {
                        cname: m.rtcp?.cname || `CNAME-${streamId}`,
                        reducedSize: true,
                        mux: true,
                    },
                },
            });

            stream.addProducer(producer); // Optional: store reference
        }

        // STEP 5: Build SDP answer with proper direction (recvonly)
        console.log("Step 5: Building SDP answer for streamId", streamId);
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
            const codec = m.rtp[0];
            const isSendOnly = m.direction === "sendonly";

            const mediaAnswer = {
                type: m.type,
                port: isSendOnly ? 7 : 0,
                protocol: "UDP/TLS/RTP/SAVPF",
                payloads: codec ? String(codec.payload) : "",
                mid: m.mid || String(i),
                direction: isSendOnly ? "recvonly" : "inactive",
            };

            if (isSendOnly) {
                mediaAnswer.connection = { version: 4, ip: "127.0.0.1" };
                mediaAnswer.rtp = [codec];
                mediaAnswer.fmtp = m.fmtp || [];
                mediaAnswer.rtcpFb = m.rtcpFb || [];
                mediaAnswer.setup = "active";
                mediaAnswer.iceUfrag = ice.usernameFragment;
                mediaAnswer.icePwd = ice.password;
                mediaAnswer.fingerprint = {
                    type: fpAnswer.algorithm,
                    hash: fpAnswer.value,
                };
                mediaAnswer.candidates = candidates.map((c, idx) => ({
                    foundation: `fnd${idx}`,
                    component: 1,
                    transport: c.protocol,
                    priority: c.priority,
                    ip: c.ip,
                    port: c.port,
                    type: c.type,
                }));
                mediaAnswer.endOfCandidates = "end-of-candidates";
                mediaAnswer.iceOptions = "ice2";
                mediaAnswer.rtcpMux = "rtcp-mux";
            }

            answer.media.push(mediaAnswer);
        }

        const answerSdp = sdpTransform.write(answer);

        // STEP 6: Send SDP answer
        console.log(
            `[WHIP] Sending SDP answer for streamId ${streamId}:\n${answerSdp}`
        );
        res.status(201)
            .set("Location", `/whip/${streamId}`)
            .type("application/sdp")
            .send(answerSdp);

        // (Optional) Logging and stats can be handled elsewhere
    } catch (err) {
        console.error("[WHIP] ingest error for", streamId, err);
        res.status(500).send(err.message);
    }

    setInterval(async () => {
        try {
            const stats = await getIngestTransport(streamId).getStats();
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
        }
    }, 3000);
});

//Check if nessesary to have this endpoint
// DELETE /whip/:streamId -- teardown the ingest and all producers/viewers
router.delete("/:streamId", (req, res) => {
    const { streamId } = req.params;
    streamManager.removeStream(streamId);
    res.sendStatus(204);
});

export { router };
