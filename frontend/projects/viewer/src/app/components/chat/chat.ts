import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ChatMessage = {
  user: string
  message: string
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

  constructor() {
    setInterval(() => {
      this.receiveMessage({
        user: 'Viewer' + Math.floor(Math.random() * 100),
        message: 'Sample message',
        timestamp: new Date()
      })
    }, 5000)
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return

    this.receiveMessage({
      user: 'You',
      message: this.newMessage,
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