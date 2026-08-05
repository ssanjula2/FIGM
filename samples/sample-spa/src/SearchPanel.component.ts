import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-search-panel',
  template: `
    <div class="search-box">
      <input type="text" (input)="onSearch($event)" />
      <!-- Defect: FIGM-A11Y-03 (Dynamic status container missing aria-live) -->
      <div id="status" class="status-banner">
        {{ searchStatus }}
      </div>
    </div>
  `
})
export class SearchPanelComponent implements OnInit {
  searchStatus = 'Ready';

  ngOnInit() {
    // Defect: FIGM-PERF-03 (addEventListener without paired removal)
    window.addEventListener('resize', this.handleResize);
  }

  handleResize() {
    console.log('Resized');
  }

  onSearch(event: any) {
    this.searchStatus = 'Searching...';
  }
}
