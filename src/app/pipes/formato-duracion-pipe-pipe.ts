import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatoDuracion',
  standalone: true
})
export class FormatoDuracionPipe implements PipeTransform {
  transform(minutos: number): string {
    if (!minutos || minutos <= 0) return '0m';
    
    const horas = Math.floor(minutos / 60);
    const minsRestantes = minutos % 60;

    if (horas === 0) return `${minsRestantes}m`;
    if (minsRestantes === 0) return `${horas}h`;
    
    return `${horas}h ${minsRestantes}m`;
  }
}