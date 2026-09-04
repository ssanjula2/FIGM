@Component({ selector: 'app-box', changeDetection: ChangeDetectionStrategy.OnPush })
export class BoxComponent {
  constructor(private el: ElementRef) {}
  paint() {
    this.el.nativeElement.style.color = 'red';
  }
}
