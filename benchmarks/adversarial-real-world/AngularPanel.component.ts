import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-angular-panel',
  template: `
    <div class="panel">
      <!-- Anti-pattern 1: Non-interactive click listener without tabindex or keydown -->
      <div class="panel-header" (click)="togglePanel()">
        <h3>Panel Title</h3>
      </div>
      <!-- Anti-pattern 2: *ngFor missing trackBy clause -->
      <div *ngFor="let item of items" class="panel-item">
        <span>{{ item.name }}</span>
      </div>
    </div>
  `
})
export class AngularPanelComponent implements OnInit {
  public items: Array<{ id: string; name: string }> = [];
  public data$!: Observable<any>;

  ngOnInit(): void {
    // Anti-pattern 3: Unsubscribed RxJS subscription in component lifecycle
    this.data$.subscribe((res) => {
      this.items = res.items;
    });
  }

  public togglePanel(): void {
    console.log('Panel toggled');
  }
}
