import express from "express";
import sdpTransform from "sdp-transform";
import { createTransport } from "./mediasoupManager.js";

const router = express.Router();

router.post("/:streamId", async (req, res) => {
  const { streamId } = req.params;
  console.info(`[WHIP] Received SDP offer for streamId ${streamId}`);
  const sdpOffer = req.body;

  if (!sdpOffer) {
    console.error(`[WHIP] Missing SDP offer for streamId ${streamId}`);
    return res.status(400).send("Missing SDP offer");
  }

  try {
    // 1. create WebRTC transport
    console.info(`[WHIP] Creating WebRTC transport for streamId ${streamId}`);
    const transport = await createTransport(streamId);
    console.info(`[WHIP] Transport created (id=${transport.id}) for streamId ${streamId}`);

    // 2. parse offer for DTLS / ICE info
    console.debug(`[WHIP] Parsing SDP offer:\n${sdpOffer}`);
    const offer = sdpTransform.parse(sdpOffer);
    const media0 = offer.media[0];
    const fpOffer = offer.fingerprint || media0?.fingerprint;
    const iceOfferUfrag = offer.iceUfrag || media0?.iceUfrag;
    const iceOfferPwd = offer.icePwd || media0?.icePwd;

    if (!fpOffer || !iceOfferUfrag || !iceOfferPwd) {
      throw new Error("Offer missing DTLS/ICE fields");
    }

    // 3. connect transport with remote DTLS
    console.info(`[WHIP] Connecting transport for streamId ${streamId} with DTLS parameters`);
    await transport.connect({
      dtlsParameters: {
        role: "auto",
        fingerprints: [{ algorithm: fpOffer.type, value: fpOffer.hash }]
      }
    });

    // 4. produce each sendonly track
    for (const m of offer.media) {
      if (m.direction !== "sendonly") continue;

      const codec = m.rtp?.[0];
      const ssrc = m.ssrcs?.[0]?.id || Math.floor(Math.random() * 1e6);
      console.info(`[WHIP] Producing ${m.type} track (ssrc=${ssrc}) for streamId ${streamId}`);

      const rtpParameters = {
        codecs: [{
          mimeType: m.type === "audio" ? "audio/opus" : "video/H264",
          payloadType: codec.payload,
          clockRate: codec.rate,
          channels: m.type === "audio" ? 2 : undefined,
          parameters: m.fmtp?.[0]?.config
            ? Object.fromEntries(
                m.fmtp[0].config.split(";").map(e => {
                  const [k, v] = e.trim().split("=");
                  return [k, v ?? ""];
                })
              )
            : {},
          rtcpFeedback: m.rtcpFb ?? []
        }],
        encodings: [{ ssrc }]
      };
      console.debug(`[WHIP] RTP parameters for ${m.type}: ${JSON.stringify(rtpParameters)}`);

      await transport.produce({
        kind: m.type,
        rtpParameters
      });
    }

    // 5. build SDP answer
    console.info(`[WHIP] Building SDP answer for streamId ${streamId}`);
    const ice = transport.iceParameters;
    const dtls = transport.dtlsParameters;
    const cands = transport.iceCandidates;
    const fp256 = dtls.fingerprints.find(f => f.algorithm.toLowerCase() === "sha-256") || dtls.fingerprints[0];

    const answer = {
      version : 0,
      origin  : { username:"-", sessionId:0, sessionVersion:0, netType:"IN", ipVer:4, address:"127.0.0.1" },
      name    : "mediasoup",
      timing  : { start:0, stop:0 },
      iceLite : true,
      media   : []
    };

    for (const [idx, m] of offer.media.entries()) {
      if (m.direction !== "sendonly") continue;
      const codec = m.rtp?.[0];
      answer.media.push({
        type       : m.type,
        port       : 7,
        protocol   : "TCP/TLS/RTP/SAVPF",
        payloads   : String(codec.payload),
        connection : { version:4, ip:"127.0.0.1" },
        mid        : m.mid ?? String(idx),
        direction  : "recvonly",
        rtp        : [codec],
        fmtp       : m.fmtp ?? [],
        rtcpFb     : m.rtcpFb ?? [],
        setup      : "active",
        iceUfrag   : ice.usernameFragment,
        icePwd     : ice.password,
        fingerprint: { type: fp256.algorithm, hash: fp256.value },
        candidates : cands.map((c,i) => ({
          foundation: `fnd${i}`,
          component : 1,
          transport : "tcp",  // TCP-only transport mode
          priority  : c.priority,
          ip        : c.ip,
          port      : c.port,
          type      : c.type
        })),
        iceOptions : "ice2",
        rtcpMux    : "rtcp-mux",
        endOfCandidates: "end-of-candidates"
      });
    }

    await new Promise(r => setTimeout(r, 100));
    const sdpAnswer = sdpTransform.write(answer);
    console.debug(`[WHIP] SDP answer constructed:\n${sdpAnswer}`);

    // 6. WHIP-compliant HTTP response
    console.info(`[WHIP] Sending 201 Created with SDP answer for streamId ${streamId}`);
    res.status(201)
       .set("Location", `/whip/${streamId}`)
       .type("application/sdp")
       .send(sdpAnswer);

    // stats logging
    console.info(`[WHIP] Starting periodic stats logging for streamId ${streamId}`);
    const statsInterval = setInterval(async () => {
      try {
        const stats = await transport.getStats();
        stats.forEach(stat => {
          if (stat.bytesReceived !== undefined) {
            const kbps = (stat.bytesReceived / 1000).toFixed(1);
            console.debug(`[WHIP] ${new Date().toISOString()} stream ${streamId} ${stat.kind} kbps=${kbps}`);
          }
        });
      } catch (err) {
        console.error(`[WHIP] Stats logging error for streamId ${streamId}:`, err);
        clearInterval(statsInterval);
      }
    }, 5000);

  } catch (e) {
    console.error(`[WHIP] Error handling offer for streamId ${streamId}:`, e);
    res.status(500).send("Internal server error");
  }
});

export default router;