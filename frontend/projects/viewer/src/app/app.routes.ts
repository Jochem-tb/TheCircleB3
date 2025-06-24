import { Routes } from '@angular/router';
import { StreamComponent } from './pages/stream/stream.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'stream/:streamId', component: StreamComponent }
];
