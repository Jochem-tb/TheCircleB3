import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type ChatMessage = {
  userName: string;
  messageText: string;
  timestamp: string;
};

@Injectable({
  providedIn: 'root',
})
export class ChatService {

  private ws: WebSocket | null = null;
  private messageSubject = new Subject<ChatMessage>();
  public messages$ = this.messageSubject.asObservable();
  private connectionErrorSubject = new BehaviorSubject<string | null>(null);
  public connectionError$ = this.connectionErrorSubject.asObservable();

  private authenticated = false;

  connect(streamerId: string) {
    const url = `ws://localhost:8081/?userId=${streamerId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connection established');
      this.connectionErrorSubject.next(null);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📬 Message received:', data);

        if (data.error) {
          console.error('❌ Error from server:', data.error);
          this.connectionErrorSubject.next('Server error: ' + data.error)
          return;
        }

        console.log('📬 Message received chatservice:', data);

        this.messageSubject.next({
          userName: data.userName,
          messageText: data.messageText,
          timestamp: data.timestamp,
        });
      } catch (err) {
        console.error('❗ Invalid message format:', err);
        this.connectionErrorSubject.next('Invalid message format received');
      }
    };

    this.ws.onclose = () => {
      console.log('❎ WebSocket connection closed');
      this.authenticated = false;
    };

    this.ws.onerror = (err) => {
      console.error('💥 WebSocket error:', err);
      this.connectionErrorSubject.next('WebSocket error occurred');
    };
  }

  sendMessage(messageJson: any) {
  if (!messageJson.authenticated) {
    console.warn("🚫 User is not authenticated. Message not sent.");
    return;
  }
  
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(messageJson));
    console.log("✅ Message sent:", messageJson);
  } else {
    console.warn("🚫 WebSocket is not open. Message not sent.");
  }
}


  isAuthenticated(): boolean {
    return this.authenticated;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
