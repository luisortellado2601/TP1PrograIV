import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Butaca, FuncionMapa, MAX_BUTACAS, ReservaButaca, claveButaca, construirSala } from '../../models/butaca';
import { ButacasService } from '../../services/butacas';
import { ConfiguracionService } from '../../services/configuracion';

type EstadoButaca = 'libre' | 'seleccionada' | 'reservada' | 'vendida';

@Component({
  selector: 'app-mapa-butacas',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacas implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private butacasService = inject(ButacasService);
  private configuracionService = inject(ConfiguracionService);

  readonly sala = construirSala();
  readonly maxButacas = MAX_BUTACAS;

  // Todas las butacas por clave ('J-20'), para buscarlas rápido
  private readonly butacasPorClave = new Map<string, Butaca>();

  private funcionId = '';
  private sesionId = this.obtenerSesionId();
  private suscripcion?: Subscription;
  private temporizador?: ReturnType<typeof setInterval>;

  funcion = signal<FuncionMapa | null>(null);
  cargando = signal(true);
  errorCarga = signal('');
  aviso = signal('');
  procesando = signal(false);

  vendidas = signal<Set<string>>(new Set());
  reservas = signal<ReservaButaca[]>([]);
  precios = signal<Record<string, number>>({});
  recargoVip = signal(0);

  // Reservas de esta persona (sus butacas elegidas) y de las demás
  private clavesMias = computed(() => new Set(
    this.reservas().filter(r => r.sesion_id === this.sesionId).map(r => claveButaca(r.fila, r.columna))));
  private clavesDeOtros = computed(() => new Set(
    this.reservas().filter(r => r.sesion_id !== this.sesionId).map(r => claveButaca(r.fila, r.columna))));

  seleccionadas = computed(() => {
    const elegidas: Butaca[] = [];
    this.clavesMias().forEach(clave => {
      const butaca = this.butacasPorClave.get(clave);
      if (butaca) elegidas.push(butaca);
    });
    return elegidas.sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero);
  });

  textoSeleccion = computed(() => this.seleccionadas().map(b => claveButaca(b.fila, b.numero)).join(', '));
  tieneVip = computed(() => this.seleccionadas().some(b => b.tipo === 'vip'));

  precioBase = computed(() => {
    const formato = this.funcion()?.formato;
    return formato ? (this.precios()[formato] ?? 0) : 0;
  });

  total = computed(() => this.seleccionadas().reduce((acc, b) => acc + this.precioButaca(b), 0));

  // 13 o 18 si la película tiene restricción de edad
  edadMinima = computed(() => {
    const restriccion = this.funcion()?.peliculas?.restriccion_edad;
    return restriccion === '+18' ? 18 : restriccion === '+13' ? 13 : 0;
  });

  constructor() {
    this.sala.forEach(fila => fila.bloques.forEach(bloque => bloque.forEach(butaca => {
      if (butaca) this.butacasPorClave.set(claveButaca(butaca.fila, butaca.numero), butaca);
    })));
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('funcionId');
    if (!id) {
      this.errorCarga.set('No encontramos la función.');
      this.cargando.set(false);
      return;
    }
    this.funcionId = id;

    this.butacasService.getFuncion(id).subscribe({
      next: funcion => {
        this.funcion.set(funcion);
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set('No encontramos la función.');
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
      next: items => this.recargoVip.set(Number(items.find(i => i.clave === 'recargo_vip')?.valor ?? 0)),
    });

    this.recargarOcupacion();

    // Tiempo real: cuando otra persona reserva o compra, se actualiza el mapa.
    // Además se refresca cada 15 s para liberar las reservas que vencieron.
    if (isPlatformBrowser(this.platformId)) {
      this.suscripcion = this.butacasService.cambios(id).subscribe(() => this.recargarOcupacion());
      this.temporizador = setInterval(() => this.recargarOcupacion(), 15000);
    }
  }

  ngOnDestroy() {
    this.suscripcion?.unsubscribe();
    if (this.temporizador) clearInterval(this.temporizador);
  }

  // Identifica esta pestaña para saber cuáles reservas son propias (también funciona sin iniciar sesión)
  private obtenerSesionId(): string {
    try {
      if (isPlatformBrowser(this.platformId)) {
        const guardada = sessionStorage.getItem('sesion-butacas');
        if (guardada) return guardada;
        const nueva = crypto.randomUUID();
        sessionStorage.setItem('sesion-butacas', nueva);
        return nueva;
      }
    } catch {
      // sin almacenamiento: se usa un identificador temporal
    }
    return crypto.randomUUID();
  }

  private recargarOcupacion() {
    this.butacasService.getVendidas(this.funcionId).subscribe({
      next: lista => this.vendidas.set(new Set(lista.map(v => claveButaca(v.fila, v.columna)))),
      error: () => this.aviso.set('No se pudo actualizar el estado de las butacas.'),
    });

    this.butacasService.getReservas(this.funcionId).subscribe({
      next: lista => this.reservas.set(lista),
      error: () => this.aviso.set('No se pudo actualizar el estado de las butacas.'),
    });
  }

  estado(butaca: Butaca): EstadoButaca {
    const clave = claveButaca(butaca.fila, butaca.numero);
    if (this.vendidas().has(clave)) return 'vendida';
    if (this.clavesMias().has(clave)) return 'seleccionada';
    if (this.clavesDeOtros().has(clave)) return 'reservada';
    return 'libre';
  }

  clasesButaca(butaca: Butaca): string {
    return `${butaca.tipo} ${this.estado(butaca)}`;
  }

  bloqueada(butaca: Butaca): boolean {
    const estado = this.estado(butaca);
    return estado === 'vendida' || estado === 'reservada';
  }

  precioButaca(butaca: Butaca): number {
    return this.precioBase() + (butaca.tipo === 'vip' ? this.recargoVip() : 0);
  }

  tituloButaca(butaca: Butaca): string {
    const tipos = { normal: 'Butaca', vip: 'Butaca VIP', accesible: 'Butaca accesible' };
    const estados = { libre: '', seleccionada: ' · Elegida', reservada: ' · Reservada por otra persona', vendida: ' · Ocupada' };
    return `${butaca.fila}-${butaca.numero} · ${tipos[butaca.tipo]}${estados[this.estado(butaca)]}`;
  }

  alternar(butaca: Butaca) {
    const estado = this.estado(butaca);
    if (this.procesando() || estado === 'vendida' || estado === 'reservada') return;

    this.aviso.set('');

    if (estado === 'seleccionada') {
      this.liberar(butaca);
      return;
    }

    if (this.seleccionadas().length >= this.maxButacas) {
      this.aviso.set(`Podés elegir hasta ${this.maxButacas} butacas por compra.`);
      return;
    }

    this.reservar(butaca);
  }

  private reservar(butaca: Butaca) {
    this.procesando.set(true);
    this.butacasService.reservarButaca(this.funcionId, butaca.fila, butaca.numero, this.sesionId).subscribe({
      next: () => {
        this.reservas.update(lista => [...lista, { fila: butaca.fila, columna: butaca.numero, sesion_id: this.sesionId }]);
        this.procesando.set(false);
      },
      error: err => {
        this.aviso.set(err.message);
        this.procesando.set(false);
        this.recargarOcupacion();
      },
    });
  }

  private liberar(butaca: Butaca) {
    this.procesando.set(true);
    this.butacasService.liberarButaca(this.funcionId, butaca.fila, butaca.numero, this.sesionId).subscribe({
      next: () => {
        this.reservas.update(lista => lista.filter(r => !(r.fila === butaca.fila && r.columna === butaca.numero)));
        this.procesando.set(false);
      },
      error: err => {
        this.aviso.set(err.message);
        this.procesando.set(false);
      },
    });
  }

  formatoFuncion(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(fecha));
  }

  // La compra se arma en el siguiente bloque
  continuar() {
    if (this.seleccionadas().length) this.router.navigate(['/compra', this.funcionId]);
  }

  volver() {
    const peliculaId = this.funcion()?.peliculas?.id;
    this.router.navigate(peliculaId ? ['/pelicula-detalle', peliculaId] : ['/cartelera']);
  }
}
