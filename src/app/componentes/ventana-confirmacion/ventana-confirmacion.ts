import { Component, EventEmitter, Input, Output } from '@angular/core';

// Ventana de confirmación centrada en la pantalla. La pantalla que la usa decide cuándo mostrarla.
@Component({
  selector: 'app-ventana-confirmacion',
  templateUrl: './ventana-confirmacion.html',
  styleUrl: './ventana-confirmacion.css',
})
export class VentanaConfirmacion {
  @Input() titulo: string = 'Confirmar';
  @Input() mensaje: string = '';
  @Input() textoConfirmar: string = 'Confirmar';

  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();
}
