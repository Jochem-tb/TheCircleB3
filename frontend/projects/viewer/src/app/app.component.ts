import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        HeaderComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
    ngOnInit(): void {
        console.log('AppComponent initialized');
        // You can add any initialization logic here
    }
    title = 'viewer';
    num = 0;

    sendLog() {
        console.log('Log sent to backend');
        fetch('http://localhost:5200/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Log sent from frontend' + 'this.num:' + this.num++,
            }),
        })
            .then((response) => response.json())
            .then((data) => console.log('Response from backend:', data))
            .catch((error) => console.error('Error sending log:', error));
    }
}
