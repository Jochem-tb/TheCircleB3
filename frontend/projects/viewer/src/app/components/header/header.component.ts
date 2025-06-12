import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  onLeftImageClick() {
    console.log('Left image clicked');
    // Add your logic here for when the left image is clicked
  }

  onRightImageClick() {
    console.log('Right image clicked');
    // Add your logic here for when the right image is clicked
  }
}
