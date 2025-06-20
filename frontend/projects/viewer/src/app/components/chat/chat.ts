import { Component, OnDestroy, OnInit } from '@angular/core'
import { ChatMessage, ChatService } from '../../services/chat.service'
import { generateDevIdentity } from '../../utils/dev.auth'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'
import { CookieService } from '../../pages/service/cookie.service'

@Component({
  selector: 'app-chat',
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = []
  newMessage: string = ''
  authenticated: boolean = false

  constructor(
    private chatService: ChatService,
    private cookieService: CookieService
  ) { }

  async ngOnInit() {
    // create random username
    const name = `User-${Math.floor(Math.random() * 10000)}`;
    // const streamerId = 'streamer123'

    // Connect to chat room
    this.chatService.connect(name)

    // Subscribe to messages
    this.chatService.messages$.subscribe(msg => {
      this.messages.push(msg)
      setTimeout(() => {
        const el = document.getElementById('chat-log')
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
    })

    // Authenticate user 
    this.cookieService.authenticated$.subscribe(auth => {
      this.authenticated = auth;
    });
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return
    this.chatService.sendMessage(this.newMessage)
    this.newMessage = ''
  }

  ngOnDestroy() {
    this.chatService.disconnect()
  }
}
