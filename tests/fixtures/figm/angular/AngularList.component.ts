// @ts-nocheck
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-angular-list',
  template: `
    <div class="container">
      <!-- FIGM-A11Y-01: Non-interactive div with click handler -->
      <div (click)="onHeaderClick()">
        <h2>List Header</h2>
      </div>
      <!-- FIGM-ANGULAR-02: *ngFor missing trackBy -->
      <div *ngFor="let item of list">
        <p>{{ item.title }}</p>
      </div>
    </div>
  `
})
export class AngularListComponent implements OnInit {
  public list: Array<{ id: string; title: string }> = [];
  public stream$!: Observable<any>;

  ngOnInit(): void {
    // FIGM-ANGULAR-01: Unsubscribed RxJS stream
    this.stream$.subscribe((res) => {
      this.list = res;
    });
  }

  public onHeaderClick(): void {
    console.log('Header clicked');
  }
}
