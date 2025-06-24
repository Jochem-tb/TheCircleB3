import {
    AfterViewChecked,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    OnInit,
    ViewChild,
} from '@angular/core';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { generateDevIdentity } from '../../utils/dev.auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CookieService } from '../../services/cookie.service';
import { timestamp } from 'rxjs';

@Component({
    selector: 'app-chat',
    templateUrl: './chat.html',
    styleUrls: ['./chat.css'],
    imports: [CommonModule, FormsModule],
    standalone: true,
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
    @Input() streamerId!: string;
    @ViewChild('chatLog') private chatLog!: ElementRef<HTMLElement>;

    messages: ChatMessage[] = [];
    currentUser: string = 'john';
    newMessage: string = '';
    authenticated: boolean = false;
    errorMessage: string | null = null;

    constructor(
        private chatService: ChatService,
        private cookieService: CookieService
    ) {}

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    async ngOnInit() {
        if (!this.streamerId) {
            console.error('streamerId input is required');
            return;
        }

        // Connect to chat room using streamerId passed from parent
        this.chatService.connect(this.streamerId);
        this.chatService.connectionError$.subscribe((error) => {
            this.errorMessage = error;
        });

        // Subscribe to messages
        this.chatService.messages$.subscribe((msg) => {
            this.messages.push(msg);
            setTimeout(() => {
                const el = document.getElementById('chat-log');
                if (el) el.scrollTop = el.scrollHeight;
            }, 0);
        });

        // Authenticate user
        this.cookieService.authenticated$.subscribe((auth) => {
            this.authenticated = auth;
        });
    }

    sendMessage() {
        if (this.newMessage.trim() === '') return;

        const cookie = this.cookieService.getCookie('authenticated');
        const userName = cookie ? JSON.parse(cookie).userName : 'Anonymous';

        const messageJson = {
            type: 'auth',
            userName: userName,
            messageText: this.newMessage,
            publicKey: '',
            signature: '',
            authenticated: this.authenticated,
        };

        this.chatService.sendMessage(messageJson);
        this.newMessage = '';
    }

    ngOnDestroy() {
        this.chatService.disconnect();
    }

    private scrollToBottom(): void {
        try {
            const el = this.chatLog.nativeElement;
            el.scrollTop = el.scrollHeight;
        } catch (err) {
            console.error('Scroll to bottom failed', err);
        }
    }
}
