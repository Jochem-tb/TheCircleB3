import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from '../../services/cookie.service';
import { HttpClient } from '@angular/common/http';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    standalone: true,
    imports: [CommonModule],
    styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
    constructor(
        private router: Router,
        private cookieService: CookieService,
        private http: HttpClient
    ) {}

    streams: { streamerId: string; viewerCount?: number; startTime?: Date }[] =
        [];
    loading = true;
    errorMessage = '';
    private ws: WebSocket | null = null;

    ngOnInit(): void {
        this.fetchStreams();
        this.cookieService.checkAuthCookie();
        this.connectWebSocket();
    }

    goToStream(streamId: string) {
        this.router.navigate([`/stream/${streamId}`]);
    }

    getRandomImage(): string {
        // Return a random image URL for the stream thumbnail
        const images = [
            'placeholderStreamer1.png',
            'placeholderStreamer2.png',
            'placeholderStreamer3.png',
            'placeholderStreamer4.png',
        ];

        return images[Math.floor(Math.random() * images.length)];
    }

    fetchStreams(): void {
        this.loading = true;

        // Fetch the list of active streams from the server
        this.http
            .get<{ streamerId: string }[]>('http://localhost:3002/streams')
            .subscribe({
                next: (data) => {
                    // On success, set the streams and stop loading
                    this.streams = data;
                    this.loading = false;

                    if (data.length === 0) {
                        // Log a message if there are no active streams
                        console.log('No active streams found.');
                    } else {
                        // Log the active streams if available
                        console.log('Active streams:', data);
                    }
                },
                error: (err) => {
                    // On error, show the error message
                    console.error('Error loading streams:', err);
                    this.errorMessage = 'Failed to load stream list.';
                    this.loading = false;
                },
            });
    }

    connectWebSocket(): void {
        this.ws = new WebSocket('ws://localhost:3002');

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'stream-started':
                    this.streams.push({ streamerId: data.streamerId });
                    break;

                case 'stream-stopped':
                    this.streams = this.streams.filter(
                        (stream) => stream.streamerId !== data.streamerId
                    );
                    break;
            }
        };

        this.ws.onclose = () => {
            console.warn(
                'WebSocket closed. Attempting to reconnect in 3 seconds...'
            );
            setTimeout(() => this.connectWebSocket(), 3000); // Try reconnecting
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }
}
