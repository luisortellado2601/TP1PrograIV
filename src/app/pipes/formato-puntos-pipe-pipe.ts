import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatoPuntos',
  standalone: true
})
export class FormatoPuntosPipe implements PipeTransform {
  transform(value: number): string {
    if (!value || value === 0) return 'Sin costo en pts';
    return `${value} puntos`;
  }
}