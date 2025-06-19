import { Component } from '@angular/core';
import { ChatComponent } from '../../components/chat/chat';

@Component({
  selector: 'app-stream',
  imports: [
    ChatComponent
  ],
  templateUrl: './stream.component.html',
  styleUrl: './stream.component.css'
})
export class StreamComponent {

}
