import { Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { CurrencyPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Html5Qrcode } from 'html5-qrcode';
import { CompraValidacion } from '../../models/compra';
import { ValidacionService } from '../../services/validacion';

@Component({
  selector: 'app-admin-validacion',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './admin-validacion.html',
  styleUrl: './admin-validacion.css',
})
export class AdminValidacion implements OnDestroy {
  private router = inject(Router);
  private validacionService = inject(ValidacionService);
  private platformId = inject(PLATFORM_ID);
  private titleCasePipe = new TitleCasePipe();

  // Se importa dinámicamente (solo en el navegador) para no incluir la librería en el bundle del servidor (SSR)
  private scanner: Html5Qrcode | null = null;
  private procesandoEscaneo = false;

  codigo = signal('');
  escaneando = signal(false);
  errorCamara = signal('');
  buscando = signal(false);
  validandoEntrada = signal(false);
  validandoCandy = signal(false);
  error = signal('');
  mensaje = signal('');
  compra = signal<CompraValidacion | null>(null);

  ngOnDestroy() {
    this.scanner?.stop().catch(() => { });
  }

  async iniciarEscaneo() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.errorCamara.set('');
    this.procesandoEscaneo = false;
    this.escaneando.set(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.scanner = new Html5Qrcode('lector-qr');

      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        codigoDetectado => {
          if (this.procesandoEscaneo) return;
          this.procesandoEscaneo = true;
          this.codigo.set(codigoDetectado);
          this.detenerEscaneo();
          this.buscar();
        },
        () => {
          // se llama en cada frame sin QR detectado: no hay nada que hacer
        },
      );
    } catch {
      this.errorCamara.set('No pudimos acceder a la cámara. Probá escribir el código a mano.');
      this.escaneando.set(false);
    }
  }

  async detenerEscaneo() {
    const scanner = this.scanner;
    this.scanner = null;
    this.escaneando.set(false);

    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // ya estaba detenido
    }
  }

  buscar() {
    const codigo = this.codigo().trim();
    if (!codigo) return;

    this.buscando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.compra.set(null);

    this.validacionService.buscarPorCodigo(codigo).subscribe({
      next: compra => {
        this.compra.set(compra);
        this.buscando.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.buscando.set(false);
      },
    });
  }

  validarEntrada() {
    const compra = this.compra();
    if (!compra) return;

    this.validandoEntrada.set(true);
    this.error.set('');

    this.validacionService.validarEntrada(compra.id).subscribe({
      next: () => {
        this.compra.set({ ...compra, estado_entrada: 'validada' });
        this.mensaje.set('Entrada validada: puede ingresar a la sala.');
        this.validandoEntrada.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.validandoEntrada.set(false);
      },
    });
  }

  validarCandy() {
    const compra = this.compra();
    if (!compra) return;

    this.validandoCandy.set(true);
    this.error.set('');

    this.validacionService.validarCandy(compra.id).subscribe({
      next: () => {
        this.compra.set({ ...compra, estado_candy: 'entregado' });
        this.mensaje.set('Candy entregado.');
        this.validandoCandy.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.validandoCandy.set(false);
      },
    });
  }

  nuevaBusqueda() {
    this.codigo.set('');
    this.compra.set(null);
    this.error.set('');
    this.mensaje.set('');
    this.errorCamara.set('');
  }

  nombreCliente(compra: CompraValidacion): string {
    return compra.perfiles ? `${compra.perfiles.nombre} ${compra.perfiles.apellido}` : 'Anónimo';
  }

  butacasTexto(compra: CompraValidacion): string {
    return compra.entradas_tickets
      .map(b => `${b.fila}-${b.columna}${b.es_vip ? ' (VIP)' : b.es_accesible ? ' (Accesible)' : ''}`)
      .join(', ');
  }

  candyTexto(compra: CompraValidacion): string {
    return compra.compra_items
      .map(i => `${i.cantidad} ${this.titleCasePipe.transform(i.productos_candy?.nombre ?? '')}`)
      .join(', ');
  }

  // Todas las entradas de una misma compra son de la misma función: alcanza con la primera
  funcionInfo(compra: CompraValidacion) {
    return compra.entradas_tickets[0]?.funciones ?? null;
  }

  formatoFuncion(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(fecha));
  }

  volverAtras() {
    this.router.navigate(['/admin']);
  }
}
