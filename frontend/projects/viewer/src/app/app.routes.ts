import { Routes } from '@angular/router';
import { StreamComponent } from './pages/stream/stream.component';
import { StreamListComponent } from './pages/home/stream-list.component';

export const routes: Routes = [
  { path: '', component: StreamListComponent },
  { path: 'stream/:streamId', component: StreamComponent }
];
