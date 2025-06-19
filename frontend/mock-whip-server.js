// mock-whip-server.js
import http from 'http';

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let sdpOffer = '';
    req.on('data', chunk => (sdpOffer += chunk));
    req.on('end', () => {
      console.log('Ontvangen SDP-offer:');
      console.log(sdpOffer);

      // Stuur een dummy SDP-answer terug (je kunt ook echt SDP genereren met mediasoup / pion / etc.)
      const dummyAnswer = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=WHIP Test
t=0 0
m=video 9 UDP/TLS/RTP/SAVPF 96
c=IN IP4 0.0.0.0
a=rtcp-mux
a=recvonly
a=rtpmap:96 VP8/90000`;

      res.writeHead(200, { 'Content-Type': 'application/sdp' });
      res.end(dummyAnswer);
    });
  } else {
    res.writeHead(405);
    res.end();
  }
});

server.listen(8080, () => {
  console.log('Mock WHIP server draait op http://localhost:8080');
});
