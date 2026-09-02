import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

// Clean: the component explicitly opts into OnPush change detection -- FIGM-ANG-02 must NOT fire.
@Component({
  selector: 'app-product-card',
  template: `<div class="card"><h3>{{ title }}</h3><p>{{ price | currency }}</p></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  @Input() title = '';
  @Input() price = 0;
}
