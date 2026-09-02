// Defect: FIGM-ANG-06
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'filterActive', pure: false })
export class FilterActivePipe implements PipeTransform {
  transform(items: unknown[]): unknown[] {
    return items;
  }
}
