import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CandyService } from '../../services/candy';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { Auth } from '../../services/auth';
import { FidelizacionService } from '../../services/fidelizacion';
import { Cupon } from '../../models/configuracion';
import { ResultadoCompra } from '../../models/compra';
import { FormatoPuntosPipe } from '../../pipes/formato-puntos-pipe-pipe';
import { DestacadoColorDirective } from '../../directives/destacado-color-directive';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

export interface ProductoCandy {
  id?: string;
  nombre: string;
  categoria: string;
  precio: number;
  costo_en_puntos: number;
  es_combo_destacado: boolean;
}

interface ItemCarrito extends ProductoCandy {
  cantidad: number;
}

// Lo que queda de un canje de puntos ya resuelto, para mostrar el QR y poder descargar el PDF
interface CanjeCandyListo {
  compraId: string;
  codigoQr: string;
  productoNombre: string;
  puntosUsados: number;
}

// La tarjeta no puede estar vencida (el pattern del campo ya garantiza el formato MM/AA)
function tarjetaVencida(control: AbstractControl): ValidationErrors | null {
  const valor = control.value as string;
  if (!/^\d{2}\/\d{2}$/.test(valor)) return null;

  const [mes, anio] = valor.split('/').map(Number);
  const hoy = new Date();
  const anioActual = hoy.getFullYear() % 100;
  const mesActual = hoy.getMonth() + 1;

  return (anio < anioActual || (anio === anioActual && mes < mesActual)) ? { vencida: true } : null;
}

