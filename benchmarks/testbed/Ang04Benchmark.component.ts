// Defect: FIGM-ANG-04
@Component({
  selector: 'app-total',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ calculateTotal() }}</span>`
})
export class TotalComponent {
  calculateTotal() { return 42; }
}
