import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  private authSubject = new BehaviorSubject<boolean>(this.internalCheckAuthCookie());
  public authenticated$ = this.authSubject.asObservable();

  constructor() {
    // Poll every min to check if the cookie expired
    interval(60000).subscribe(() => {
      const isAuth = this.internalCheckAuthCookie();
      if (isAuth !== this.authSubject.value) {
        this.authSubject.next(isAuth);
      }
    });
  }

  // Create cookie
  setAuthCookie(username: string): void {
    const exp = new Date().getTime() + 60 * 60 * 1000; // 1 hour
    const value = JSON.stringify({userName: username, authenticated: true, exp });
    document.cookie = `authenticated=${encodeURIComponent(value)}; path=/`;

    // Immediately update observable
    this.authSubject.next(true);
  }

  // Get cookie
  getCookie(name: string): string | null {
    const matches = document.cookie.match(new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : null;
  }

  // Delete cookie
  deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=-1; path=/`;

    if (name === 'authenticated') {
      this.authSubject.next(false);
    }
  }

  //deletes da cookie without needing to specify name
  clearAuthCookie(): void {
  document.cookie = 'authenticated=; Max-Age=0; path=/;';
  this.authSubject.next(false);
  console.log('Cleared authenticated cookie');
}

  // Public method to check once
  checkAuthCookie(): boolean {
    return this.internalCheckAuthCookie();
  }

  // Internal method used by both public API and poller
  private internalCheckAuthCookie(): boolean {
    const cookie = this.getCookie('authenticated');
    console.log('Checking cookie in service:', cookie);
    if (!cookie) return false;

    try {
      const data = JSON.parse(cookie);
      const now = new Date().getTime();

      if (now > data.exp) {
        this.deleteCookie('authenticated');
        return false;
      }

      return data.authenticated === true;
    } catch (e) {
      this.deleteCookie('authenticated');
      return false;
    }
  }
}
