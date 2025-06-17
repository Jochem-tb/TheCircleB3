import * as sdpTransform from "sdp-transform";

export function findMediasoupRtpCodec(
  caps,
  payloadType
) {
  return caps.codecs.find(codec => codec.preferredPayloadType === payloadType);
}

export const parseWhipSdp = {
  extractIceParameters(sdp) {
    const media = sdp.media.find(m => m.iceUfrag && m.icePwd);
    if (!media) throw new Error("No ICE parameters in SDP");

    return {
      usernameFragment: media.iceUfrag,
      password: media.icePwd,
      iceLite: !!sdp.icelite,
    };
  },

  extractDtlsParameters(sdp) {
    const media = sdp.media.find(m => m.fingerprint);
    if (!media) throw new Error("No DTLS fingerprint in SDP");

    return {
      role: "auto", // 'auto' lets Mediasoup decide
      fingerprints: [
        {
          algorithm: media.fingerprint.type,
          value: media.fingerprint.hash,
        },
      ],
    };
  },
};

/**
 * Builds a minimal SDP answer for the WHIP client.
 * Note: This does not include actual media tracks.
 */
export function generateWhipAnswerSdp(
  offerSdp,
  transport,
  mediaKinds
) {
  const iceParams = transport.iceParameters;
  const dtlsParams = transport.dtlsParameters;

  const sdp = {
    version: 0,
    origin: {
      address: "127.0.0.1",
      ipVer: 4,
      netType: "IN",
      sessionId: Date.now(),
      sessionVersion: 1,
      username: "whip",
    },
    name: "-",
    timing: { start: 0, stop: 0 },
    connection: { version: 4, ip: "127.0.0.1" },
    icelite: iceParams.iceLite ? "ice-lite" : undefined,
    media: [],
  };

  for (const kind of mediaKinds) {
    const m = offerSdp.media.find(m => m.type === kind);
    if (!m) continue;

    sdp.media.push({
      type: kind,
      port: 7,
      protocol: "UDP/TLS/RTP/SAVPF",
      payloads: m.payloads,
      connection: { version: 4, ip: "0.0.0.0" },
      direction: "recvonly",
      mid: m.mid,
      iceUfrag: iceParams.usernameFragment,
      icePwd: iceParams.password,
      fingerprint: {
        type: dtlsParams.fingerprints[0].algorithm,
        hash: dtlsParams.fingerprints[0].value,
      },
      setup: "passive", // server is passive in WHIP
      rtcpMux: "rtcp-mux",
      rtp: m.rtp,
      fmtp: m.fmtp,
      rtcpFb: m.rtcpFb,
      ext: m.ext,
    });
  }

  return sdpTransform.write(sdp);
}
