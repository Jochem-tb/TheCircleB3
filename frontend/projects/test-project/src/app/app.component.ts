import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MediasoupService } from './MediasoupService';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  @ViewChild('streamingVideo', { static: true })
  streamingVideo!: ElementRef<HTMLVideoElement>;

  constructor(private mediasoupService: MediasoupService) {}

  ngOnInit() {}

  loadStream() {
    const videoStreamElem = this.streamingVideo.nativeElement;
    videoStreamElem.muted = false;
    this.mediasoupService
      .initStream('test-stream', videoStreamElem)
      .catch((err) => {
        console.error('Error loading stream:', err);
      });
  }
}