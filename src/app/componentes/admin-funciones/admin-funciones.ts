import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DIAS_SEMANA, FuncionAdmin, PeliculaResumen, ResultadoCreacion, aTextoLocal } from '../../models/funcion';
import { FORMATOS, IDIOMAS } from '../../models/pelicula';
import { FuncionesService } from '../../services/funciones';
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { SelectorHorario } from '../selector-horario/selector-horario';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

function parseFecha(valor: string): Date | null {
  const partes = valor.split('/');
  if (partes.length !== 3) return null;

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const anio = Number(partes[2]);

  const fecha = new Date(anio, mes - 1, dia);
  const esValida = fecha.getDate() === dia && fecha.getMonth() === mes - 1 && fecha.getFullYear() === anio;
  return esValida ? fecha : null;
}

function fechaValida(control: AbstractControl): ValidationErrors | null {
  const valor = control.value as string;
  return !valor || parseFecha(valor) ? null : { fecha: true };
}

function rangoValido(grupo: AbstractControl): ValidationErrors | null {
  const desde = parseFecha(grupo.get('desde')?.value ?? '');
  const hasta = parseFecha(grupo.get('hasta')?.value ?? '');
  if (!desde || !hasta) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (hasta < desde) return { rango: 'La fecha final no puede ser anterior a la inicial' };
  if (hasta < hoy) return { rango: 'Las fechas no pueden estar en el pasado' };
  if ((hasta.getTime() - desde.getTime()) / 86400000 > 180) {
    return { rango: 'El período no puede superar los 180 días' };
  }
  return null;
}

