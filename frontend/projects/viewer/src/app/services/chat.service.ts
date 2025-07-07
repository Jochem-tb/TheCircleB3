import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { CryptoKeyService } from './crypto-key.service';

export type ChatMessage = {
  userName: string;
  messageText: string;
  timestamp: string;
  signature: string;
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
        console.log('Received WebSocket message:', data);

        if (data.error) {
          this.connectionErrorSubject.next('Server error: ' + data.error);
          return;
        }

        const { userName, messageText, timestamp, signature } = data;

        if (!userName || !messageText || !timestamp || !signature) {
          this.connectionErrorSubject.next('Missing fields in message');
          return;
        }

        // Verify the signature
        const isVerified = await this.verifySignature(
          userName,
          messageText,
          timestamp,
          signature
        );

        if (!isVerified) {
          this.connectionErrorSubject.next('Signature verification failed for message from ' + userName);
          return;
        }

        this.messageSubject.next({
          userName,
          messageText,
          timestamp,
          signature
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

  async sendMessage(messageJson: any) {
    if (!messageJson.authenticated) {
      console.warn('🚫 User is not authenticated. Message not sent.');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      // ↓ HMAC weg, we doen alleen nog de RSA-signature ↓
      const privateKey = this.keyService.getKey();
      if (!privateKey) {
        console.warn('🚫 No private key available. Message not sent.');
        return;
      }

      const payload = `${messageJson.userName}|${messageJson.messageText}|${messageJson.timestamp}`;
      const encoder = new TextEncoder();
      const msgBuffer = encoder.encode(payload);

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
  
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

async fetchPublicKey(userName: string): Promise<CryptoKey | null> {
    try {
      const response = await fetch(`http://localhost:3000/auth/public-key/${userName}`);
      if (!response.ok) {
        console.error(`Failed to fetch public key for ${userName}: ${response.statusText}`);
        return null;
      }
      const { public_key } = await response.json();

      const pemContents = public_key
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\r?\n|\r/g, '')
        .trim();

      const binaryDer = Uint8Array.from(window.atob(pemContents), (c) => c.charCodeAt(0));

      return await window.crypto.subtle.importKey(
        'spki',
        binaryDer.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
    } catch (err) {
      console.error(`Error fetching public key for ${userName}:`, err);
      return null;
    }
  }
  
  async verifySignature(
    userName: string,
    messageText: string,
    timestamp: string,
    signatureBase64: string
  ): Promise<boolean> {
    const publicKey = await this.fetchPublicKey(userName);
    if (!publicKey) {
      console.warn(`No public key available for ${userName}`);
      return false;
    }

    const payload = `${userName}|${messageText}|${timestamp}`;
    const encoder = new TextEncoder();
    const msgBuffer = encoder.encode(payload);

    const signature = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));

    try {
      return await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signature,
        msgBuffer
      );
    } catch (err) {
      console.error('Signature verification failed:', err);
      return false;
    }
  }


}
