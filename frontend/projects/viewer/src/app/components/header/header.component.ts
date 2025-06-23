import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { CookieService } from '../../pages/service/cookie.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  styleUrls: ['./header.component.css']  // fixed typo styleUrl → styleUrls
})
export class HeaderComponent implements OnInit, OnDestroy{
  showPopup = false;
  userName = '';
  privateKey = '';
  isLoggedIn = false;
  dropdownOpen = false;
  private authSubscription!: Subscription;
  constructor(
    private router: Router,
    private http: HttpClient,
    private cookieService: CookieService
  ) { }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
  }

  ngOnInit(): void {
    this.authSubscription = this.cookieService.authenticated$.subscribe(isAuth => {
      this.isLoggedIn = isAuth;
    });
  }


  onLeftImageClick() {
    console.log('Left image clicked');
    this.router.navigate(['/']);
  }

  onProfileClick() {
    console.log('onProfileClick clicked');
    this.showPopup = true;
  }

  async onSubmit() {
    if (!this.userName || !this.privateKey) {
      alert('Please provide username and private key file');
      return;
    }

    try {
      // Step 1: Get challenge and public key from server
      const resp: any = await this.http
        .get(`http://localhost:3000/auth/challenge?username=${this.userName}`)
        .toPromise();

      const { challenge, public_key } = resp;

      // Step 2: Sign the challenge using the private key
      const signature = await this.signChallenge(challenge, this.privateKey);

      // Step 3: Send signature + username + public_key to authenticate endpoint
      const payload = {
        username: this.userName,
        signature,
        public_key
      };

      console.log('Sending authentication payload:', payload);


      interface AuthResponse {
        authenticated: boolean;
        username: string;
      }
      // Then send it
      const authResp = await this.http
        .post<AuthResponse>('http://localhost:3000/auth/authenticate', payload)
        .toPromise();

      console.log('Authentication response:', authResp);

      if (authResp && authResp.authenticated) {
        this.cookieService.setAuthCookie();
         this.isLoggedIn = true;

        alert('Authentication successful!');
      }

      // Clear and close popup
      this.userName = '';
      this.showPopup = false;
    } catch (err) {
      console.error('Error during authentication:', err);
      alert('Authentication failed. See console for details.');
      window.location.reload();

    }
  }

  closePopup() {
    this.showPopup = false;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result as string;
      this.privateKey = text.trim();
      console.log(this.privateKey);
    };

    reader.onerror = () => {
      console.error('Error reading file');
    };

    reader.readAsText(file);
  }


  // Helper function to sign challenge with private key using WebCrypto API
  async signChallenge(challenge: string, privateKeyPem: string): Promise<string> {
    // Convert PEM to ArrayBuffer   

    const pemContents = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\r?\n|\r/g, '')  // remove ALL newlines
      .trim();

    console.log('signChallenge challenge:', challenge);
    console.log('signChallenge privateKeyPem:', pemContents);

    const binaryDer = Uint8Array.from(window.atob(pemContents), c => c.charCodeAt(0));

    // Import the private key
    const key = await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      false,
      ["sign"]
    );

    // Encode the challenge string to Uint8Array
    const data = this.hexToUint8Array(challenge);

    // Sign the challenge
    const signature = await window.crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);

    // Convert signature to base64
    const base64Signature = this.arrayBufferToBase64(signature);

    console.log('Signature:', base64Signature);

    return base64Signature;
  }

  // Utility to convert ArrayBuffer to base64
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error("Invalid hex string");
    }
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      array[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return array;
  }

  toggleDropdown(): void {
  this.dropdownOpen = !this.dropdownOpen;
}

closeDropdown(): void {
  this.dropdownOpen = false;
}

logout(): void {
  console.log('Logout clicked');
  this.cookieService.clearAuthCookie();
  this.isLoggedIn = false;
  this.dropdownOpen = false;

}

}
