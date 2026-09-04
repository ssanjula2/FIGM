@Component({
  selector: 'app-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (item of items; track $index) { <li>{{ item.name }}</li> }`
})
export class ListComponent {}
