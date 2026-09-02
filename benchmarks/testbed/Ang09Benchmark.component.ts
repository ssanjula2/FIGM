// Defect: FIGM-ANG-09
@Component({ selector: 'app-user', changeDetection: ChangeDetectionStrategy.OnPush })
export class UserCard {
  userId = input();
}
