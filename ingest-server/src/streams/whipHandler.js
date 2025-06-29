// File: ingest-server/src/streams/whipHandler.js
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

    console.log(`[WHIP] Received SDP offer for streamId ${streamId}`);
    console.log(`[WHIP] SDP Offer:\n${sdpOffer}`);

    try {
        // STEP 1: Parse SDP offer
        console.log(`[WHIP] Received SDP offer for streamId ${streamId}`);
        const parsed = sdpTransform.parse(sdpOffer);
        console.log(`[WHIP] Parsed SDP Offer:\n`, JSON.stringify(parsed, null, 2));
        const media0 = parsed.media[0];
        if (media0) {
            console.log(
                `[WHIP] Media 0: type=${media0.type}, mid=${media0.mid}, direction=${media0.direction}`
            );
            console.log(
                `[WHIP] Media 0 RTP:`, media0.rtp.map(
                    (r) => `${r.payload} ${r.codec} ${r.rate}`
                ).join(", ")
            );
        } else {
            console.warn(`[WHIP] No media found in SDP offer for streamId ${streamId}`);
        }

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

            if (!getIngestTransport(streamId)) {
                await createIngestTransport(streamId);
            }
            const transport = getIngestTransport(streamId);

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
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }
        console.log(
            `[WHIP] Stream ${streamId} exists, using existing transport`
        );
        const transport = getIngestTransport(streamId);


        const router = getRouter(streamId);
        if (router) {
            console.log(`[WHIP] Router RTP capabilities for streamId ${streamId}:`);
            console.log(JSON.stringify(router.rtpCapabilities, null, 2));
        } else {
            console.warn(`[WHIP] No router found for streamId ${streamId}`);
        }

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
            // if (m.direction !== "sendonly") continue;

            // 4a) Build a map of payloadType → codec descriptor
            const payloadTypeToCodec = new Map();
            for (const rtp of m.rtp) {
                payloadTypeToCodec.set(rtp.payload, {
                    kind: m.type,
                    mimeType: `${m.type}/${rtp.codec.toUpperCase()}`,
                    payloadType: Number(rtp.payload),
                    clockRate: rtp.rate,
                    channels: m.type === "audio" ? 2 : undefined,
                    parameters: {},
                    rtcpFeedback: m.rtcpFb ?? [],
                });
            }

            // 4b) Apply fmtp params to each codec
            for (const fmtp of m.fmtp || []) {
                const pt = Number(fmtp.payload);
                const codec = payloadTypeToCodec.get(pt);
                if (!codec) continue;
                codec.parameters = Object.fromEntries(
                    fmtp.config.split(";").map((pair) => {
                        const [k, v] = pair.trim().split("=");
                        return [k, v ?? ""];
                    })
                );
            }

            // 4c) Pick only VP8 for video, all for audio
            const codecs = [];
            for (const [pt, codec] of payloadTypeToCodec.entries()) {
                if (m.type === "video" && codec.mimeType.toLowerCase() === "video/vp8") {
                    codecs.push(codec);
                } else {
                    console.log(`[WHIP] Skipping unsupported codec: ${codec.mimeType}`);
                }
            }

            console.log(`[WHIP] Final codecs for ${m.type}:`, codecs);

            console.log(`[WHIP] Will produce with SSRC:`, m.ssrc);
            if (m.ssrc && m.ssrc < 1) {
                console.warn(`[WHIP] SSRC ${m.ssrc} is invalid, generating random SSRC`);
                m.ssrc = Math.floor(Math.random() * 1e6);
            }

            // Zoek de SSRC-line met cname attribuut
            const ssrcLine = m.ssrcs?.find((s) => s.attribute === 'cname');

            const ssrcFromLine = ssrcLine?.id ? Number(ssrcLine.id) : undefined;
            const finalSsrc = m.ssrc || ssrcFromLine || Math.floor(Math.random() * 1e6);

            const producer = await transport.produce({
            kind: m.type,
            rtpParameters: {
                codecs,
                encodings: [
                { ssrc: finalSsrc }
                ],
                rtcp: {
                cname: `cname-${streamId}`,
                reducedSize: true,
                mux: true,
                },
            },
            });

            console.log("Poducer paused?", producer.paused);

            console.log(`[WHIP] Producer created: ${producer.id}, kind=${producer.kind}`);
            console.log(`[WHIP] Producer RTP parameters:`, producer.rtpParameters);

            // Add periodic stats logging for the producer
            setInterval(async () => {
            const stats = await producer.getStats();
                stats.forEach((report) => {
                    console.log(`[WHIP] Producer stats: ssrc=${report.ssrc}, type=${report.type}, kind=${report.kind}, packetsSent=${report.packetsSent}, bytesSent=${report.bytesSent}`);
                });
            }, 2000);


            console.log(`[WHIP] Using SSRC: ${m.ssrc}`);

            const stats = await producer.getStats();
            console.log(`[WHIP] Producer stats:`, stats);

            const stream = streamManager.getStream(streamId);
            if (!stream) {
                console.error(
                    `❌ Stream ${streamId} not found when registering producer`
                );
            } else {
                console.log(
                    `[WHIP] Registering producer ${producer.id} to stream ${streamId}`
                );
                stream.setProducer(producer);
            }
        }

        // STEP 5: Build SDP answer for streamId
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

        parsed.media.forEach((m, i) => {
            const clientSending = m.direction === "sendrecv" || m.direction === "sendonly";

            const payloadsArray = m.rtp
                .filter((r) => m.type === "video" && r.codec.toLowerCase() === "vp8")
                .map((r) => String(r.payload));

            const payloads = payloadsArray.join(" ");

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
                    rtp: m.rtp.filter((r) => payloadsArray.includes(String(r.payload))),
                    fmtp: (m.fmtp || []).filter((f) => payloadsArray.includes(String(f.payload))),
                    rtcpFb: (m.rtcpFb || []).filter((fb) => payloadsArray.includes(String(fb.payload))),
                    setup: "active",
                    iceUfrag: ice.usernameFragment,
                    icePwd: ice.password,
                    fingerprint: {
                        type: fpAnswer.algorithm,
                        hash: fpAnswer.value,
                    },
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
    // Above your interval, keep a map of last bytes & time per transport kind
    // Track last stats per stream
    const lastStats = new Map();

    /** Called every N milliseconds */
    async function logRate(streamId) {
        // If stream is gone, stop logging
        if (!streamManager.hasStream(streamId)) return;

        const now = Date.now();
        let transport;
        try {
            transport = getIngestTransport(streamId);
            if (!transport) return;
        } catch (e) {
            // Transport not found, stop logging
            return;
        }

        let stats;
        try {
            stats = await transport.getStats();
        } catch (err) {
            // Error getting stats, stop logging
            return;
        }

        stats.forEach((stat) => {
            if (stat.bytesReceived === undefined) return;

            // Use stat.id (or stat.kind) as the key
            const key = `${streamId}:${stat.kind}`;
            const prev = lastStats.get(key);

            if (prev) {
                const deltaBytes = stat.bytesReceived - prev.bytes;
                const deltaSecs = (now - prev.timestamp) / 1000;
                // bytes → bits → kilobits
                const kbps = ((deltaBytes * 8) / deltaSecs / 1000).toFixed(1);
                console.debug(
                    `[WHIP] ${new Date().toISOString()} ${streamId} ${
                        stat.kind
                    } kbps=${kbps}`
                );
            }

            // Store current for next round
            lastStats.set(key, {
                bytes: stat.bytesReceived,
                timestamp: now,
            });
        });
    }

    // Interval handle so we can clear it if needed
    const statsInterval = setInterval(() => {
        // If stream is gone, clear interval
        if (!streamManager.hasStream(streamId)) {
            clearInterval(statsInterval);
            return;
        }
        logRate(streamId).catch((err) => {
            console.error(`[WHIP] stats error for ${streamId}:`, err);
            clearInterval(statsInterval);
        });
    }, 10000);
});


//Check if nessesary to have this endpoint
// DELETE /whip/:streamId -- teardown the ingest and all producers/viewers
router.delete("/:streamId", (req, res) => {
    const { streamId } = req.params;
    streamManager.removeStream(streamId);
    res.sendStatus(204);
});

export { router };
