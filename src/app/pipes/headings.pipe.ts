import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'headings'
})
export class HeadingsPipe implements PipeTransform {

  transform(value, ...args: unknown[]): unknown {
    return value.join(' > ');
  }

}