@Component({
  selector: 'app-admin-funciones',
  imports: [ReactiveFormsModule, FormatoDuracionPipe, SelectorHorario, VentanaConfirmacion],
  templateUrl: './admin-funciones.html',
  styleUrl: './admin-funciones.css',
})
export class AdminFunciones implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private funcionesService = inject(FuncionesService);

  readonly diasSemana = DIAS_SEMANA;
  private readonly todosLosFormatos = FORMATOS;
  private readonly todosLosIdiomas = IDIOMAS;

  peliculas = signal<PeliculaResumen[]>([]);
  creando = signal(false);
  aviso = signal('');
  resultados = signal<ResultadoCreacion[]>([]);
  creadas = computed(() => this.resultados().filter(r => r.ok).length);
  fallidas = computed(() => this.resultados().filter(r => !r.ok).length);

  form = this.fb.nonNullable.group({
    peliculaId: ['', Validators.required],
    formato: ['', Validators.required],
    idioma: ['', Validators.required],
    hora: ['', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
    dias: [[] as number[], Validators.required],
    desde: ['', [Validators.required, fechaValida]],
    hasta: ['', [Validators.required, fechaValida]],
  }, { validators: rangoValido });

  funciones = signal<FuncionAdmin[]>([]);
  cargandoFunciones = signal(true);
  funcionAEliminar = signal<FuncionAdmin | null>(null);

  ngOnInit() {
    this.funcionesService.getPeliculas().subscribe({
      next: peliculas => this.peliculas.set(peliculas),
      error: () => this.aviso.set('No se pudieron cargar las películas.'),
    });
    this.cargarFunciones();
  }

  // Se vuelve a llamar cada vez que se crea o elimina una función
  private cargarFunciones() {
    this.funcionesService.getFunciones().subscribe({
      next: funciones => {
        this.funciones.set(funciones);
        this.cargandoFunciones.set(false);
      },
      error: () => {
        this.funciones.set([]);
        this.cargandoFunciones.set(false);
      },
    });
  }

  // Formatos e idiomas: los de la película elegida (o todos si no tiene cargados)
  opcionesFormato(): string[] {
    return this.opcionesDePelicula('formatos_disponibles', this.todosLosFormatos);
  }

  opcionesIdioma(): string[] {
    return this.opcionesDePelicula('idiomas_disponibles', this.todosLosIdiomas);
  }

  private opcionesDePelicula(campo: 'formatos_disponibles' | 'idiomas_disponibles', todos: string[]): string[] {
    const pelicula = this.peliculas().find(p => p.id === this.form.controls.peliculaId.value);
    const propias = pelicula?.[campo];
    return propias && propias.length ? propias : todos;
  }

  alCambiarPelicula() {
    const formatos = this.opcionesFormato();
    const idiomas = this.opcionesIdioma();
    const { formato, idioma } = this.form.controls;
    formato.setValue(formatos.length === 1 ? formatos[0] : (formatos.includes(formato.value) ? formato.value : ''));
    idioma.setValue(idiomas.length === 1 ? idiomas[0] : (idiomas.includes(idioma.value) ? idioma.value : ''));
  }

  elegirHora(valor: string) {
    this.form.controls.hora.setValue(valor);
    this.form.controls.hora.markAsTouched();
  }

  toggleDia(valor: number, event: Event) {
    const marcado = (event.target as HTMLInputElement).checked;
    const actuales = this.form.controls.dias.value;
    this.form.controls.dias.setValue(marcado ? [...actuales, valor] : actuales.filter(d => d !== valor));
    this.form.controls.dias.markAsTouched();
  }

  // Igual que en Películas: escribe solo los números y se agregan las barras
  formatearFecha(campo: 'desde' | 'hasta', event: Event) {
    const input = event.target as HTMLInputElement;
    let valor = input.value.replace(/\D/g, '').substring(0, 8);

    if (valor.length > 4) {
      valor = `${valor.substring(0, 2)}/${valor.substring(2, 4)}/${valor.substring(4)}`;
    } else if (valor.length > 2) {
      valor = `${valor.substring(0, 2)}/${valor.substring(2)}`;
    }

    input.value = valor;
    this.form.controls[campo].setValue(valor);
  }

  invalido(campo: 'peliculaId' | 'formato' | 'idioma' | 'hora' | 'dias' | 'desde' | 'hasta'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  // Todas las fechas del período que caen en los días elegidos y todavía no pasaron
  private generarInicios(desde: Date, hasta: Date, dias: number[], hora: string) {
    const [hh, mm] = hora.split(':').map(Number);
    const ahora = new Date();
    const inicios: { texto: string; etiqueta: string }[] = [];

    for (const dia = new Date(desde); dia <= hasta; dia.setDate(dia.getDate() + 1)) {
      if (!dias.includes(dia.getDay())) continue;
      const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hh, mm);
      if (inicio <= ahora) continue;
      inicios.push({ texto: aTextoLocal(inicio), etiqueta: this.formatoFuncion(inicio) });
    }
    return inicios;
  }

  formatoFuncion(fecha: Date | string): string {
    const f = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(f);
  }

  crear() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const inicios = this.generarInicios(parseFecha(v.desde)!, parseFecha(v.hasta)!, v.dias, v.hora);

    this.resultados.set([]);
    if (!inicios.length) {
      this.aviso.set('Ninguna fecha del período coincide con los días elegidos, o ya pasaron.');
      return;
    }

    this.aviso.set('');
    this.creando.set(true);

    this.crearSiguiente(inicios, 0, v.peliculaId, v.formato, v.idioma, []);
  }

  // Crea las funciones de a una, en orden: la base asigna la sala y evita cualquier solapamiento.
  // Cuando termina una (o falla), sigue con la siguiente; al final muestra el resultado.
  private crearSiguiente(
    inicios: { texto: string; etiqueta: string }[],
    indice: number,
    peliculaId: string,
    formato: string,
    idioma: string,
    resultados: ResultadoCreacion[],
  ) {
    if (indice >= inicios.length) {
      this.resultados.set(resultados);
      this.creando.set(false);
      this.cargarFunciones();
      return;
    }

    const inicio = inicios[indice];
    const siguiente = () => this.crearSiguiente(inicios, indice + 1, peliculaId, formato, idioma, resultados);

    this.funcionesService.crearFuncion(peliculaId, inicio.texto, formato, idioma).subscribe({
      next: () => resultados.push({ fecha: inicio.etiqueta, ok: true }),
      error: err => {
        resultados.push({ fecha: inicio.etiqueta, ok: false, mensaje: err.message });
        siguiente();
      },
      complete: siguiente,
    });
  }

  // Abre la ventana de confirmación con la función elegida
  pedirEliminar(funcion: FuncionAdmin) {
    this.funcionAEliminar.set(funcion);
  }

  cancelarEliminar() {
    this.funcionAEliminar.set(null);
  }

  mensajeEliminar(funcion: FuncionAdmin): string {
    const nombre = funcion.peliculas?.nombre ?? 'esta película';
    return `¿Eliminar la función de ${nombre} del ${this.formatoFuncion(funcion.fecha_hora_inicio)} hs?`;
  }

  confirmarEliminar() {
    const funcion = this.funcionAEliminar();
    if (!funcion) return;

    this.funcionAEliminar.set(null);
    this.funcionesService.eliminarFuncion(funcion.id).subscribe({
      next: () => this.cargarFunciones(),
      error: err => alert(err.message),
    });
  }

  volverAtras() {
    this.router.navigate(['/admin']);
  }
}
