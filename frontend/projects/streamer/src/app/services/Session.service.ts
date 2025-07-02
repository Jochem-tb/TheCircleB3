import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private authSubject = new BehaviorSubject<boolean>(this.internalCheckSession());
  public authenticated$ = this.authSubject.asObservable();

  constructor() {
    // Poll every minute to check if session expired
    interval(60000).subscribe(() => {
      const isAuth = this.internalCheckSession();
      if (isAuth !== this.authSubject.value) {
        this.authSubject.next(isAuth);
      }
    });
  }

  // Create session entry
  setAuthSession(username: string, privateKey: string): void {
    const exp = new Date().getTime() + 60 * 60 * 1000; // 1 hour
    const value = JSON.stringify({ userName: username, authenticated: true, exp , privateKey});
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
