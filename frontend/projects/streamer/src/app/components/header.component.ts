import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { CookieService } from '../services/cookie.service';
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

  closePopup() {
    this.showPopup = false;
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
