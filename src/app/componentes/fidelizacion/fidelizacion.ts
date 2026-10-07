import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { CandyService } from '../../services/candy';
import { ResenasService } from '../../services/resenas';
import { FidelizacionService } from '../../services/fidelizacion';
import { Canje, PeliculaVista } from '../../models/canje';
import { Resena } from '../../models/resena';
import { FormatoPuntosPipe } from '../../pipes/formato-puntos-pipe-pipe';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

interface RecompensaCandy {
  id: string;
  nombre: string;
  precio: number;
  costo_en_puntos: number;
}

interface CanjePendiente {
  tipo: 'entrada' | 'candy';
  productoId: string | null;
  nombre: string;
  costoPuntos: number;
}

// Lo que queda de un canje de candy ya resuelto, para mostrar el QR y poder descargar el PDF
interface CanjeCandyListo {
  compraId: string;
  codigoQr: string;
  productoNombre: string;
  puntosUsados: number;
}

export const ESTRELLAS = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-fidelizacion',
  imports: [CurrencyPipe, TitleCasePipe, FormatoPuntosPipe, VentanaConfirmacion],
  templateUrl: './fidelizacion.html',
  styleUrl: './fidelizacion.css',
})
export class Fidelizacion implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private auth = inject(Auth);
  private comprasService = inject(ComprasService);
  private configuracionService = inject(ConfiguracionService);
  private candyService = inject(CandyService);
  private resenasService = inject(ResenasService);
  private fidelizacionService = inject(FidelizacionService);

  readonly rango = ESTRELLAS;

  cargando = signal(true);
  error = signal('');
  mensaje = signal('');

  canjes = signal<Canje[]>([]);
  peliculas = signal<PeliculaVista[]>([]);
  misResenas = signal<Resena[]>([]);
  recompensasCandy = signal<RecompensaCandy[]>([]);

  costoPuntosEntrada = signal(0);

  canjePendiente = signal<CanjePendiente | null>(null);
  canjeando = signal(false);
  guardandoCalificacion = signal<string | null>(null);

  canjeCandyListo = signal<CanjeCandyListo | null>(null);
  qrPreviewUrl = signal('');

  perfil = computed(() => this.auth.perfilActual());
  puntos = computed(() => Number(this.perfil()?.puntos_fidelizacion ?? 0));
  credito = computed(() => Number(this.perfil()?.credito_extra ?? 0));

  ngOnInit() {
    const usuarioId = this.perfil()?.id;
    if (!usuarioId) {
      this.cargando.set(false);
      this.error.set('Necesitás iniciar sesión para ver tu perfil de fidelización.');
      return;
    }

    this.cargarTodo(usuarioId);
  }

  private cargarTodo(usuarioId: string) {
    this.cargando.set(true);

    this.configuracionService.getConfiguracion().subscribe({
      next: items => {
        const costo = items.find(i => i.clave === 'costo_puntos_entrada')?.valor;
        if (costo != null) this.costoPuntosEntrada.set(Number(costo));
      },
    });

    this.candyService.getProductos().then((result: any) => {
      const productos = (result.data ?? []) as RecompensaCandy[];
      this.recompensasCandy.set(productos.filter(p => p.costo_en_puntos > 0));
    });

    this.cargarCanjes(usuarioId);
    this.cargarPeliculas(usuarioId);
    this.cargarResenas(usuarioId);

    this.cargando.set(false);
  }

  private cargarCanjes(usuarioId: string) {
    this.fidelizacionService.misCanjes(usuarioId).subscribe({
      next: lista => this.canjes.set(lista),
      error: err => this.error.set(err.message),
    });
  }

  private cargarPeliculas(usuarioId: string) {
    this.comprasService.misPeliculas(usuarioId).subscribe({
      next: lista => this.peliculas.set(lista),
      error: err => this.error.set(err.message),
    });
  }

  private cargarResenas(usuarioId: string) {
    this.resenasService.misResenas(usuarioId).subscribe({
      next: lista => this.misResenas.set(lista),
    });
  }

  miCalificacion(peliculaId: string): number {
    return this.misResenas().find(r => r.pelicula_id === peliculaId)?.estrellas ?? 0;
  }

  puedeCanjearEntrada(): boolean {
    return this.costoPuntosEntrada() > 0 && this.puntos() >= this.costoPuntosEntrada();
  }

  puedeCanjearCandy(producto: RecompensaCandy): boolean {
    return this.puntos() >= producto.costo_en_puntos;
  }

  pedirCanjeEntrada() {
    if (!this.puedeCanjearEntrada()) return;
    this.mensaje.set('');
    this.canjeCandyListo.set(null);
    this.canjePendiente.set({
      tipo: 'entrada',
      productoId: null,
      nombre: 'Entrada gratis (2D)',
      costoPuntos: this.costoPuntosEntrada(),
    });
  }

  pedirCanjeCandy(producto: RecompensaCandy) {
    if (!this.puedeCanjearCandy(producto)) return;
    this.mensaje.set('');
    this.canjeCandyListo.set(null);
    this.canjePendiente.set({
      tipo: 'candy',
      productoId: producto.id,
      nombre: producto.nombre,
      costoPuntos: producto.costo_en_puntos,
    });
  }

  cerrarCanje() {
    this.canjePendiente.set(null);
  }

  confirmarCanje() {
    const pendiente = this.canjePendiente();
    const usuarioId = this.perfil()?.id;
    if (!pendiente || !usuarioId) return;

    this.canjePendiente.set(null);
    this.canjeando.set(true);
    this.error.set('');

    this.fidelizacionService.canjear(pendiente.tipo, pendiente.productoId).subscribe({
      next: resultado => {
        this.canjeando.set(false);
        this.auth.refrescarPerfil();
        this.cargarCanjes(usuarioId);

        if (pendiente.tipo === 'candy' && resultado.compra_id && resultado.codigo_qr) {
          this.canjeCandyListo.set({
            compraId: resultado.compra_id,
            codigoQr: resultado.codigo_qr,
            productoNombre: pendiente.nombre,
            puntosUsados: pendiente.costoPuntos,
          });
          this.generarQrPreview(resultado.codigo_qr);
        } else {
          // Entrada: queda un voucher pendiente, no hay QR todavía. Se termina eligiendo butaca.
          this.mensaje.set('¡Listo! Tu entrada gratis está lista para usar. Elegí la película y la función...');
          setTimeout(() => this.router.navigate(['/cartelera']), 1800);
        }
      },
      error: err => {
        this.canjeando.set(false);
        this.error.set(err.message);
      },
    });
  }

  // `qrcode` es un módulo CommonJS puro; según cómo lo trate el bundler, el import dinámico
  // a veces devuelve el objeto directo y a veces lo envuelve en `.default`.
  private async qrToDataUrl(texto: string): Promise<string> {
    const mod: any = await import('qrcode');
    const QRCode = mod.toDataURL ? mod : mod.default;
    return QRCode.toDataURL(texto, { width: 300, margin: 1 });
  }

  private async generarQrPreview(codigoQr: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.qrPreviewUrl.set(await this.qrToDataUrl(codigoQr));
  }

  async descargarPdfCanje() {
    const canje = this.canjeCandyListo();
    if (!canje || !isPlatformBrowser(this.platformId)) return;

    const [{ default: jsPDF }, qrDataUrl] = await Promise.all([
      import('jspdf'),
      this.qrPreviewUrl() || this.qrToDataUrl(canje.codigoQr),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const anchoPagina = doc.internal.pageSize.getWidth();
    const altoPagina = doc.internal.pageSize.getHeight();
    const centroX = anchoPagina / 2;

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, anchoPagina, altoPagina, 'F');
    doc.setFillColor(26, 26, 26);
    doc.setDrawColor(46, 45, 45);
    doc.roundedRect(6, 6, anchoPagina - 12, altoPagina - 12, 6, 6, 'FD');

    let y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Candy canjeado con puntos', centroX, y, { align: 'center', maxWidth: anchoPagina - 20 });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(189, 189, 189);
    doc.text('Mostrá este código en el candy bar para retirarlo', centroX, y, { align: 'center' });

    y += 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(222, 222, 222);
    doc.roundedRect(centroX - 33, y - 3, 66, 66, 4, 4, 'FD');
    doc.addImage(qrDataUrl, 'PNG', centroX - 30, y, 60, 60);

    y += 72;
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setCharSpace(0.7);
    const anchoTexto = doc.getTextWidth(canje.codigoQr) + canje.codigoQr.length * 0.7;
    const anchoChip = Math.min(anchoTexto + 14, anchoPagina - 20);
    const altoChip = 11;
    doc.setFillColor(17, 17, 17);
    doc.setDrawColor(46, 45, 45);
    doc.roundedRect(centroX - anchoChip / 2, y, anchoChip, altoChip, altoChip / 2, altoChip / 2, 'FD');
    doc.setTextColor(250, 204, 21);
    doc.text(canje.codigoQr, centroX - anchoTexto / 2, y + altoChip / 2 + 1.3);
    doc.setCharSpace(0);

    y += altoChip + 10;
    const filas: [string, string][] = [
      ['Producto', canje.productoNombre],
      ['Puntos usados', `${canje.puntosUsados} pts`],
      ['Total pagado', '$0 (canjeado con puntos)'],
    ];

    const inicioX = centroX - 48;
    const anchoEtiqueta = 32;
    const anchoValor = 96 - anchoEtiqueta;
    doc.setFontSize(10);
    filas.forEach(([etiqueta, valor]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(156, 163, 175);
      doc.text(`${etiqueta}:`, inicioX, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      const lineas = doc.splitTextToSize(valor || '-', anchoValor);
      doc.text(lineas, inicioX + anchoEtiqueta, y);
      y += Math.max(lineas.length, 1) * 5.2 + 2;
    });

    doc.save(`canje-candy-${canje.compraId}.pdf`);
  }

  calificar(pelicula: PeliculaVista, estrellas: number) {
    const perfil = this.perfil();
    if (!perfil) return;

    this.guardandoCalificacion.set(pelicula.pelicula_id);
    const existente = this.misResenas().find(r => r.pelicula_id === pelicula.pelicula_id);

    this.resenasService.guardarResena({
      usuario_id: perfil.id,
      pelicula_id: pelicula.pelicula_id,
      estrellas,
      comentario_corto: existente?.comentario_corto ?? null,
      nombre_autor: perfil.nombre ?? null,
    }).subscribe({
      next: () => {
        this.guardandoCalificacion.set(null);
        this.cargarResenas(perfil.id);
      },
      error: err => {
        this.guardandoCalificacion.set(null);
        this.error.set(err.message);
      },
    });
  }

  formatoFecha(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(fecha));
  }

  volverAtras() {
    this.router.navigate(['/cartelera']);
  }
}
