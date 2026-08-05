import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-angular-benchmark',
  template: `
    <div class="angular-benchmark">
      <!-- Defect: FIGM-PERF-02 (Un-dimensioned img) -->
      <img [src]="avatarUrl" alt="User Profile Picture" />

      <!-- Defect: FIGM-A11Y-01 (div (click) without keydown or tabindex) -->
      <div (click)="onSelectOption()" class="option-item">
        Select Option
      </div>

      <!-- Defect: FIGM-A11Y-03 (Dynamic status container missing aria-live) -->
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
    // Defect: FIGM-PERF-03 (addEventListener without paired removal)
    window.addEventListener('scroll', this.onWindowScroll);
  }

  onWindowScroll() {
    console.log('Angular scrolling');
  }

  onSelectOption() {
    this.notificationText = 'Option Selected';
  }
}
