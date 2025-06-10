import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
    ngOnInit(): void {
        console.log('AppComponent initialized');
        // You can add any initialization logic here
    }
    title = 'viewer';
}
