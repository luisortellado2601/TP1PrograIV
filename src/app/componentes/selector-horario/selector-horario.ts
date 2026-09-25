import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

// Selector de horario sin listas desplegables ni scroll: una grilla de horas y otra de minutos.
@Component({
  selector: 'app-selector-horario',
  templateUrl: './selector-horario.html',
  styleUrl: './selector-horario.css',
})
export class SelectorHorario implements OnChanges {
  readonly horas = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
  readonly minutos = ['00', '15', '30', '45'];

  @Input() etiqueta: string = 'Horario';
  @Input() valor: string = '';   // formato 'HH:mm' (vacío si todavía no se eligió)
  @Output() valorChange = new EventEmitter<string>();

  hora: string = '';
  minuto: string = '';

  ngOnChanges() {
    const partes = this.valor.split(':');
    this.hora = partes[0] || '';
    this.minuto = partes[1] || '';
  }

  elegirHora(h: string) {
    this.hora = h;
    if (!this.minuto) this.minuto = '00';
    this.emitir();
  }

  elegirMinuto(m: string) {
    this.minuto = m;
    if (this.hora) this.emitir();
  }

  private emitir() {
    this.valorChange.emit(`${this.hora}:${this.minuto}`);
  }
}
