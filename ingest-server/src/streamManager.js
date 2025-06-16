// import { parse } from "sdp-transform";

export function recordStream(streamId, transport) {
    // Connect FFmpeg to transport RTP ports and record to MP4 or HLS
}

export function forwardStream(streamId, toServiceUrl) {
    // Forward via WebRTC or RTP output
}

import { parse } from "sdp-transform";

export async function handleWebRtcOffer(streamId, transport, sdpOffer) {
    const session = parse(sdpOffer);
    console.log("Transport object:", transport);

    const videoMedia = session.media.find((m) => m.type === "video");
    const audioMedia = session.media.find((m) => m.type === "audio");

    if (!videoMedia && !audioMedia) {
        throw new Error("No audio or video media in SDP");
    }

    const dtlsSource = videoMedia || audioMedia;

    const fingerprintLine = session.fingerprint || dtlsSource.fingerprint;

    if (!fingerprintLine || !fingerprintLine.hash || !fingerprintLine.type) {
        throw new Error("No DTLS fingerprint in SDP");
    }

    const dtlsParameters = {
        role: dtlsSource.setup === "active" ? "server" : "client",
        fingerprints: [
            {
                algorithm: fingerprintLine.type,
                value: fingerprintLine.hash,
            },
        ],
    };

    await transport.connect({ dtlsParameters });

    const iceParameters = transport.iceParameters;
    const iceCandidates = transport.iceCandidates;

    console.log("ICE Candidates:", iceCandidates);

    const candidateLines = transport.iceCandidates.map((c) => {
        return (
            `a=candidate:${c.foundation} ${
                c.component
            } ${c.protocol.toUpperCase()} ${c.priority} ${c.ip} ${c.port} typ ${
                c.type
            }` +
            (c.protocol.toLowerCase() === "tcp" && c.tcpType
                ? ` tcptype ${c.tcpType}`
                : "")
        );
    });

    const sdpLines = [
        "v=0",
        "o=- 0 0 IN IP4 127.0.0.1",
        "s=mediasoup",
        "t=0 0",
        `a=ice-ufrag:${iceParameters.usernameFragment}`,
        `a=ice-pwd:${iceParameters.password}`,
        ...candidateLines,
        "a=end-of-candidates",
        "a=setup:passive",
        `a=fingerprint:${fingerprintLine.type} ${fingerprintLine.hash}`,
    ];

    if (audioMedia) {
        sdpLines.push(
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "c=IN IP4 0.0.0.0",
            "a=mid:audio",
            "a=recvonly",
            "a=rtcp-mux",
            "a=rtpmap:111 opus/48000/2"
        );
    }

    if (videoMedia) {
        sdpLines.push(
            "m=video 9 UDP/TLS/RTP/SAVPF 96",
            "c=IN IP4 0.0.0.0",
            "a=mid:video",
            "a=recvonly",
            "a=rtcp-mux",
            "a=rtpmap:96 H264/90000"
        );
    }

    const sdpAnswer = sdpLines.join("\r\n");

    console.log(`SDP Answer for stream ${streamId}:\n${sdpAnswer}`);

    return sdpAnswer;
}
