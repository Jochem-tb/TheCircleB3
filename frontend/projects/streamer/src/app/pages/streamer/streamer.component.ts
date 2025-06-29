import {
    Component,
    OnInit,
    OnDestroy,
    ViewChild,
    ElementRef,
    AfterViewChecked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CookieService } from '../../services/cookie.service';
import { Subscription, interval } from 'rxjs';
import * as mediasoupClient from 'mediasoup-client';
import { ChatService, ChatMessage } from '../../services/chat.service';

@Component({
    selector: 'app-streamer',
    templateUrl: './streamer.component.html',
    styleUrls: ['./streamer.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule, HttpClientModule],
})
export class StreamerComponent implements OnInit, OnDestroy, AfterViewChecked {
    @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('chatLog') private chatLog!: ElementRef;

    messages: ChatMessage[] = [];
    newMessage: string = '';
    chatError: string | null = null;

    streamerId: string = '';
    userName: string = '';
    privateKey: string = '';
    showPopup: boolean = false;
    isLoggedIn: boolean = false;
    dropdownOpen: boolean = false;
    private authSubscription!: Subscription;
    private followerInterval!: Subscription;
    private device!: mediasoupClient.Device;
    private socket!: WebSocket;
    private sendTransport!: mediasoupClient.types.Transport;
    private stream!: MediaStream;
    private videoTrack!: MediaStreamTrack;
    private audioTrack!: MediaStreamTrack;

    isStreaming = false;
    isVideoOn = false;
    isAudioOn = false;
    mediaStreamAvailable = false;
    roomCreated = false;
    deviceLoaded = false;
    followerCount: number = 0;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private http: HttpClient,
        private cookieService: CookieService,
        private chatService: ChatService
    ) {}

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    ngOnInit(): void {
        // Subscribe to authentication status
        this.authSubscription = this.cookieService.authenticated$.subscribe(
            (isAuth) => {
                this.isLoggedIn = isAuth;
                if (isAuth) {
                    // Retrieve username from cookie or server if needed
                    const cookie =
                        this.cookieService.getCookie('streamer_auth');
                    if (cookie) {
                        try {
                            const data = JSON.parse(cookie);
                            this.streamerId = data.username || this.userName; // Set streamerId to username
                            this.initWebSocket();
                            this.chatService.connect(this.streamerId);
                            this.chatService.messages$.subscribe((msg) => {
                                this.messages.push(msg);
                                // Optional: auto scroll chat div (you can implement later)
                            });

                            // Subscribe to chat errors
                            this.chatService.connectionError$.subscribe(
                                (err) => {
                                    this.chatError = err;
                                }
                            );

                            this.followerInterval = interval(60000).subscribe(
                                () => {
                                    if (
                                        this.isLoggedIn &&
                                        this.socket?.readyState ===
                                            WebSocket.OPEN
                                    ) {
                                        this.send({
                                            type: 'get-follower-count',
                                            streamerId: this.streamerId,
                                        });
                                    }
                                }
                            );
                        } catch (e) {
                            console.error('Error parsing auth cookie:', e);
                        }
                    }
                } else {
                    this.messages = [];
                    this.chatService.disconnect();
                }
            }
        );

        // Check initial auth status
        this.isLoggedIn = this.cookieService.checkAuthCookie();
        if (!this.isLoggedIn) {
            this.showPopup = true; // Show login popup if not authenticated
        }
    }

    ngOnDestroy(): void {
        if (this.authSubscription) {
            this.authSubscription.unsubscribe();
        }
        if (this.socket) {
            this.socket.close();
        }

        this.chatService.disconnect();
    }

    // Login popup and authentication
    onProfileClick(): void {
        console.log('Profile clicked');
        this.showPopup = true;
    }

    async onSubmit(): Promise<void> {
        if (!this.userName || !this.privateKey) {
            alert('Please provide username and private key file');
            return;
        }

        try {
            // Step 1: Get challenge and public key from server
            const resp: any = await this.http
                .get(
                    `http://localhost:3000/auth/challenge?username=${this.userName}`
                )
                .toPromise();

            const { challenge, public_key } = resp;

            // Step 2: Sign the challenge using the private key
            const signature = await this.signChallenge(
                challenge,
                this.privateKey
            );

            // Step 3: Send signature + username + public_key to authenticate endpoint
            const payload = {
                username: this.userName,
                signature,
                public_key,
            };

            console.log('Sending authentication payload:', payload);

            interface AuthResponse {
                authenticated: boolean;
                username: string;
            }

            const authResp = await this.http
                .post<AuthResponse>(
                    'http://localhost:3000/auth/authenticate',
                    payload
                )
                .toPromise();

            console.log('Authentication response:', authResp);

            if (authResp && authResp.authenticated) {
                this.cookieService.setAuthCookie(this.userName);
                this.isLoggedIn = true;
                this.streamerId = this.userName; // Set streamerId to authenticated username
                this.initWebSocket(); // Initialize WebSocket after login
                alert('Authentication successful!');
                this.userName = '';
                this.privateKey = '';
                this.showPopup = false;
            }
        } catch (err) {
            console.error('Error during authentication:', err);
            alert('Authentication failed. See console for details.');
            this.router.navigate(['/']); // Redirect to home on failure
        }
    }

    closePopup(): void {
        this.showPopup = false;
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = () => {
            this.privateKey = (reader.result as string).trim();
            console.log('Private key loaded:', this.privateKey);
        };

        reader.onerror = () => {
            console.error('Error reading file');
        };

        reader.readAsText(file);
    }

    async signChallenge(
        challenge: string,
        privateKeyPem: string
    ): Promise<string> {
        const pemContents = privateKeyPem
            .replace(/-----BEGIN PRIVATE KEY-----/, '')
            .replace(/-----END PRIVATE KEY-----/, '')
            .replace(/\r?\n|\r/g, '')
            .trim();

        const binaryDer = Uint8Array.from(window.atob(pemContents), (c) =>
            c.charCodeAt(0)
        );

        const key = await window.crypto.subtle.importKey(
            'pkcs8',
            binaryDer.buffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' },
            },
            false,
            ['sign']
        );

        const data = this.hexToUint8Array(challenge);

        const signature = await window.crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            key,
            data
        );

        return this.arrayBufferToBase64(signature);
    }

    arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    hexToUint8Array(hex: string): Uint8Array {
        if (hex.length % 2 !== 0) {
            throw new Error('Invalid hex string');
        }
        const array = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            array[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return array;
    }

    toggleDropdown(): void {
        this.dropdownOpen = !this.dropdownOpen;
    }

    closeDropdown(): void {
        this.dropdownOpen = false;
    }

    logout(): void {
        console.log('Logout clicked');
        this.cookieService.clearAuthCookie();
        this.isLoggedIn = false;
        this.streamerId = '';
        this.dropdownOpen = false;
        this.showPopup = true; // Show login popup after logout
        if (this.socket) {
            this.socket.close();
        }
        this.router.navigate(['/']);
    }

    private initWebSocket(): void {
        // Establish a WebSocket connection
        console.log('Connecting WebSocket...');
        this.socket = new WebSocket('ws://localhost:3002');

        this.socket.onopen = () => {
            console.log('WebSocket connected');
        };

        this.socket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);

            // Handle the different message types from the server
            switch (message.type) {
                case 'room-created':
                    this.roomCreated = true;
                    console.log(
                        'Room created, requesting router RTP capabilities...'
                    );
                    this.send({
                        type: 'get-router-rtp-capabilities',
                        streamerId: this.streamerId,
                    });
                    break;

                case 'router-rtp-capabilities':
                    await this.loadDevice(message.data);
                    this.deviceLoaded = true;
                    this.send({
                        type: 'create-streamer-transport',
                        streamerId: this.streamerId,
                    });
                    break;

                case 'streamer-transport-created':
                    await this.createSendTransport(message.params);
                    break;

                case 'streamer-transport-connected':
                    console.log('Streamer transport connected');
                    break;

                case 'produced':
                    console.log('Stream produced, ID:', message.id);
                    break;

                case 'follower-count-update':
                    this.followerCount = message.count;
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private send(msg: any): void {
        const userId = localStorage.getItem('userId'); // <-- username uit login
        const enrichedMsg = { ...msg, userId };

        if (this.socket.readyState === WebSocket.OPEN) {
            console.log('Sending message to server:', enrichedMsg);
            this.socket.send(JSON.stringify(enrichedMsg));
        } else {
            console.warn('Tried to send message but socket not open');
        }
    }

    async getMediaStream(): Promise<void> {
        try {
            // 1. Request media from the user
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.videoRef.nativeElement.srcObject = this.stream;
            this.mediaStreamAvailable = true;

            // 2. Store the individual tracks so toggleXxx() can see them
            const videoTracks = this.stream.getVideoTracks();
            const audioTracks = this.stream.getAudioTracks();
            if (videoTracks.length) this.videoTrack = videoTracks[0];
            if (audioTracks.length) this.audioTrack = audioTracks[0];

            console.log('Video track:', this.videoTrack);
            console.log('Audio track:', this.audioTrack);
            this.isAudioOn = this.audioTrack?.enabled ?? false;
            this.isVideoOn = this.videoTrack?.enabled ?? false;
        } catch (err) {
            console.error('Failed to get media stream:', err);
        }
    }

    async startStreaming(): Promise<void> {
        // Start streaming only if media stream is available
        if (!this.stream || !this.mediaStreamAvailable) {
            console.warn(
                'Media stream not ready. Call getMediaStream() first.'
            );
            return;
        }

        // if (this.socket) {
        //     // Ensure WebSocket is connected
        //     console.warn('WebSocket not connected. Reconnecting...');
        //     this.initWebSocket();
        // }

        if (!this.roomCreated) {
            // Create room if not already created
            console.log('Creating room...');
            this.send({ type: 'create-room', streamerId: this.streamerId });
        }

        const waitUntilReady = async () => {
            let retries = 20;
            while (
                (!this.deviceLoaded || !this.sendTransport) &&
                retries-- > 0
            ) {
                console.log('Waiting for device & transport to be ready...');
                await new Promise((r) => setTimeout(r, 300));
            }
        };

        await waitUntilReady();

        if (!this.sendTransport) {
            console.error('Send transport not ready after waiting.');
            return;
        }

        // Start streaming if everything is ready
        console.log('Starting stream...');
        try {
            for (const track of this.stream.getTracks()) {
                await this.sendTransport.produce({ track });
                console.log(`Track produced: ${track.kind}`);
            }
            this.isStreaming = true;
            this.isVideoOn = true; // Assume video is on if we are streaming
            this.isAudioOn = true; // Assume audio is on if we are streaming
        } catch (err) {
            console.error('Error while producing tracks:', err);
        }
    }

    stopStreaming(): void {
        // Stop mediasoup send transport and close it properly
        console.log('Stopping stream...');
        this.toggleVideo(); // Ensure video track is disabled
        this.toggleAudio(); // Ensure audio track is disabled
        setTimeout(() => {
            // Ensure that the last frame we send is black, not a weird picture

            // if (this.sendTransport) {
            //     try {
            //         this.sendTransport.close();
            //         console.log('Send transport closed');
            //     } catch (e) {
            //         console.warn('Error closing send transport:', e);
            //     }
            //     this.sendTransport = undefined!;
            // }

            // Stop all media tracks (video and audio)
            if (this.stream) {
                this.stream.getTracks().forEach((track) => {
                    track.stop();
                    console.log(`Track stopped: ${track.kind}`);
                });
            }

            // Clear video element srcObject
            if (this.videoRef?.nativeElement) {
                this.videoRef.nativeElement.srcObject = null;
            }

            // // Close WebSocket connection if needed
            // if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            //     this.socket.close();
            //     console.log('WebSocket connection closed');
            // }

            // Reset flags
            this.isStreaming = false;
            this.isVideoOn = false;
            this.isAudioOn = false;
            this.mediaStreamAvailable = false;

            // Clear local media references
            this.stream = undefined!;
            this.videoTrack = undefined!;
            this.audioTrack = undefined!;
        }, 300);
    }

    private async loadDevice(routerRtpCapabilities: any): Promise<void> {
        // Load the device with RTP capabilities
        this.device = new mediasoupClient.Device();
        await this.device.load({ routerRtpCapabilities });
        console.log('Mediasoup device loaded');
    }

    private async createSendTransport(params: any): Promise<void> {
        // Create transport for sending media
        console.log('Creating send transport...');
        this.sendTransport = this.device.createSendTransport(params);

        this.sendTransport.on('connect', ({ dtlsParameters }, callback) => {
            console.log('Connecting send transport...');
            this.send({
                type: 'connect-streamer-transport',
                dtlsParameters,
                streamerId: this.streamerId,
            });
            callback();
        });

        this.sendTransport.on(
            'produce',
            ({ kind, rtpParameters }, callback) => {
                console.log(`Producing track: ${kind}`);
                this.send({
                    type: 'produce',
                    kind,
                    rtpParameters,
                    streamerId: this.streamerId,
                });
                callback({ id: 'placeholder-producer-id' });
            }
        );

        console.log('Send transport ready. Awaiting media.');
    }

    // Toggle video visibility (by enabling/disabling the video track)
    toggleVideo(): void {
        if (this.videoTrack) {
            this.videoTrack.enabled = !this.videoTrack.enabled;
            this.isVideoOn = this.videoTrack.enabled;
            console.log(
                'Video ' + (this.videoTrack.enabled ? 'shown' : 'hidden')
            );
        }
    }

    // Toggle audio visibility (by enabling/disabling the audio track)
    toggleAudio(): void {
        if (this.audioTrack) {
            this.audioTrack.enabled = !this.audioTrack.enabled;
            this.isAudioOn = this.audioTrack.enabled;
            console.log(
                'Audio ' + (this.audioTrack.enabled ? 'unmuted' : 'muted')
            );
        }
    }

    sendChatMessage(): void {
        if (this.newMessage.trim() === '') return;

        const cookie = this.cookieService.getCookie('streamer_auth');
        const userName = cookie ? JSON.parse(cookie).username : 'Anonymous';
        const authenticated = this.cookieService.checkAuthCookie();

        const messageJson = {
            type: 'auth',
            userName: userName,
            messageText: this.newMessage,
            publicKey: '',
            signature: '',
            authenticated: authenticated,
        };

        this.chatService.sendMessage(messageJson);
        this.newMessage = '';
    }

    scrollToBottom(): void {
        try {
            this.chatLog.nativeElement.scrollTop =
                this.chatLog.nativeElement.scrollHeight;
        } catch (err) {
            // sometimes view not initialized yet
        }
    }
}
