import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./header.component.css']  // fixed typo styleUrl → styleUrls
})
export class HeaderComponent {
  showPopup = false;
    username = '';
  password = '';


  onLeftImageClick() {
    console.log('Left image clicked');
  }

  onProfileClick() {
    console.log('onProfileClick clicked');
    this.showPopup = true;  
  }

  onSubmit() {
     console.log('Username:', this.username);
    console.log('Password:', this.password);
    this.username = '';
    this.password = '';
    this.showPopup = false;  // close popup after submit (optional)
  }

  closePopup() {
    this.showPopup = false;
  }
}
