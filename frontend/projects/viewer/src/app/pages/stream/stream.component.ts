import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as mediasoupClient from 'mediasoup-client';
import { CommonModule } from '@angular/common';
import { ChatComponent } from '../../components/chat/chat';
import { CookieService } from '../../services/cookie.service';

@Component({
  selector: 'app-stream',
  standalone: true,
  templateUrl: './stream.component.html',
  styleUrls: ['./stream.component.css'],
  imports: [CommonModule, ChatComponent]
})
export class StreamComponent implements OnInit, AfterViewInit {
  @ViewChild('video', { static: false }) videoRef!: ElementRef<HTMLVideoElement>;

  streamerId: string = '';
  viewerId = crypto.randomUUID();

  device!: mediasoupClient.Device;
  recvTransport!: mediasoupClient.types.Transport;
  socket!: WebSocket;

constructor(
  private route: ActivatedRoute,
  private cookieService: CookieService
) {}

  ngOnInit(): void {
    // Get the streamer ID from the route
    this.streamerId = this.route.snapshot.params['streamId'];
    console.log('Viewer for streamer:', this.streamerId);
    this.cookieService.checkAuthCookie();
  }

  ngAfterViewInit(): void {
    // Establish connection to the server
    this.connectToServer();
  }

  connectToServer(): void {
    this.socket = new WebSocket('ws://localhost:3002');

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.send({
        type: 'get-router-rtp-capabilities',
        streamerId: this.streamerId,
        viewerId: this.viewerId
      });
    };

    this.socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Message received:', message);

      switch (message.type) {
        case 'router-rtp-capabilities':
          await this.loadDevice(message.data);
          break;

        case 'viewer-transport-created':
          await this.createRecvTransport(message.params);
          break;

        case 'consumed':
          await this.consume(message.params);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    };
  }

  async loadDevice(routerRtpCapabilities: any): Promise<void> {
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });
    console.log('Mediasoup device loaded');

    this.send({
      type: 'create-viewer-transport',
      streamerId: this.streamerId,
      viewerId: this.viewerId
    });
  }

  async createRecvTransport(params: any): Promise<void> {
    console.log('Creating recv transport...');
    this.recvTransport = this.device.createRecvTransport(params);

    this.recvTransport.on('connect', ({ dtlsParameters }, callback) => {
      this.send({
        type: 'connect-viewer-transport',
        streamerId: this.streamerId,
        viewerId: this.viewerId,
        dtlsParameters
      });
      callback();
    });

    this.recvTransport.on('connectionstatechange', (state) => {
      console.log('Viewer transport state:', state);
    });

    console.log('Requesting to consume media...');
    this.send({
      type: 'consume',
      streamerId: this.streamerId,
      viewerId: this.viewerId,
      kind: 'video',
      rtpCapabilities: this.device.rtpCapabilities
    });

    this.send({
      type: 'consume',
      streamerId: this.streamerId,
      viewerId: this.viewerId,
      kind: 'audio',
      rtpCapabilities: this.device.rtpCapabilities
    });
  }

  async consume(params: any): Promise<void> {
    const { id, producerId, kind, rtpParameters } = params;

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters
    });

    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    const video = this.videoRef.nativeElement;

    // Only assign the video stream once
    if (!video.srcObject) {
      video.srcObject = stream;
    } else {
      // Add track if already set (e.g., when audio arrives second)
      const existingStream = video.srcObject as MediaStream;
      existingStream.addTrack(consumer.track);
    }

    // Log the track state
    console.log(`Consuming track: ${kind}`);
    console.log('Track readyState:', consumer.track.readyState);

    video.onloadedmetadata = () => {
      video.play().catch((err) => {
        console.warn('Auto-play failed:', err);

        // Fallback: require user interaction
        const clickHandler = () => {
          video.play().then(() => {
            console.log('Playback started after user interaction');
            document.removeEventListener('click', clickHandler);
          }).catch(err => {
            console.warn('Still failed to play:', err);
          });
        };

        document.addEventListener('click', clickHandler);
      });
    };
  }

  send(data: any): void {
    // Send a message to the WebSocket server if it's open
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Tried to send but WebSocket not open:', data);
    }
  }
}
