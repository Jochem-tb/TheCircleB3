import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stream-list',
  standalone: true,
  templateUrl: './stream-list.component.html',
  styleUrls: ['./stream-list.component.css'],
  imports: [CommonModule, RouterModule]
})
export class StreamListComponent implements OnInit {
  streams: { streamerId: string }[] = [];
  loading = true;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Fetch the streams as soon as the component initializes
    this.fetchStreams();
  }

  fetchStreams(): void {
    this.loading = true;

    // Fetch the list of active streams from the server
    this.http.get<{ streamerId: string }[]>('http://localhost:3002/streams')
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
        }
      });
  }
}
