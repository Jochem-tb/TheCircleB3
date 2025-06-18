import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  streams = [
    {id:1, name: 'Stream1', description: 'Description for Stream 1', viewers: 23, source: 'https://example.com/stream1' },
    {id:2, name: 'Stream2', description: 'Description for Stream 2', viewers: 5, source: 'https://example.com/stream2' },
    {id:3, name: 'Stream3', description: 'Description for Stream 3', viewers: 66, source: 'https://example.com/stream3' },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.streams.sort((a, b) => b.viewers - a.viewers);
  }

  goToStream(streamId: number) {
    this.router.navigate([`/stream/${streamId}`]);
  }
}
