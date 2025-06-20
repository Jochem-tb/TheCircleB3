import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as mediasoupClient from 'mediasoup-client';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-streamer',
  templateUrl: './streamer.component.html',
  styleUrls: ['./streamer.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class StreamerComponent implements OnInit {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  streamerId: string = '';
  private device!: mediasoupClient.Device;
  private socket!: WebSocket;
  private sendTransport!: mediasoupClient.types.Transport;
  private stream!: MediaStream;

  isStreaming = false;
  mediaStreamAvailable = false;
  roomCreated = false;
  deviceLoaded = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Initialize streamer ID from route parameters
    this.streamerId = this.route.snapshot.params['streamerId'];
    console.log(`StreamerComponent initialized with ID: ${this.streamerId}`);
    this.initWebSocket();
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
          console.log('Room created, requesting router RTP capabilities...');
          this.send({ type: 'get-router-rtp-capabilities', streamerId: this.streamerId });
          break;

        case 'router-rtp-capabilities':
          await this.loadDevice(message.data);
          this.deviceLoaded = true;
          this.send({ type: 'create-streamer-transport', streamerId: this.streamerId });
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

        default:
          console.warn('Unknown message type:', message.type);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private send(msg: any): void {
    // Send a message to the WebSocket server if it's open
    if (this.socket.readyState === WebSocket.OPEN) {
      console.log('Sending message to server:', msg);
      this.socket.send(JSON.stringify(msg));
    } else {
      console.warn('Tried to send message but socket not open');
    }
  }

  async getMediaStream(): Promise<void> {
    try {
      // Request media stream from the user
      console.log('Requesting media stream...');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.videoRef.nativeElement.srcObject = this.stream;
      this.mediaStreamAvailable = true;
      console.log('Media stream acquired');
    } catch (err) {
      console.error('Failed to get media stream:', err);
    }
  }

  async startStreaming(): Promise<void> {
    // Start streaming only if media stream is available
    if (!this.stream || !this.mediaStreamAvailable) {
      console.warn('Media stream not ready. Call getMediaStream() first.');
      return;
    }

    if (!this.roomCreated) {
      // Create room if not already created
      console.log('Creating room...');
      this.send({ type: 'create-room', streamerId: this.streamerId });
    }

    const waitUntilReady = async () => {
      let retries = 20;
      while ((!this.deviceLoaded || !this.sendTransport) && retries-- > 0) {
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
    } catch (err) {
      console.error('Error while producing tracks:', err);
    }
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
        streamerId: this.streamerId
      });
      callback();
    });

    this.sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
      console.log(`Producing track: ${kind}`);
      this.send({
        type: 'produce',
        kind,
        rtpParameters,
        streamerId: this.streamerId
      });
      callback({ id: 'placeholder-producer-id' });
    });

    console.log('Send transport ready. Awaiting media.');
  }
}
