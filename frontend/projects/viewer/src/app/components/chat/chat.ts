import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { generateDevIdentity } from '../../utils/dev.auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.html',
  styleUrls: ['./chat.css'],
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class ChatComponent implements OnInit, OnDestroy {
  @Input() streamerId!: string;

  messages: ChatMessage[] = [];
  newMessage: string = '';
  authenticated: boolean = false;

  constructor(private chatService: ChatService) {}

  async ngOnInit() {
    if (!this.streamerId) {
      console.error('streamerId input is required');
      return;
    }

    // Connect to chat room using streamerId passed from parent
    this.chatService.connect(this.streamerId);

    // Subscribe to messages
    this.chatService.messages$.subscribe(msg => {
      this.messages.push(msg);
      setTimeout(() => {
        const el = document.getElementById('chat-log');
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    });

    // Generate identity and authenticate (for testing/dev)
    try {
      const { publicKey, signature } = await generateDevIdentity(this.streamerId);
      this.chatService.authenticate(this.streamerId, publicKey, signature);
      this.authenticated = true;
    } catch (err) {
      console.error('Failed to generate identity:', err);
    }
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return;
    this.chatService.sendMessage(this.newMessage);
    this.newMessage = '';
  }

  ngOnDestroy() {
    this.chatService.disconnect();
  }
}
