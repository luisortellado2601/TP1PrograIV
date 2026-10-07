import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Butaca, FuncionMapa, ReservaButaca, claveButaca, construirSala } from '../../models/butaca';
import { MAX_CANDY, ResultadoCompra } from '../../models/compra';
import { Cupon } from '../../models/configuracion';
import { Auth } from '../../services/auth';
import { ButacasService } from '../../services/butacas';
import { CandyService } from '../../services/candy';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { FidelizacionService } from '../../services/fidelizacion';
import { DestacadoColorDirective } from '../../directives/destacado-color-directive';
import { FormatoPuntosPipe } from '../../pipes/formato-puntos-pipe-pipe';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

// Igual al de candy-cliente y admin-candy: cada pantalla define su propia forma del producto
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
  selector: 'app-compra',
  imports: [
    CurrencyPipe, TitleCasePipe, RouterLink, ReactiveFormsModule,
    DestacadoColorDirective, FormatoPuntosPipe, VentanaConfirmacion,
  ],
  templateUrl: './compra.html',
  styleUrl: './compra.css',
})
export class Compra implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);
  private titleCasePipe = new TitleCasePipe();
  private auth = inject(Auth);
  private butacasService = inject(ButacasService);
  private configuracionService = inject(ConfiguracionService);
  private candyService = inject(CandyService);
  private comprasService = inject(ComprasService);
  private fidelizacionService = inject(FidelizacionService);

  readonly maxCandy = MAX_CANDY;

  private readonly sala = construirSala();
  private readonly butacasPorClave = new Map<string, Butaca>();

  private funcionId = '';
  private sesionId = '';

  funcion = signal<FuncionMapa | null>(null);
  cargando = signal(true);
  error = signal('');

  asientos = signal<Butaca[]>([]);
  precios = signal<Record<string, number>>({});
  recargoVip = signal(0);
  puntosPorPeso = signal(0);
  cupones = signal<Cupon[]>([]);

  productos = signal<ProductoCandy[]>([]);
  carrito = signal<ItemCarrito[]>([]);

  procesando = signal(false);
  errorPago = signal('');
  mostrarConfirmacion = signal(false);
  mostrarCancelar = signal(false);
  resultado = signal<ResultadoCompra | null>(null);
  qrPreviewUrl = signal('');

  formPago = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.minLength(3)]],
    numero: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/), tarjetaVencida]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  private perfil = computed(() => this.auth.perfilActual());

  // Si la película está en preventa (hoy <= fecha_fin_preventa), ese precio fijo reemplaza al de la tabla por formato.
  // Comparación en texto 'YYYY-MM-DD' para no arrastrar corrimientos de huso horario con new Date().
  precioBase = computed(() => {
    const pelicula = this.funcion()?.peliculas;
    const hoy = new Date().toISOString().slice(0, 10);
    if (pelicula?.precio_preventa && pelicula.fecha_fin_preventa && hoy <= pelicula.fecha_fin_preventa.slice(0, 10)) {
      return Number(pelicula.precio_preventa);
    }

    const formato = this.funcion()?.formato;
    return formato ? (this.precios()[formato] ?? 0) : 0;
  });

  totalEntradas = computed(() => this.asientos().reduce(
    (acc, b) => acc + this.precioBase() + (b.tipo === 'vip' ? this.recargoVip() : 0), 0));

  totalCandy = computed(() => this.carrito().reduce((acc, i) => acc + i.precio * i.cantidad, 0));
  totalArticulosCandy = computed(() => this.carrito().reduce((acc, i) => acc + i.cantidad, 0));

  // Resumen prolijo para la pantalla de confirmación (sin precio por línea, eso ya está en el total)
  butacasResumen = computed(() => this.asientos()
    .map(b => `${b.fila}-${b.numero}${b.tipo === 'vip' ? ' (VIP)' : ''}`)
    .join(', '));

  candyResumen = computed(() => this.carrito()
    .map(i => `${i.cantidad} ${i.nombre}`)
    .join(', '));

  // Los combos (entrada + pochoclos + bebida a precio fijo) se muestran aparte, destacados.
  // Cualquier categoría que empiece con "Combo" cuenta (Combos, Combo Económico, etc.)
  combos = computed(() => this.productos().filter(p => p.categoria?.startsWith('Combo')));
  candyRegular = computed(() => this.productos().filter(p => !p.categoria?.startsWith('Combo')));

  subtotal = computed(() => this.totalEntradas() + this.totalCandy());

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
    return cupon ? Number((this.subtotal() * cupon.porcentaje / 100).toFixed(2)) : 0;
  });

  total = computed(() => this.subtotal() - this.descuento());
  puntosEstimados = computed(() => this.perfil() ? Math.floor(this.total() * this.puntosPorPeso()) : 0);

  // Voucher de entrada gratis (canje de puntos): cubre el valor de una entrada 2D, antes del crédito
  tengoVoucherEntrada = signal(false);
  usarVoucher = signal(false);
  voucherAplicado = computed(() => this.usarVoucher() ? Math.min(this.precios()['2D'] ?? 0, this.totalEntradas()) : 0);
  totalConVoucher = computed(() => Math.max(this.total() - this.voucherAplicado(), 0));

  // Crédito disponible (de cancelaciones previas): se puede combinar con el pago simulado con tarjeta
  usarCredito = signal(false);
  creditoDisponible = computed(() => Number(this.perfil()?.credito_extra ?? 0));
  creditoAplicado = computed(() => this.usarCredito() ? Math.min(this.creditoDisponible(), this.totalConVoucher()) : 0);
  totalConCredito = computed(() => this.totalConVoucher() - this.creditoAplicado());

  // 13 o 18 si la película tiene restricción de edad
  edadMinima = computed(() => {
    const restriccion = this.funcion()?.peliculas?.restriccion_edad;
    return restriccion === '+18' ? 18 : restriccion === '+13' ? 13 : 0;
  });

  // Solo se bloquea a quien tiene sesión y no cumple la edad; los anónimos solo ven el aviso
  bloqueadoPorEdad = computed(() => {
    const perfil = this.perfil();
    if (!perfil?.fecha_nacimiento || !this.edadMinima()) return false;
    return this.calcularEdad(perfil.fecha_nacimiento) < this.edadMinima();
  });

  constructor() {
    this.sala.forEach(fila => fila.bloques.forEach(bloque => bloque.forEach(butaca => {
      if (butaca) this.butacasPorClave.set(claveButaca(butaca.fila, butaca.numero), butaca);
    })));
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('funcionId');
    if (!id) {
      this.error.set('No encontramos la función.');
      this.cargando.set(false);
      return;
    }
    this.funcionId = id;
    this.sesionId = this.leerSesionId();

    if (!this.sesionId) {
      this.error.set('No encontramos tu selección de butacas. Volvé a elegirlas.');
      this.cargando.set(false);
      return;
    }

    this.butacasService.getFuncion(id).subscribe({
      next: funcion => {
        this.funcion.set(funcion);
        this.cargarMisButacas();
      },
      error: () => {
        this.error.set('No encontramos la función.');
        this.cargando.set(false);
      },
    });

    this.configuracionService.getPreciosFormato().subscribe({
      next: lista => {
        const precios: Record<string, number> = {};
        lista.forEach(p => precios[p.formato] = Number(p.precio));
        this.precios.set(precios);
      },
    });

    this.configuracionService.getConfiguracion().subscribe({
      next: items => {
        this.recargoVip.set(Number(items.find(i => i.clave === 'recargo_vip')?.valor ?? 0));
        this.puntosPorPeso.set(Number(items.find(i => i.clave === 'puntos_por_peso')?.valor ?? 0));
      },
    });

    this.configuracionService.getCupones().subscribe({
      next: lista => this.cupones.set(lista),
    });

    this.candyService.getProductos().then(res => this.productos.set(res.data || []));

    const usuarioId = this.perfil()?.id;
    if (usuarioId) {
      this.fidelizacionService.tengoVoucherEntrada(usuarioId).subscribe({
        next: tiene => this.tengoVoucherEntrada.set(tiene),
      });
    }
  }

  private cargarMisButacas() {
    this.butacasService.getReservas(this.funcionId).subscribe({
      next: (lista: ReservaButaca[]) => {
        const mias = lista.filter(r => r.sesion_id === this.sesionId)
          .map(r => this.butacasPorClave.get(claveButaca(r.fila, r.columna)))
          .filter((b): b is Butaca => !!b);

        if (!mias.length) {
          this.error.set('Tu reserva venció. Volvé a elegir las butacas.');
        } else {
          this.asientos.set(mias.sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero));
        }
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar tus butacas.');
        this.cargando.set(false);
      },
    });
  }

  private leerSesionId(): string {
    try {
      if (isPlatformBrowser(this.platformId)) {
        return sessionStorage.getItem('sesion-butacas') ?? '';
      }
    } catch {
      // sin almacenamiento disponible
    }
    return '';
  }

  private calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const yaCumplio = hoy.getMonth() > nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
    return yaCumplio ? edad : edad - 1;
  }

  // ----- Candy -----
  agregarCandy(producto: ProductoCandy) {
    if (this.totalArticulosCandy() >= this.maxCandy) return;

    this.carrito.update(items => {
      const existe = items.find(i => i.id === producto.id);
      if (existe) return items.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...items, { ...producto, cantidad: 1 }];
    });
  }

  quitarCandy(productoId: string) {
    this.carrito.update(items => {
      const existe = items.find(i => i.id === productoId);
      if (existe && existe.cantidad > 1) return items.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i);
      return items.filter(i => i.id !== productoId);
    });
  }

  obtenerCantidadCandy(productoId: string | undefined): number {
    if (!productoId) return 0;
    return this.carrito().find(i => i.id === productoId)?.cantidad ?? 0;
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

  // Si el voucher y/o el crédito ya cubren todo, no hay nada que cobrar: no tiene sentido pedir
  // los datos de una tarjeta que ni siquiera se envían al backend (son solo de esta pantalla).
  nadaQueCobrar = computed(() => this.totalConCredito() <= 0);

  pedirConfirmacion() {
    if (this.bloqueadoPorEdad()) return;
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

    this.comprasService.comprar(this.funcionId, this.sesionId, cuponCodigo, candy, this.usarCredito(), this.usarVoucher()).subscribe({
      next: resultado => {
        this.resultado.set(resultado);
        this.procesando.set(false);
        this.auth.refrescarPerfil(); // los puntos y el uso del cupón cambiaron en la base
        this.generarQrPreview(resultado.codigo_qr);
        try {
          if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem('sesion-butacas');
        } catch {
          // sin almacenamiento disponible
        }
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
    const f = this.funcion();
    if (!resultado || !f || !isPlatformBrowser(this.platformId)) return;

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
    doc.text('Entrada de cine', centroX, y, { align: 'center' });

    y += 9;
    doc.setFontSize(13);
    doc.text(this.titleCasePipe.transform(f.peliculas?.nombre ?? ''), centroX, y, { align: 'center' });

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(189, 189, 189);
    doc.text(this.formatoFuncion(f.fecha_hora_inicio) + ' hs', centroX, y, { align: 'center' });
    y += 6;
    doc.text(`${f.salas?.nombre ?? ''} · ${f.formato} ${f.idioma}`, centroX, y, { align: 'center' });

    // Tarjeta blanca con el QR (necesita fondo claro para poder escanearse)
    y += 9;
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

    // Datos de la compra, en formato etiqueta: valor
    y += altoChip + 10;
    const butacas = this.asientos().map(b => `${b.fila}-${b.numero}${b.tipo === 'vip' ? ' (VIP)' : ''}`).join(', ');
    const totalFormateado = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
    }).format(resultado.total);

    const filas: [string, string][] = [
      ['Película', this.titleCasePipe.transform(f.peliculas?.nombre ?? '')],
      ['Butacas', butacas],
    ];
    if (this.carrito().length) {
      filas.push(['Producto', this.carrito().map(i => `${i.cantidad} ${this.titleCasePipe.transform(i.nombre)}`).join(', ')]);
    }
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
    doc.text('Presentá este código para ingresar a la sala' + (this.carrito().length ? ' y retirar tu candy.' : '.'), centroX, y, { align: 'center', maxWidth: 110 });

    doc.save(`entrada-${resultado.compra_id}.pdf`);
  }

  pedirCancelar() {
    this.mostrarCancelar.set(true);
  }

  cerrarCancelar() {
    this.mostrarCancelar.set(false);
  }

  confirmarCancelacion() {
    this.mostrarCancelar.set(false);

    // Se liberan las butacas para que otra persona pueda elegirlas; no hace falta esperar la respuesta
    this.asientos().forEach(b =>
      this.butacasService.liberarButaca(this.funcionId, b.fila, b.numero, this.sesionId).subscribe());

    try {
      if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem('sesion-butacas');
    } catch {
      // sin almacenamiento disponible
    }

    this.router.navigate(['/cartelera']);
  }

  formatoFuncion(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(fecha));
  }

  volverAlMapa() {
    this.router.navigate(['/butacas', this.funcionId]);
  }
}
