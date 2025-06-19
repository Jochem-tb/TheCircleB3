import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

export type ChatMessage = {
  sender: string
  messageText: string
  timestamp: string
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private ws: WebSocket | null = null
  private messageSubject = new Subject<ChatMessage>()
  public messages$ = this.messageSubject.asObservable()

  private authenticated = false

  connect(streamerId: string) {
    const url = `ws://localhost:8080/?userId=${streamerId}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('WebSocket connection established')
    }

    this.ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data)

        if (data.status === 'authenticated') {
          this.authenticated = true
          console.log('Authenticated as', data.name)
          return
        }

        if (data.error) {
          console.error('Error from server:', data.error)
          return
        }

        this.messageSubject.next({
          sender: data.sender,
          messageText: data.messageText,
          timestamp: data.timestamp
        })
      } catch (err) {
        console.error('Invalid message format:', err)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket connection closed')
      this.authenticated = false
    }

    this.ws.onerror = err => {
      console.error('WebSocket error:', err)
    }
  }

  authenticate(name: string, publicKey: string, signature: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        data: { name, publicKey, signature }
      }))
    }
  }

  sendMessage(messageText: string) {
    if (!this.authenticated) return
    this.ws?.send(JSON.stringify({ messageText }))
  }

  isAuthenticated(): boolean {
    return this.authenticated
  }


  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }



}
