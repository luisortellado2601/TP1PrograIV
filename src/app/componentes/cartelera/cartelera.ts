import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeliculasService } from '../../services/peliculas';
import { AlertasService } from '../../services/alertas';
import { PushService } from '../../services/push';
import { Pelicula, GENEROS } from '../../models/pelicula';
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cartelera',
  imports: [CommonModule, FormsModule, FormatoDuracionPipe, EdadColorDirective, RouterLink],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css'
})
export class Cartelera implements OnInit {
  listaGeneros = GENEROS;
  listaPeliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);
  generoSeleccionado = signal<string>('Todos');
  terminoBusqueda = signal<string>('');

  ventasPorPelicula = signal<string[]>([]);
  alertasActivas = signal<string[]>([]);
  alertaEnviando = signal<string | null>(null);

  // Ya estrenadas (o sin fecha cargada): lo que se ve en el buscador principal
  enCartelera = computed(() => this.listaPeliculas().filter(p => !this.esProximamente(p)));

  // Con fecha de estreno futura: sección aparte, sin funciones para comprar todavía
  proximamente = computed(() => this.listaPeliculas().filter(p => this.esProximamente(p)));

  // Solo se ofrecen como filtro los géneros que de verdad tienen alguna película en cartelera
  // (si nadie cargó una de Crimen, por ejemplo, ese botón ni aparece)
  generosDisponibles = computed(() => {
    const presentes = new Set<string>();
    this.enCartelera().forEach(p => p.generos?.forEach(g => presentes.add(g)));
    return this.listaGeneros.filter(g => presentes.has(g));
  });

  peliculasFiltradas = computed(() => {
    const genero = this.generoSeleccionado();
    const busqueda = this.terminoBusqueda().toLowerCase();
    const todas = this.enCartelera();

    return todas.filter(p => {
      const coincideTexto = p.nombre.toLowerCase().includes(busqueda);
      const coincideGenero = genero === 'Todos' || p.generos?.includes(genero);
      return coincideTexto && coincideGenero;
    });
  });

  // Las más vendidas primero (entradas no canceladas); si no hay ventas todavía, completa con el resto
  top3Peliculas = computed(() => {
    const disponibles = this.enCartelera();
    const conteos = new Map<string, number>();
    this.ventasPorPelicula().forEach(id => conteos.set(id, (conteos.get(id) ?? 0) + 1));

    const masVendidas = disponibles
      .filter(p => conteos.has(p.id!))
      .sort((a, b) => conteos.get(b.id!)! - conteos.get(a.id!)!);

    const resto = disponibles.filter(p => !conteos.has(p.id!));
    return [...masVendidas, ...resto].slice(0, 3);
  });

  constructor(
    private peliculasService: PeliculasService,
    private alertasService: AlertasService,
    private pushService: PushService,
    public authService: Auth,
    private router: Router) {}

  async ngOnInit() {
    const { data, error } = await this.peliculasService.getPeliculas();

    this.cargando.set(false);

    if (error) {
      console.error('Error al cargar la cartelera:', error.message);
      return;
    }

    if (data) {
      this.listaPeliculas.set(data as Pelicula[]);
    }

    this.peliculasService.getVentasPorPelicula()
      .then(ventas => this.ventasPorPelicula.set(ventas))
      .catch(err => console.error('Error al calcular el ranking de ventas:', err.message));

    const usuarioId = this.authService.perfilActual()?.id;
    if (usuarioId) {
      this.alertasService.getActivasDeUsuario(usuarioId)
        .then(activas => this.alertasActivas.set(activas))
        .catch(err => console.error('Error al cargar las alertas activas:', err.message));
    }
  }

  private esProximamente(pelicula: Pelicula): boolean {
    if (!pelicula.fecha_estreno) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(pelicula.fecha_estreno) > hoy;
  }

  tieneAlertaActiva(peliculaId: string | undefined): boolean {
    return !!peliculaId && this.alertasActivas().includes(peliculaId);
  }

  async activarAlerta(pelicula: Pelicula) {
    const usuarioId = this.authService.perfilActual()?.id;
    if (!usuarioId || !pelicula.id) return;

    this.alertaEnviando.set(pelicula.id);
    try {
      await this.alertasService.activarAlerta(pelicula.id, usuarioId);
      this.alertasActivas.update(lista => [...lista, pelicula.id!]);
    } catch (err: any) {
      console.error('Error al activar la alerta:', err.message);
    } finally {
      this.alertaEnviando.set(null);
    }

    // Suscripción push separada: si el navegador bloquea el permiso, la alerta ya quedó guardada igual
    try {
      await this.pushService.suscribir(usuarioId);
    } catch (err) {
      console.error('No se pudo suscribir a las notificaciones push:', err);
    }
  }

  cambiarFiltro(genero: string) {
    this.generoSeleccionado.set(genero);
  }

  cambiarBusqueda(termino: string) {
    this.terminoBusqueda.set(termino);
  }

  volverAdmin(){
    this.router.navigate(['/admin']);
  }
}
