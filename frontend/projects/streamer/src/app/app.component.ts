import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  @ViewChild('videoPreview', { static: true })
  videoPreview!: ElementRef<HTMLVideoElement>;

  private pc!: RTCPeerConnection;
  private mediaStream!: MediaStream;

  constructor() {}

  ngOnInit() {}

  async startWhip() {
    const streamId = 'test-stream';
    const whipUrl = `http://localhost:8090/whip/${streamId}`;

    console.log('🚀 Starting WHIP stream for streamId:', streamId);

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // ICE and connection event logging
    this.pc.oniceconnectionstatechange = () => {
      console.log('❄️ ICE state:', this.pc.iceConnectionState);
    };
    this.pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', this.pc.connectionState);
    };
    this.pc.onicecandidate = (e) => {
      console.log('🧊 ICE candidate:', e.candidate);
    };

    // 🎥 Get local camera stream (only video for now)
    console.log('🎥 Requesting local media stream...');
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log('✅ Got local media stream:', this.mediaStream);

    // Show local preview
    const videoEl = this.videoPreview.nativeElement;
    videoEl.srcObject = this.mediaStream;

    // Add tracks to peer connection
    this.mediaStream.getTracks().forEach((track) => {
      console.log(`➕ Adding ${track.kind} track`);
      this.pc.addTrack(track, this.mediaStream);
    });

    console.log('📜 Creating SDP offer...');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // 🧊 Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      this.pc.addEventListener('icegatheringstatechange', () => {
        if (this.pc.iceGatheringState === 'complete') resolve();
      });
    });

    const preferVP8 = (sdp: string): string => {
      const lines = sdp.split('\n');
      const vp8Payloads = new Set<string>();

      // Collect payloads for VP8
      for (const line of lines) {
        if (line.startsWith('a=rtpmap') && line.toLowerCase().includes('vp8/90000')) {
          const match = line.match(/a=rtpmap:(\d+)/);
          if (match) vp8Payloads.add(match[1]);
        }
      }

      const mVideoIndex = lines.findIndex((l) => l.startsWith('m=video'));
      if (mVideoIndex === -1 || vp8Payloads.size === 0) return sdp;

      // Replace m=video line to only include VP8 payloads
      const parts = lines[mVideoIndex].split(' ');
      const newMLine = [...parts.slice(0, 3), ...[...vp8Payloads]].join(' ');
      lines[mVideoIndex] = newMLine;

      // Filter out all non-VP8-related lines
      const filteredLines = lines.filter((line) => {
        if (!line.startsWith('a=')) return true; // keep non-a lines
        if (line.startsWith('a=rtpmap') || line.startsWith('a=fmtp') || line.startsWith('a=rtcp-fb')) {
          return [...vp8Payloads].some((pt) => line.includes(`:${pt}`));
        }
        return true;
      });

      return filteredLines.join('\n');
    };


    const patchedSdp = preferVP8(this.pc.localDescription!.sdp!);
    console.log('🛠️ Patched SDP with preferred codec (VP8)');

    // Strip non-TCP candidates (for testing purposes)
    const tcpOnlySdp = patchedSdp
      .split('\n')
      .filter((line) => !line.startsWith('a=candidate') || line.includes('tcp'))
      .join('\n');

    // POST to WHIP endpoint
    console.log('📤 Sending SDP offer to WHIP server...');
    const res = await fetch(whipUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: tcpOnlySdp,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('❌ WHIP rejected offer:', err);
      return;
    }

    const answerSdp = await res.text();
    console.log('📥 Received answer from WHIP:\n', answerSdp);

    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      console.log('✅ Remote description set.');
    } catch (e) {
      console.error('❌ Error setting remote description:', e);
      this.pc.close();
      return;
    }

    // Log stats every 2s
    setInterval(() => {
      this.pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            console.log(
              `📈 Outbound video: ssrc=${report.ssrc}, framesSent=${report.framesSent}, bytesSent=${report.bytesSent}`
            );
          }
        });
      });
    }, 2000);

    console.log('🚀 WHIP streaming started!');
  }

  stopStream() {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.pc?.close();
    console.log('🛑 Stream stopped');
  }
}
