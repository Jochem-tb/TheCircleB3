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

    async startWhip() {
        const streamId = 'test-stream'; // Unique ID
        const whipUrl = `http://localhost:8090/whip/${streamId}`;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Get camera & mic
        const media = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        // Attach to preview video if needed
        const videoEl = document.querySelector('video')!;
        videoEl.srcObject = media;

        // Add tracks
        for (const track of media.getTracks()) {
            pc.addTrack(track, media);
        }

        // Set up ICE gathering complete promise
        const iceGatheringComplete = new Promise<void>((resolve) => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    }
                };
            }
        });

        // Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE to complete
        await iceGatheringComplete;

        // Send offer to WHIP server
        const response = await fetch(whipUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: pc.localDescription?.sdp,
        });

        if (!response.ok) {
            console.error('WHIP server rejected offer:', await response.text());
            return;
        }

        const answerSdp = await response.text();
        const answer = new RTCSessionDescription({
            type: 'answer',
            sdp: answerSdp,
        });

        await pc.setRemoteDescription(answer);
        console.log('📡 Streaming live via WHIP!');

        // Optional cleanup on unload
        window.addEventListener('beforeunload', () => pc.close());
    }
}