@Component({
  selector: 'app-candy-cliente',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    FormatoPuntosPipe,
    DestacadoColorDirective,
    VentanaConfirmacion,
  ],
  templateUrl: './candy-cliente.html',
  styleUrl: './candy-cliente.css'
})
export class CandyCliente implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private platformId = inject(PLATFORM_ID);
  private configuracionService = inject(ConfiguracionService);
  private comprasService = inject(ComprasService);
  private fidelizacionService = inject(FidelizacionService);
  private titleCasePipe = new TitleCasePipe();

  productos = signal<ProductoCandy[]>([]);
  carrito = signal<ItemCarrito[]>([]);
  cupones = signal<Cupon[]>([]);

  procesando = signal(false);
  errorPago = signal('');
  mostrarConfirmacion = signal(false);
  resultado = signal<ResultadoCompra | null>(null);
  itemsConfirmados = signal<ItemCarrito[]>([]);
  qrPreviewUrl = signal('');

  // Canje de puntos (independiente del carrito/pago con tarjeta)
  canjePendienteProducto = signal<ProductoCandy | null>(null);
  canjeando = signal(false);
  errorCanje = signal('');
  canjeCandyListo = signal<CanjeCandyListo | null>(null);
  qrCanjePreviewUrl = signal('');

  LIMITE_ITEMS = 6;

  formPago = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.minLength(3)]],
    numero: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/), tarjetaVencida]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  private perfil = computed(() => this.auth.perfilActual());
  puntosFidelizacion = computed(() => Number(this.perfil()?.puntos_fidelizacion ?? 0));

  // Computed signal que recalcula el total automáticamente cada vez que cambia el carrito
  totalPagar = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  });

  // Cantidad total de artículos en el carrito (suma de todas las cantidades)
  totalArticulos = computed(() => {
    return this.carrito().reduce((acc, item) => acc + item.cantidad, 0);
  });

  // El cupón lo elige el sistema: entre los que le corresponden al usuario, el de mayor descuento (uno solo, no acumulable).
  // Los cupones son solo para clientes: empleados y gerentes no son elegibles.
  cuponElegible = computed<Cupon | null>(() => {
    const perfil = this.perfil();
    if (!perfil?.fecha_nacimiento || perfil.rol !== 'cliente') return null;

    const edad = this.calcularEdad(perfil.fecha_nacimiento);
    const candidatos = this.cupones().filter(c =>
      c.activo !== false &&
      (c.edad_minima == null || edad >= c.edad_minima) &&
      (!c.solo_primera_compra || !perfil.uso_cupon_registro));

    if (!candidatos.length) return null;
    return candidatos.reduce((mejor, c) => c.porcentaje > mejor.porcentaje ? c : mejor);
  });

  descuento = computed(() => {
    const cupon = this.cuponElegible();
    return cupon ? Number((this.totalPagar() * cupon.porcentaje / 100).toFixed(2)) : 0;
  });

  totalFinal = computed(() => this.totalPagar() - this.descuento());

  // Crédito disponible (de cancelaciones previas): se puede combinar con el pago simulado con tarjeta
  usarCredito = signal(false);
  creditoDisponible = computed(() => Number(this.perfil()?.credito_extra ?? 0));
  creditoAplicado = computed(() => this.usarCredito() ? Math.min(this.creditoDisponible(), this.totalFinal()) : 0);
  totalConCredito = computed(() => this.totalFinal() - this.creditoAplicado());

  // Resumen prolijo para la pantalla de confirmación (sin precio por línea, eso ya está en el total)
  candyResumen = computed(() => this.itemsConfirmados()
    .map(i => `${i.cantidad} ${i.nombre}`)
    .join(', '));

  constructor(private candyService: CandyService) {}

  ngOnInit() {
    this.candyService.getProductos().then(result => {
      // "Combo Económico" incluye una entrada obligatoria: acá no hay ninguna, así que no se ofrece.
      // La categoría "Combos" (ya existente) sí se sigue mostrando, como siempre.
      this.productos.set((result.data || []).filter(p => p.categoria !== 'Combo Económico'));
    });

    this.configuracionService.getCupones().subscribe({
      next: lista => this.cupones.set(lista),
    });
  }

  private calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const yaCumplio = hoy.getMonth() > nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
    return yaCumplio ? edad : edad - 1;
  }

  agregarAlCarrito(producto: ProductoCandy) {
    if (this.totalArticulos() >= this.LIMITE_ITEMS) return;

    this.carrito.update(items => {
      const existe = items.find(i => i.id === producto.id);
      if (existe) {
        return items.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...items, { ...producto, cantidad: 1 }];
    });
  }

  quitarDelCarrito(productoId: string) {
    this.carrito.update(items => {
      const existe = items.find(i => i.id === productoId);
      if (existe && existe.cantidad > 1) {
        return items.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i);
      }
      return items.filter(i => i.id !== productoId);
    });
  }

  obtenerCantidad(productoId: string | undefined): number {
    if (!productoId) return 0;
    const item = this.carrito().find(i => i.id === productoId);
    return item ? item.cantidad : 0;
  }

  // ----- Pago simulado -----
  invalidoPago(campo: 'titular' | 'numero' | 'vencimiento' | 'cvv'): boolean {
    const control = this.formPago.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  mensajePago(campo: 'titular' | 'numero' | 'vencimiento' | 'cvv'): string {
    const control = this.formPago.controls[campo];
    if (control.hasError('required')) return 'Campo requerido';
    if (campo === 'vencimiento' && control.hasError('vencida')) return 'La tarjeta está vencida';
    const mensajes = { titular: 'Mínimo 3 caracteres', numero: '16 números', vencimiento: 'Formato MM/AA', cvv: '3 números' };
    return mensajes[campo];
  }

  // Si el crédito ya cubre todo, no hay nada que cobrar: no tiene sentido pedir una tarjeta
  // que ni siquiera se envía al backend (es solo de esta pantalla).
  nadaQueCobrar = computed(() => this.totalConCredito() <= 0);

  pedirConfirmacion() {
    if (!this.carrito().length) return;
    if (!this.nadaQueCobrar() && this.formPago.invalid) {
      this.formPago.markAllAsTouched();
      return;
    }
    this.mostrarConfirmacion.set(true);
  }

  cancelarConfirmacion() {
    this.mostrarConfirmacion.set(false);
  }

  confirmarCompra() {
    this.mostrarConfirmacion.set(false);
    this.procesando.set(true);
    this.errorPago.set('');

    const candy = this.carrito().map(i => ({ producto_id: i.id!, cantidad: i.cantidad }));
    const cuponCodigo = this.cuponElegible()?.codigo ?? null;

    this.itemsConfirmados.set(this.carrito());

    this.comprasService.comprar(null, null, cuponCodigo, candy, this.usarCredito()).subscribe({
      next: resultado => {
        this.resultado.set(resultado);
        this.carrito.set([]);
        this.procesando.set(false);
        this.auth.refrescarPerfil(); // los puntos y el uso del cupón cambiaron en la base
        this.generarQrPreview(resultado.codigo_qr);
      },
      error: err => {
        this.errorPago.set(err.message);
        this.procesando.set(false);
      },
    });
  }

  // `qrcode` es un módulo CommonJS puro (exports.toDataURL = ...); según cómo lo trate el bundler,
  // el import dinámico a veces devuelve el objeto directo y a veces lo envuelve en `.default`.
  private async qrToDataUrl(texto: string): Promise<string> {
    const mod: any = await import('qrcode');
    const QRCode = mod.toDataURL ? mod : mod.default;
    return QRCode.toDataURL(texto, { width: 300, margin: 1 });
  }

  private async generarQrPreview(codigoQr: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.qrPreviewUrl.set(await this.qrToDataUrl(codigoQr));
  }

  async descargarPdf() {
    const resultado = this.resultado();
    if (!resultado || !isPlatformBrowser(this.platformId)) return;

    const [{ default: jsPDF }, qrDataUrl] = await Promise.all([
      import('jspdf'),
      this.qrPreviewUrl() || this.qrToDataUrl(resultado.codigo_qr),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const anchoPagina = doc.internal.pageSize.getWidth();
    const altoPagina = doc.internal.pageSize.getHeight();
    const centroX = anchoPagina / 2;

    // Fondo y tarjeta oscuros, igual al tema de la app (negro + panel #1a1a1a)
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, anchoPagina, altoPagina, 'F');
    doc.setFillColor(26, 26, 26);
    doc.setDrawColor(46, 45, 45);
    doc.roundedRect(6, 6, anchoPagina - 12, altoPagina - 12, 6, 6, 'FD');

    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Pedido de Candy Bar', centroX, y, { align: 'center' });

    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(189, 189, 189);
    doc.text('Mostrá este código en el candy bar para retirarlo', centroX, y, { align: 'center' });

    // Tarjeta blanca con el QR (necesita fondo claro para poder escanearse)
    y += 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(222, 222, 222);
    doc.roundedRect(centroX - 33, y - 3, 66, 66, 4, 4, 'FD');
    doc.addImage(qrDataUrl, 'PNG', centroX - 30, y, 60, 60);

    // Chip oscuro con el código, igual al de la pantalla (fondo #111, letras doradas)
    y += 72;
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setCharSpace(0.7);
    const anchoTexto = doc.getTextWidth(resultado.codigo_qr) + resultado.codigo_qr.length * 0.7;
    const anchoChip = Math.min(anchoTexto + 14, anchoPagina - 20);
    const altoChip = 11;
    doc.setFillColor(17, 17, 17);
    doc.setDrawColor(46, 45, 45);
    doc.roundedRect(centroX - anchoChip / 2, y, anchoChip, altoChip, altoChip / 2, altoChip / 2, 'FD');
    doc.setTextColor(250, 204, 21);
    // jsPDF no suma el letter-spacing (setCharSpace) al calcular el centro con align:'center',
    // por eso el texto queda descentrado; se posiciona a mano con el ancho real (anchoTexto) ya calculado.
    doc.text(resultado.codigo_qr, centroX - anchoTexto / 2, y + altoChip / 2 + 1.3);
    doc.setCharSpace(0);

    // Datos del pedido, en formato etiqueta: valor
    y += altoChip + 10;
    const totalFormateado = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
    }).format(resultado.total);

    const filas: [string, string][] = [
      ['Productos', this.itemsConfirmados().map(i => `${i.cantidad} ${this.titleCasePipe.transform(i.nombre)}`).join(', ')],
    ];
    if (resultado.credito_usado) {
      const creditoFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
      }).format(resultado.credito_usado);
      filas.push(['Crédito aplicado', `-${creditoFormateado}`]);
    }
    filas.push(['Puntos ganados', `${resultado.puntos_ganados ?? 0} pts`]);
    filas.push(['Total pagado', totalFormateado]);

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

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(119, 119, 119);
    doc.text('Presentá este código en el candy bar para retirar tu pedido.', centroX, y, { align: 'center', maxWidth: 110 });

    doc.save(`candy-${resultado.compra_id}.pdf`);
  }

  pedirOtroPedido() {
    this.resultado.set(null);
    this.itemsConfirmados.set([]);
    this.qrPreviewUrl.set('');
    this.formPago.reset();
  }

  // ----- Canje de puntos (genera una compra real a $0, con su propio QR, sin pasar por el carrito) -----
  puedeCanjearPuntos(producto: ProductoCandy): boolean {
    return producto.costo_en_puntos > 0 && this.puntosFidelizacion() >= producto.costo_en_puntos;
  }

  pedirCanjePuntos(producto: ProductoCandy) {
    if (!this.puedeCanjearPuntos(producto)) return;
    this.errorCanje.set('');
    this.canjeCandyListo.set(null);
    this.canjePendienteProducto.set(producto);
  }

  cerrarCanjePuntos() {
    this.canjePendienteProducto.set(null);
  }

  confirmarCanjePuntos() {
    const producto = this.canjePendienteProducto();
    if (!producto?.id) return;

    this.canjePendienteProducto.set(null);
    this.canjeando.set(true);
    this.errorCanje.set('');

    this.fidelizacionService.canjear('candy', producto.id).subscribe({
      next: resultado => {
        this.canjeando.set(false);
        this.auth.refrescarPerfil();

        if (resultado.compra_id && resultado.codigo_qr) {
          this.canjeCandyListo.set({
            compraId: resultado.compra_id,
            codigoQr: resultado.codigo_qr,
            productoNombre: producto.nombre,
            puntosUsados: producto.costo_en_puntos,
          });
          this.generarQrCanjePreview(resultado.codigo_qr);
        }
      },
      error: err => {
        this.canjeando.set(false);
        this.errorCanje.set(err.message);
      },
    });
  }

  private async generarQrCanjePreview(codigoQr: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.qrCanjePreviewUrl.set(await this.qrToDataUrl(codigoQr));
  }

  cerrarCanjeListo() {
    this.canjeCandyListo.set(null);
    this.qrCanjePreviewUrl.set('');
  }

  async descargarPdfCanje() {
    const canje = this.canjeCandyListo();
    if (!canje || !isPlatformBrowser(this.platformId)) return;

    const [{ default: jsPDF }, qrDataUrl] = await Promise.all([
      import('jspdf'),
      this.qrCanjePreviewUrl() || this.qrToDataUrl(canje.codigoQr),
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
}
