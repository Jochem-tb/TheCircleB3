import { Component } from '@angular/core';
import { ChatComponent } from '../../components/chat/chat';
import { CookieService } from '../service/cookie.service';
@Component({
  selector: 'app-stream',
  imports: [
    ChatComponent
  ],
  templateUrl: './stream.component.html',
  styleUrl: './stream.component.css'
})
export class StreamComponent {
  constructor(
    private cookieService: CookieService
  ) {}

  ngOnInit() {
    this.cookieService.checkAuthCookie();
  }

}
