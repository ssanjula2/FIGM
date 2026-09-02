// Defect: FIGM-ANG-03
@Component({
  selector: 'app-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div *ngFor="let item of items">{{ item.name }}</div>`
})
export class ListComponent {}
