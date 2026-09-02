// Defect: FIGM-ANG-07
@Component({ selector: 'app-data', changeDetection: ChangeDetectionStrategy.OnPush })
export class DataComponent {
  constructor(private dataService: DataService) {
    this.items = this.dataService.getInitialItems();
    this.dataService.refresh();
  }
}
