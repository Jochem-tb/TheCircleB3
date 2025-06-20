import { Routes } from '@angular/router';
import { StreamerComponent } from './pages/streamer/streamer.component';

export const routes: Routes = [
  { path: '', redirectTo: 'broadcast/dev', pathMatch: 'full' }, // or direct to a default stream ID
  { path: 'broadcast/:streamerId', component: StreamerComponent },
];
