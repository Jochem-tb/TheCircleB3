import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
    title = 'streamer';

    ngOnInit() {
        // Any initialization logic can go here
    }

    preferCodec(sdp: string, codec: string) {
        const sdpLines = sdp.split('\n');
        const mLineIndex = sdpLines.findIndex((line) =>
            line.startsWith('m=video ')
        );
        if (mLineIndex === -1) return sdp;

        // Find payload types for the preferred codec (case-insensitive)
        const codecPayloadTypes = sdpLines
            .filter(
                (line) =>
                    line.startsWith('a=rtpmap:') &&
                    line.toLowerCase().includes(codec.toLowerCase())
            )
            .map((line) => line.match(/a=rtpmap:(\d+) /)![1]);

        if (codecPayloadTypes.length === 0) {
            console.warn(`No payload types found for codec ${codec}`);
            return sdp;
        }

        const mLineParts = sdpLines[mLineIndex].split(' '); // e.g. m=video 60289 UDP/TLS/RTP/SAVPF 96 97 103 ...
        const header = mLineParts.slice(0, 3); // m=video 60289 UDP/TLS/RTP/SAVPF
        const payloadTypes = mLineParts.slice(3);

        // Filter out preferred codec payloads and put them first
        const newPayloadTypes = codecPayloadTypes.concat(
            payloadTypes.filter((pt) => !codecPayloadTypes.includes(pt))
        );

        sdpLines[mLineIndex] = [...header, ...newPayloadTypes].join(' ');

        return sdpLines.join('\n');
    }

    async startWhip() {
        const streamId = 'test-stream';
        const whipUrl = `http://localhost:8090/whip/${streamId}`;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Log state changes
        pc.addEventListener('iceconnectionstatechange', () => {
            console.log('❄️ ICE connection state:', pc.iceConnectionState);
        });

        pc.addEventListener('connectionstatechange', () => {
            console.log('🔌 Peer connection state:', pc.connectionState);
        });

        // Set up repeated stats logging
        const statsInterval = setInterval(() => {
            pc.getStats().then((stats) => {
                stats.forEach((report) => {
                    if (
                        report.type === 'candidate-pair' &&
                        report.state === 'succeeded'
                    ) {
                        console.log('✅ ICE Candidate Pair Selected:', report);
                    }
                    if (report.type === 'outbound-rtp') {
                        console.log(
                            `📈 Outbound stats (${report.mediaType}):`,
                            report
                        );
                    }
                });
            });
        }, 3000);

        pc.ontrack = (event) => {
            console.log('📥 Received track:', event.track.kind);
            const track = event.track;
            track.onunmute = () => {
                console.log('📡 Track is unmuted and receiving data');
                // Optional: start recording or forwarding media
            };
        };

        // Get user media
        const media = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
        });

        console.log('🎥 Got media stream:', media);

        // Show preview
        const videoEl = document.querySelector('video')!;
        videoEl.srcObject = media;

        // Add media tracks to connection
        media.getTracks().forEach((track) => {
            console.log(`🎙️ Adding track: ${track.kind}`);
            pc.addTrack(track, media);
        });

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let patchedSdp = this.preferCodec(pc.localDescription!.sdp!, 'H264');

        console.log('📶 Signaling state after offer:', pc.signalingState);

        // Wait for ICE gathering to complete
        await new Promise<void>((resolve) => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                pc.addEventListener('icegatheringstatechange', () => {
                    console.log(
                        '🌐 ICE gathering state:',
                        pc.iceGatheringState
                    );
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    }
                });
            }
        });

        // Patch SDP to keep only TCP candidates
        const localSdp = pc.localDescription!.sdp!;
        //use the patchedSdp instead of localSdp

        const tcpOnlySdp = patchedSdp
            .split('\n')
            .filter(
                (line) =>
                    !line.startsWith('a=candidate') || line.includes('tcp')
            )
            .join('\n');

        console.log('📡 Sending TCP-only SDP offer');
        console.log('patchedSdp:', patchedSdp);

        // Send offer to WHIP server
        const response = await fetch(whipUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: tcpOnlySdp,
        });

        if (!response.ok) {
            console.error(
                '❌ WHIP server rejected offer:',
                await response.text()
            );
            return;
        }

        const answerSdp = await response.text();
        console.log('📡 Received SDP answer from server');
        console.log('AnswerSdp: ' + answerSdp);

        try {
            await pc.setRemoteDescription(
                new RTCSessionDescription({
                    type: 'answer',
                    sdp: answerSdp,
                })
            );
        } catch (e) {
            console.error('❌ Failed to set remote description:', e);
            clearInterval(statsInterval);
            pc.close();
            return;
        }

        console.log(
            '📡 Connection setup complete! Streaming should begin now.'
        );

        // Clean up on unload
        window.addEventListener('beforeunload', () => {
            clearInterval(statsInterval);
            pc.close();
        });
    }
}
