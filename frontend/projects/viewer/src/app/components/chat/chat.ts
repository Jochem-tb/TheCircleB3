import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ChatMessage = {
  sender: string
  messageText: string
  timestamp: Date
}

@Component({
  selector: 'app-chat',
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class ChatComponent {
  messages: ChatMessage[] = []
  newMessage: string = ''
  authenticated: boolean = false;

  constructor() {
    setInterval(() => {
      this.receiveMessage({
        sender: 'Viewer' + Math.floor(Math.random() * 100),
        messageText: 'Sample message',
        timestamp: new Date()
      })
    }, 5000)
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return

    this.receiveMessage({
      sender: 'You',
      messageText: this.newMessage,
      timestamp: new Date()
    })

    this.newMessage = ''
  }

  receiveMessage(msg: ChatMessage) {
    this.messages.push(msg)

    setTimeout(() => {
      const el = document.getElementById('chat-log')
      if (el) el.scrollTop = el.scrollHeight
    }, 0)
  }
}