import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { StreamComponent } from './pages/stream/stream.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },           
    { path: 'stream/:streamId', component: StreamComponent },
  ];
