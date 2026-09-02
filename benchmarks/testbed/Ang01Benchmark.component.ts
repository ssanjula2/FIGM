// Defect: FIGM-ANG-01
@Component({ selector: 'app-data', changeDetection: ChangeDetectionStrategy.OnPush })
export class DataComponent {
  ngOnInit() {
    this.dataService.getStream().subscribe();
  }
}
