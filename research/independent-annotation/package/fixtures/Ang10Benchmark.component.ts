@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>{{ (user$ | async)?.name }}</div><div>{{ (user$ | async)?.email }}</div>`
})
export class UserCardComponent {}
