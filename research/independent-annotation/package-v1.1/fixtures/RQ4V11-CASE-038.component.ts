import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from './data.service';

// Clean: the subscription is piped through takeUntilDestroyed(), so it is genuinely torn down
// when the component is destroyed -- FIGM-ANG-01 must NOT fire. Also declares OnPush change
// detection, to stay compliant with FIGM-ANG-02 too.
@Component({
  selector: 'app-live-feed',
  template: `<p>Live feed active</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveFeedComponent implements OnInit {
  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService
      .getStream()
      .pipe(takeUntilDestroyed())
      .subscribe((value) => console.log(value));
  }
}
