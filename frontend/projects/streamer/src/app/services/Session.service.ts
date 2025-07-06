import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private authSubject = new BehaviorSubject<boolean>(this.internalCheckSession());
  public authenticated$ = this.authSubject.asObservable();

  constructor() {
    // Poll every minuut om sessie te controleren
    interval(60000).subscribe(() => {
      const isAuth = this.internalCheckSession();
      if (isAuth !== this.authSubject.value) {
        this.authSubject.next(isAuth);
      }
    });
  }

  // Alleen username + exp + authenticated status opslaan
  setAuthSession(username: string): void {
    const exp = new Date().getTime() + 60 * 60 * 1000; // 1 uur
    const value = JSON.stringify({ userName: username, authenticated: true, exp });
    sessionStorage.setItem('authenticated', value);
    this.authSubject.next(true);
  }

  getSessionItem(name: string): string | null {
    return sessionStorage.getItem(name);
  }

  deleteSessionItem(name: string): void {
    sessionStorage.removeItem(name);
    if (name === 'authenticated') {
      this.authSubject.next(false);
    }
  }

  clearAuthSession(): void {
    sessionStorage.removeItem('authenticated');
    this.authSubject.next(false);
    console.log('Cleared authenticated session');
  }

  checkAuthSession(): boolean {
    return this.internalCheckSession();
  }

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