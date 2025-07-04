import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { CryptoKeyService } from './crypto-key.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private authSubject = new BehaviorSubject<boolean>(this.internalCheckSession());
  public authenticated$ = this.authSubject.asObservable();

  constructor(
    private keyService: CryptoKeyService
  ) {
    // Poll every sec to check if session expired
    interval(1000).subscribe(() => {
      const isAuth = this.internalCheckSession();
      if (isAuth !== this.authSubject.value) {
        this.authSubject.next(isAuth);
      }
      
      // Check if key is still valid
      const key = this.keyService.getKey();
      if (!key) {
        this.clearAuthSession();
      }

    });
  }

  // Create session entry
  setAuthSession(username: string): void {
    const exp = new Date().getTime() + 60 * 60 * 1000; // 1 hour
    const value = JSON.stringify({ userName: username, authenticated: true, exp});
    sessionStorage.setItem('authenticated', value);

    // Immediately update observable
    this.authSubject.next(true);
  }

  // Read session entry
  getSessionItem(name: string): string | null {
    return sessionStorage.getItem(name);
  }

  // Remove session entry
  deleteSessionItem(name: string): void {
    sessionStorage.removeItem(name);

    if (name === 'authenticated') {
      this.authSubject.next(false);
    }
  }

  // Deletes auth session
  clearAuthSession(): void {
    sessionStorage.removeItem('authenticated');
    this.authSubject.next(false);
    console.log('Cleared authenticated session');
  }

  // Public check
  checkAuthSession(): boolean {
    return this.internalCheckSession();
  }

  // Internal auth check
  private internalCheckSession(): boolean {
    const session = this.getSessionItem('authenticated');
    console.log('Checking session in service:', session);
    if (!session) return false;

    try {
      const data = JSON.parse(session);
      const now = new Date().getTime();

      if (now > data.exp) {
        this.deleteSessionItem('authenticated');
        return false;
      }

      return data.authenticated === true;
    } catch (e) {
      this.deleteSessionItem('authenticated');
      return false;
    }
  }
}
