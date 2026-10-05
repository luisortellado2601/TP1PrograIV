import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CompraResumen } from '../../models/compra';
import { Auth } from '../../services/auth';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

@Component({
  selector: 'app-mis-compras',
  imports: [CurrencyPipe, TitleCasePipe, VentanaConfirmacion],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.css',
})
export class MisCompras implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private comprasService = inject(ComprasService);
  private configuracionService = inject(ConfiguracionService);

  cargando = signal(true);
  error = signal('');
  mensaje = signal('');
  compras = signal<CompraResumen[]>([]);
  horasLimite = signal(2);
  cancelandoId = signal<string | null>(null);
  compraACancelar = signal<CompraResumen | null>(null);

  perfil = computed(() => this.auth.perfilActual());
  credito = computed(() => Number(this.perfil()?.credito_extra ?? 0));

  ngOnInit() {
    const usuarioId = this.perfil()?.id;
    if (!usuarioId) {
      this.cargando.set(false);
      this.error.set('Necesitás iniciar sesión para ver tus compras.');
      return;
    }

    this.cargarCompras(usuarioId);

    this.configuracionService.getConfiguracion().subscribe({
      next: items => {
        const horas = items.find(i => i.clave === 'horas_limite_cancelar')?.valor;
        if (horas != null) this.horasLimite.set(Number(horas));
      },
    });
  }

  private cargarCompras(usuarioId: string) {
    this.cargando.set(true);
    this.comprasService.misCompras(usuarioId).subscribe({
      next: lista => {
        this.compras.set(lista);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  // Todas las entradas de una misma compra son de la misma función: alcanza con la primera
  funcionInfo(compra: CompraResumen) {
    return compra.entradas_tickets[0]?.funciones ?? null;
  }

  butacasTexto(compra: CompraResumen): string {
    return compra.entradas_tickets
      .map(b => `${b.fila}-${b.columna}${b.es_vip ? ' (VIP)' : b.es_accesible ? ' (Accesible)' : ''}`)
      .join(', ');
  }

  candyTexto(compra: CompraResumen): string {
    return compra.compra_items
      .map(i => `${i.cantidad} ${i.productos_candy?.nombre ?? ''}`)
      .join(', ');
  }

  formatoFuncion(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(fecha));
  }

  // Reflejo en pantalla de las mismas reglas que valida cancelar_compra() en la base:
  // esto solo decide si se MUESTRA el botón, la base vuelve a validar todo igual.
  puedeCancelar(compra: CompraResumen): boolean {
    if (compra.estado !== 'pagada') return false;
    if (compra.estado_entrada === 'validada') return false;
    if (compra.estado_candy === 'entregado') return false;

    const funcion = this.funcionInfo(compra);
    if (!funcion) return true;

    const limiteMs = this.horasLimite() * 60 * 60 * 1000;
    return new Date(funcion.fecha_hora_inicio).getTime() - Date.now() > limiteMs;
  }

  pedirCancelar(compra: CompraResumen) {
    this.mensaje.set('');
    this.compraACancelar.set(compra);
  }

  cerrarCancelar() {
    this.compraACancelar.set(null);
  }

  confirmarCancelar() {
    const compra = this.compraACancelar();
    this.compraACancelar.set(null);
    if (!compra) return;

    this.cancelandoId.set(compra.id);
    this.error.set('');

    this.comprasService.cancelar(compra.id).subscribe({
      next: credito => {
        this.cancelandoId.set(null);
        this.mensaje.set(`Compra cancelada. Se acreditaron ${credito} como crédito.`);
        this.auth.refrescarPerfil();
        const usuarioId = this.perfil()?.id;
        if (usuarioId) this.cargarCompras(usuarioId);
      },
      error: err => {
        this.cancelandoId.set(null);
        this.error.set(err.message);
      },
    });
  }

  volverAtras() {
    this.router.navigate(['/cartelera']);
  }
}
