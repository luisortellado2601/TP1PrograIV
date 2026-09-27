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
  private auth = inject(Auth);
  private butacasService = inject(ButacasService);
  private configuracionService = inject(ConfiguracionService);
  private candyService = inject(CandyService);
  private comprasService = inject(ComprasService);

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
  cuponManual = signal('');

  formPago = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.minLength(3)]],
    numero: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/), tarjetaVencida]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  private perfil = computed(() => this.auth.perfilActual());

  precioBase = computed(() => {
    const formato = this.funcion()?.formato;
    return formato ? (this.precios()[formato] ?? 0) : 0;
  });

  totalEntradas = computed(() => this.asientos().reduce(
    (acc, b) => acc + this.precioBase() + (b.tipo === 'vip' ? this.recargoVip() : 0), 0));

  totalCandy = computed(() => this.carrito().reduce((acc, i) => acc + i.precio * i.cantidad, 0));
  totalArticulosCandy = computed(() => this.carrito().reduce((acc, i) => acc + i.cantidad, 0));

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

  // Si el usuario escribe un código a mano, ese manda; si no, se aplica el automático
  cuponEfectivo = computed<Cupon | null>(() => {
    const codigo = this.cuponManual().trim().toUpperCase();
    if (!codigo) return this.cuponElegible();
    return this.cupones().find(c => c.codigo.toUpperCase() === codigo && c.activo !== false) ?? null;
  });

  cuponInvalido = computed(() => !!this.cuponManual().trim() && !this.cuponEfectivo());

  descuento = computed(() => {
    const cupon = this.cuponEfectivo();
    return cupon ? Number((this.subtotal() * cupon.porcentaje / 100).toFixed(2)) : 0;
  });

  total = computed(() => this.subtotal() - this.descuento());
  puntosEstimados = computed(() => this.perfil() ? Math.floor(this.total() * this.puntosPorPeso()) : 0);

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

  aplicarCupon(codigo: string) {
    this.cuponManual.set(codigo.trim());
  }

  quitarCupon() {
    this.cuponManual.set('');
  }

  pedirConfirmacion() {
    if (this.bloqueadoPorEdad()) return;
    if (this.formPago.invalid) {
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
    const cuponCodigo = this.cuponEfectivo()?.codigo ?? null;

    this.comprasService.comprar(this.funcionId, this.sesionId, cuponCodigo, candy).subscribe({
      next: resultado => {
        this.resultado.set(resultado);
        this.procesando.set(false);
        this.auth.refrescarPerfil(); // los puntos y el uso del cupón cambiaron en la base
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
