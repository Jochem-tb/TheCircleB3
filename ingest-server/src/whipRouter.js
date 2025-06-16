import express from "express";
import sdpTransform from "sdp-transform";
import { createTransport } from "./mediasoupManager.js";

const router = express.Router();

router.post("/:streamId", async (req, res) => {
  const { streamId } = req.params;
  const sdpOffer = req.body;

  if (!sdpOffer) return res.status(400).send("Missing SDP offer");

  try {
    // 1. create WebRTC transport
    const transport = await createTransport(streamId);

    // 2. parse offer for DTLS / ICE info
    const offer         = sdpTransform.parse(sdpOffer);
    const media0        = offer.media[0];
    const fpOffer       = offer.fingerprint || media0?.fingerprint;
    const iceOfferUfrag = offer.iceUfrag    || media0?.iceUfrag;
    const iceOfferPwd   = offer.icePwd      || media0?.icePwd;

    if (!fpOffer || !iceOfferUfrag || !iceOfferPwd)
      throw new Error("Offer missing DTLS/ICE fields");

    // 3. connect transport with remote DTLS
    await transport.connect({
      dtlsParameters: {
        role: "auto",
        fingerprints: [{ algorithm: fpOffer.type, value: fpOffer.hash }]
      }
    });

    // 4. produce every sendonly track from OBS
    for (const m of offer.media) {
      if (m.direction !== "sendonly") continue;

      const codec = m.rtp?.[0];
      const ssrc  = m.ssrcs?.[0]?.id || Math.floor(Math.random() * 1e6);

      await transport.produce({
        kind: m.type,
        rtpParameters: {
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
        }
      });
    }

    // 5. build SDP answer
    const ice   = transport.iceParameters;
    const dtls  = transport.dtlsParameters;
    const cands = transport.iceCandidates;

    const fp256 = dtls.fingerprints.find(f => f.algorithm.toLowerCase() === "sha-256")
               || dtls.fingerprints[0];

    const answer = {
      version : 0,
      origin  : { username:"-", sessionId:0, sessionVersion:0, netType:"IN", ipVer:4, address:"127.0.0.1" },
      name    : "mediasoup",
      timing  : { start:0, stop:0 },
      iceLite : true,
      media   : []
    };

    // replicate each media section
    for (const [idx, m] of offer.media.entries()) {
      if (m.direction !== "sendonly") continue;

      const codec = m.rtp?.[0];

      answer.media.push({
        type       : m.type,
        port       : 7,
        protocol   : "UDP/TLS/RTP/SAVPF",
        payloads   : String(codec.payload),
        connection : { version:4, ip:"127.0.0.1" },
        mid        : m.mid ?? String(idx),
        direction  : "recvonly",
        rtp        : [codec],
        fmtp       : m.fmtp ?? [],
        rtcpFb     : m.rtcpFb ?? [],
        setup      : "active",           // server = DTLS client
        iceUfrag   : ice.usernameFragment,
        icePwd     : ice.password,
        fingerprint: { type: fp256.algorithm, hash: fp256.value },
        candidates : cands.map((c,i) => ({
          foundation:`fnd${i}`, component:1, transport:c.protocol,
          priority:c.priority, ip:c.ip, port:c.port, type:c.type
        })),
        iceOptions : "ice2",
        rtcpMux    : "rtcp-mux",
        endOfCandidates: "end-of-candidates"
      });
    }

    // small wait helps candidate gathering
    await new Promise(r => setTimeout(r, 100));

    const sdpAnswer = sdpTransform.write(answer);

    // 6. WHIP-compliant HTTP response
    res.status(201)
       .set("Location", `/whip/${streamId}`)
       .type("application/sdp")
       .send(sdpAnswer);

    const stats = await transport.getStats();
    console.log(stats); // bytesReceived en packetsReceived lopen op
    console.log(`WHIP stream ${streamId} started successfully`);

  } catch (e) {
    console.error("WHIP error:", e);
    res.status(500).send("Internal server error");
  }
});

export default router;
