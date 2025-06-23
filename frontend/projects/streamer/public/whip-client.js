console.log('WHIP Client Script Loaded');

const video = document.getElementById('preview');
const WHIP_ENDPOINT = 'http://localhost:8081'; // jouw ingest server WHIP URL

const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(async (stream) => {
    video.srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Stap 1: stuur de offer (SDP) naar de WHIP server
    const response = await fetch(WHIP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp'
      },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(`WHIP server antwoordde met ${response.status}`);
    }

    const answerSDP = await response.text();

    // Stap 2: ontvang de answer van de server
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSDP
    });

    console.log('WHIP-stream gestart');
  })
  .catch(console.error);
