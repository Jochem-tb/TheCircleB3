import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./header.component.css']  // fixed typo styleUrl → styleUrls
})
export class HeaderComponent {
  showPopup = false;
  userName = '';	
  constructor(private router: Router) {}


  onLeftImageClick() {
    console.log('Left image clicked');
    this.router.navigate(['/']);
  }

  onProfileClick() {
    console.log('onProfileClick clicked');
    this.showPopup = true;  
  }

  onSubmit() {
     console.log('Private Key:', this.userName);
    this.userName = '';
    this.showPopup = false;  // close popup after submit (optional)
  }

  closePopup() {
    this.showPopup = false;
  }
}
