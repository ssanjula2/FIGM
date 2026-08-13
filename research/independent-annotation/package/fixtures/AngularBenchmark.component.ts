import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-angular-benchmark',
  template: `
    <div class="angular-benchmark">
      <img [src]="avatarUrl" alt="User Profile Picture" />

      <div (click)="onSelectOption()" class="option-item">
        Select Option
      </div>

      <div id="status" class="status-banner">
        {{ notificationText }}
      </div>
    </div>
  `
})
export class AngularBenchmarkComponent implements OnInit {
  avatarUrl = '/assets/user.png';
  notificationText = 'Angular Loaded';

  ngOnInit() {
    window.addEventListener('scroll', this.onWindowScroll);
  }

  onWindowScroll() {
    console.log('Angular scrolling');
  }

  onSelectOption() {
    this.notificationText = 'Option Selected';
  }
}
