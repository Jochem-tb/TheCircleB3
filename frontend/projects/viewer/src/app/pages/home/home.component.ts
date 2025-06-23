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
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  constructor(
    private router: Router,
    private cookieService: CookieService,
    private http: HttpClient
  ) { }


  streams: { streamerId: string }[] = [];
  loading = true;
  errorMessage = '';



  ngOnInit(): void {
    this.fetchStreams();
    this.cookieService.checkAuthCookie();
  }

  goToStream(streamId: string) {
    this.router.navigate([`/stream/${streamId}`]);
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
