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
        if (m.direction !== 'sendonly') continue;

        // 4a) Build a map of payloadType → codec descriptor
        const payloadTypeToCodec = new Map();
        for (const rtp of m.rtp) {
            payloadTypeToCodec.set(rtp.payload, {
            kind: m.type,
            mimeType: `${m.type}/${rtp.codec.toUpperCase()}`,
            payloadType: Number(rtp.payload),
            clockRate: rtp.rate,
            channels: m.type === 'audio' ? 2 : undefined,
            parameters: {},
            rtcpFeedback: m.rtcpFb ?? []
            });
        }

        // 4b) Apply fmtp params to each codec
        for (const fmtp of m.fmtp || []) {
            const pt = Number(fmtp.payload);
            const codec = payloadTypeToCodec.get(pt);
            if (!codec) continue;
            codec.parameters = Object.fromEntries(
            fmtp.config.split(';').map(pair => {
                const [k, v] = pair.trim().split('=');
                return [k, v ?? ''];
            })
            );
        }

        // 4c) Pick only VP8 for video, all for audio
        const codecs = [];
        for (const [pt, codec] of payloadTypeToCodec.entries()) {
            if (m.type === 'video') {
            if (codec.mimeType.toLowerCase() === 'video/vp8') {
                codecs.push(codec);
            } else {
                console.log(`[WHIP] skipping ${codec.mimeType} (payload ${pt})`);
            }
            } else {
            // audio: include all (or filter to 'audio/opus' if you prefer)
            codecs.push(codec);
            }
        }

        console.log(`[WHIP] Final codecs for ${m.type}:`, codecs);

        // 4d) Produce on the transport
        const producer = await transport.produce({
            kind: m.type,
            rtpParameters: {
            codecs,
            encodings: [
                { ssrc: m.ssrc || Math.floor(Math.random() * 1e6) }
            ],
            rtcp: {
                cname: `cname-${streamId}`,
                reducedSize: true,
                mux: true
            }
            },
        });

        stream.addProducer(producer);
        }


        // STEP 5: Build SDP answer for streamId
        console.log("Step 5: Building SDP answer for streamId", streamId);

        const dtls = transport.dtlsParameters;
        const ice = transport.iceParameters;
        const candidates = transport.iceCandidates;
        const fpAnswer =
        dtls.fingerprints.find(f => f.algorithm.toLowerCase() === "sha-256") ||
        dtls.fingerprints[0];

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

        parsed.media.forEach((m, i) => {
        // We want to receive anything the browser sends (sendrecv or sendonly)
        const clientSending = m.direction === "sendrecv" || m.direction === "sendonly";

        // Build a list of payload IDs we actually want to answer (only VP8)
        const payloadsArray = m.rtp
            .filter(r => m.type === "video"
            ? r.codec.toLowerCase() === "vp8"
            : true
            )
            .map(r => String(r.payload));

        // Join into a space-separated string for the m= line
        const payloads = payloadsArray.join(" ");

        // Base media answer object
        const mediaAnswer = {
            type: m.type,
            port: clientSending ? 9 : 0,
            protocol: "UDP/TLS/RTP/SAVPF",
            payloads,
            mid: m.mid || String(i),
            direction: clientSending ? "recvonly" : "inactive",
        };

        if (clientSending) {
            Object.assign(mediaAnswer, {
            connection: { version: 4, ip: "127.0.0.1" },
            // Only include the rtp entries matching our payloadsArray
            rtp: m.rtp.filter(r => payloadsArray.includes(String(r.payload))),
            // Filter fmtp to only VP8
            fmtp: (m.fmtp || []).filter(f => payloadsArray.includes(String(f.payload))),
            // Filter rtcp-fb to only VP8
            rtcpFb: (m.rtcpFb || []).filter(fb => payloadsArray.includes(String(fb.payload))),
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

        answer.media.push(mediaAnswer);
        });

        const answerSdp = sdpTransform.write(answer);
        console.log(`[WHIP] Sending SDP answer for streamId ${streamId}:\n${answerSdp}`);

        res
        .status(201)
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
