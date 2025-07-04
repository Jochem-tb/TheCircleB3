import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { CryptoKeyService } from './crypto-key.service';

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

  constructor(private keyService: CryptoKeyService) {}

  connect(streamerId: string) {
    const url = `ws://localhost:8081/?userId=${streamerId}`;
    this.ws = new WebSocket(url);

    

    this.ws.onopen = () => {
      console.log('✅ WebSocket connection established');
      this.connectionErrorSubject.next(null);
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgHash = await this.createHMAC(data.messageText, 'mySecretKey');

        console.log('📬 Hash received:', data.hash);
        console.log('Expected hash:', msgHash);

        if (data.hash === msgHash) {
          if (data.error) {
            console.error('❌ Error from server:', data.error);
            this.connectionErrorSubject.next('Server error: ' + data.error);
            return;
          }

          console.log('📬 Message received chatservice:', data);

          this.messageSubject.next({
            userName: data.userName,
            messageText: data.messageText,
            timestamp: data.timestamp,
          });
        } else {
          console.error('Message received got tempered with');
        }
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

  async sendMessage(messageJson: any) {
    if (!messageJson.authenticated) {
      console.warn('🚫 User is not authenticated. Message not sent.');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      const msgHash = await this.createHMAC(
        messageJson.messageText,
        'mySecretKey'
      );
      messageJson.hash = msgHash;

      const privateKey = this.keyService.getKey();
      if (!privateKey) {
        console.warn('🚫 No private key available. Message not sent.');
        return;
      }

      const encoder = new TextEncoder();
      const msgBuffer = encoder.encode(JSON.stringify(messageJson));

      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        msgBuffer
      );

      const signatureBase64 = btoa(
        String.fromCharCode(...new Uint8Array(signature))
      );
      messageJson.signature = signatureBase64;

      this.ws.send(JSON.stringify(messageJson));
      console.log('✅ Message sent:', messageJson);
    } else {
      console.warn('🚫 WebSocket is not open. Message not sent.');
    }
  }

  //Make a secret hash
  async createHMAC(message: string, key: string) {
    const enc = new TextEncoder();

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      enc.encode(message)
    );
    const bytes = new Uint8Array(signature);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
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
