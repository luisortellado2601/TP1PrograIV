import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { FuncionesService } from '../../services/funciones';
import { ResenasService } from '../../services/resenas';
import { Auth } from '../../services/auth';
import { Pelicula } from '../../models/pelicula';
import { FuncionPublica } from '../../models/funcion';
import { Resena } from '../../models/resena';
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';

@Component({
  selector: 'app-pelicula-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormatoDuracionPipe, EdadColorDirective],
  templateUrl: './pelicula-detalle.html',
  styleUrl: './pelicula-detalle.css'
})

export class PeliculaDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private resenasService = inject(ResenasService);
  authService = inject(Auth);

  pelicula = signal<Pelicula | null>(null);
  cargando = signal<boolean>(true);

  funciones = signal<FuncionPublica[]>([]);
  diaSeleccionado = signal<string>('');
  funcionSeleccionada = signal<FuncionPublica | null>(null);

  dias = computed(() => Array.from(new Set(this.funciones().map(f => f.fecha_hora_inicio.substring(0, 10)))));
  funcionesDelDia = computed(() => this.funciones().filter(f => f.fecha_hora_inicio.startsWith(this.diaSeleccionado())));

  readonly rango = [1, 2, 3, 4, 5];
  resenas = signal<Resena[]>([]);
  estrellasElegidas = signal<number>(0);
  guardandoResena = signal<boolean>(false);
  errorResena = signal<string>('');
  editando = signal<boolean>(false);

  formResena = this.fb.nonNullable.group({
    comentario: ['', Validators.maxLength(200)],
  });

  promedio = computed(() => {
    const lista = this.resenas();
    return lista.length ? lista.reduce((acc, r) => acc + r.estrellas, 0) / lista.length : 0;
  });
  promedioRedondeado = computed(() => Math.round(this.promedio()));

  miResena = computed(() => {
    const id = this.authService.perfilActual()?.id;
    return this.resenas().find(r => r.usuario_id === id);
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      const { data, error } = await this.peliculasService.getPeliculaById(id);
      if (data) {
        this.pelicula.set(data as Pelicula);
        this.cargarFunciones(id);
        this.cargarResenas(id);
      }
    }
    this.cargando.set(false);
  }

  private cargarFunciones(peliculaId: string) {
    this.funcionesService.getFuncionesDePelicula(peliculaId).subscribe({
      next: funciones => {
        this.funciones.set(funciones);
        this.diaSeleccionado.set(this.dias()[0] ?? '');
      },
      error: () => this.funciones.set([]),
    });
  }

  elegirDia(dia: string) {
    this.diaSeleccionado.set(dia);
    this.funcionSeleccionada.set(null);
  }

  elegirFuncion(funcion: FuncionPublica) {
    this.funcionSeleccionada.set(funcion);
  }

  // 'Hoy · sáb, 26 sept' / 'Mañana · dom, 27 sept' / 'lun, 28 sept'
  etiquetaDia(dia: string): string {
    const fecha = new Date(dia + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diferencia = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
    const texto = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }).format(fecha);
    return (diferencia === 0 ? 'Hoy · ' : diferencia === 1 ? 'Mañana · ' : '') + texto;
  }

  horaFuncion(funcion: FuncionPublica): string {
    return funcion.fecha_hora_inicio.substring(11, 16);
  }

  elegirButacas() {
    const funcion = this.funcionSeleccionada();
    if (funcion) this.router.navigate(['/butacas', funcion.id]);
  }

  private cargarResenas(peliculaId: string) {
    this.resenasService.getResenas(peliculaId).subscribe({
      next: resenas => this.resenas.set(resenas),
      error: () => this.resenas.set([]),
    });
  }

  elegirEstrellas(cantidad: number) {
    this.estrellasElegidas.set(cantidad);
    this.errorResena.set('');
  }

  publicarResena() {
    const perfil = this.authService.perfilActual();
    const peliculaId = this.pelicula()?.id;
    if (!perfil || !peliculaId) return;

    if (this.estrellasElegidas() < 1) {
      this.errorResena.set('Elegí una calificación de 1 a 5 estrellas.');
      return;
    }
    if (this.formResena.invalid) {
      this.errorResena.set('El comentario no puede superar los 200 caracteres.');
      return;
    }

    this.guardandoResena.set(true);
    this.errorResena.set('');

    this.resenasService.guardarResena({
      usuario_id: perfil.id,
      pelicula_id: peliculaId,
      estrellas: this.estrellasElegidas(),
      comentario_corto: this.formResena.getRawValue().comentario.trim() || null,
      nombre_autor: perfil.nombre ?? null,
    }).subscribe({
      next: () => {
        this.guardandoResena.set(false);
        this.limpiarResena();
        this.cargarResenas(peliculaId);
      },
      error: err => {
        this.guardandoResena.set(false);
        this.errorResena.set('No se pudo guardar la reseña: ' + err.message);
      },
    });
  }

  editarMiResena() {
    const mia = this.miResena();
    if (!mia) return;
    this.estrellasElegidas.set(mia.estrellas);
    this.formResena.setValue({ comentario: mia.comentario_corto ?? '' });
    this.errorResena.set('');
    this.editando.set(true);
  }

  cancelarEdicion() {
    this.limpiarResena();
  }

  private limpiarResena() {
    this.editando.set(false);
    this.errorResena.set('');
    this.estrellasElegidas.set(0);
    this.formResena.reset({ comentario: '' });
  }
}
