import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { form, FormField, required, min, minLength, pattern } from '@angular/forms/signals';
import { Pelicula, RESTRICCIONES_EDAD, IDIOMAS, FORMATOS, GENEROS } from '../../models/pelicula';
import { PeliculasService } from '../../services/peliculas';
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

@Component({
  imports: [CommonModule, FormField, EdadColorDirective, TitleCasePipe, FormatoDuracionPipe, VentanaConfirmacion],
  selector: 'app-peliculas',
  styleUrl: './peliculas.css',
  templateUrl: './peliculas.html',
})
export class Peliculas implements OnInit {
  listaEdades = RESTRICCIONES_EDAD;
  listaIdiomas = IDIOMAS;
  listaFormatos = FORMATOS;  
  listaGeneros = GENEROS; 
  
  mostrarFormulario = signal(true);
  peliculaEditandoId = signal<string | null>(null);
  peliculaAEliminar = signal<Pelicula | null>(null);

  peliculaModel = signal<Pelicula>({
    nombre: '',
    sinopsis: '',
    imagen: '',
    duracion_minutos: 0,
    restriccion_edad: '',
    formatos_disponibles: '',
    idiomas_disponibles: '',
    generos: [],
    fecha_fin_preventa: '',
    precio_preventa: 0
  });

  peliculaForm = form(this.peliculaModel, (schemaPath) => {
    required(schemaPath.nombre, { message: 'El nombre es obligatorio' });
    minLength(schemaPath.nombre, 2, { message: 'Mínimo 2 caracteres' });
    required(schemaPath.duracion_minutos, { message: 'Requerido' });
    min(schemaPath.duracion_minutos, 1, { message: 'Debe ser mayor a 0' });
    required(schemaPath.restriccion_edad, { message: 'Seleccione una clasificación' });
    required(schemaPath.idiomas_disponibles, { message: 'Seleccione un idioma' });
    required(schemaPath.formatos_disponibles, { message: 'Seleccione un formato' });
    required(schemaPath.generos, { message: 'Especifique al menos un género' });
    pattern(schemaPath.fecha_fin_preventa, /^\d{2}\/\d{2}\/\d{4}$/, { message: 'Debe usar el formato DD/MM/AAAA' });
  });

  peliculas = signal<Pelicula[]>([]);

  constructor(
    private peliculasService: PeliculasService, 
    private router: Router,
    private authService: Auth) {}

  ngOnInit() {
    this.cargarPeliculas();
  }

  private cargarPeliculas() {
    this.peliculasService.getPeliculas().then(result => {
      this.peliculas.set(result.data || []);
    });
  }
  
  toggleGenero(genero: string, event: Event) {
      const isChecked = (event.target as HTMLInputElement).checked;
      const generosActuales: string[] = this.peliculaModel().generos || [];
      let nuevosGeneros: string[];
      
      if (isChecked) {
        nuevosGeneros = [...generosActuales, genero];
      } else {
        nuevosGeneros = generosActuales.filter((g: string) => g !== genero);
      }

      this.peliculaModel.update(model => ({
        ...model,
        generos: nuevosGeneros
      }));
  }



  cargarParaEditar(pelicula: Pelicula) {
    this.peliculaEditandoId.set(pelicula.id || null);
    
    this.peliculaModel.set({
      nombre: pelicula.nombre,
      sinopsis: pelicula.sinopsis || '',
      imagen: pelicula.imagen || '',
      duracion_minutos: pelicula.duracion_minutos || 0,
      restriccion_edad: pelicula.restriccion_edad || '',
      formatos_disponibles: pelicula.formatos_disponibles?.[0] || '',
      idiomas_disponibles: pelicula.idiomas_disponibles?.[0] || '',
      generos: pelicula.generos || [],
      fecha_fin_preventa: pelicula.fecha_fin_preventa ? pelicula.fecha_fin_preventa.split('T')[0].split('-').reverse().join('/') : '',      
      precio_preventa: pelicula.precio_preventa || 0
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

    formatearFecha(event: Event) {
    const input = event.target as HTMLInputElement;
    let valor = input.value.replace(/\D/g, ''); 

    if (valor.length > 8) {
      valor = valor.substring(0, 8); 
    }

    if (valor.length > 4) {
      valor = `${valor.substring(0, 2)}/${valor.substring(2, 4)}/${valor.substring(4)}`;
    } else if (valor.length > 2) {
      valor = `${valor.substring(0, 2)}/${valor.substring(2)}`;
    }

    input.value = valor;
    this.peliculaModel.update(m => ({ ...m, fecha_fin_preventa: valor }));
  }

  onSubmit(event: Event) {
    event.preventDefault();
    
    if (this.peliculaForm().valid()) {
      const formValues = this.peliculaModel();
      
      const payload: any = {
        nombre: formValues.nombre,
        sinopsis: formValues.sinopsis,
        imagen: formValues.imagen,
        duracion_minutos: Number(formValues.duracion_minutos),
        restriccion_edad: formValues.restriccion_edad, 
        formatos_disponibles: [formValues.formatos_disponibles], 
        idiomas_disponibles: [formValues.idiomas_disponibles],
        generos: formValues.generos, 
        precio_preventa: Number(formValues.precio_preventa)
      };

      if (formValues.fecha_fin_preventa) {
        const [dia, mes, anio] = formValues.fecha_fin_preventa.split('/');
        const fechaIngresada = new Date(Number(anio), Number(mes) - 1, Number(dia));
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fechaIngresada < hoy) {
          alert('Error: La fecha de fin de preventa no puede ser anterior a la fecha actual')
          return
        }
        payload.fecha_fin_preventa = `${anio}-${mes}-${dia}`;
      }

      const idEditando = this.peliculaEditandoId();
      
      if (idEditando) {
        payload.id = idEditando;
        this.actualizarPelicula(payload);
      } else {
        this.agregarPelicula(payload);
      }
    }
  }

  agregarPelicula(pelicula: any) {
    this.peliculasService.addPelicula(pelicula).then(() => {
      this.limpiarFormulario();
      this.cargarPeliculas();
    });
  }

  actualizarPelicula(pelicula: any) {
    this.peliculasService.updatePelicula(pelicula).then(() => {
      this.limpiarFormulario();
      this.cargarPeliculas();
    });
  }

  cancelarEdicion() {
    this.limpiarFormulario();
  }

  private limpiarFormulario() {
    this.peliculaEditandoId.set(null);
    this.peliculaModel.set({
      nombre: '', sinopsis: '', imagen: '', duracion_minutos: 0, 
      restriccion_edad: '', formatos_disponibles: '', idiomas_disponibles: '',
      generos: [], fecha_fin_preventa: '', precio_preventa: 0
    });

    const formObj = this.peliculaForm as any;
    if (typeof formObj.reset === 'function') {
      formObj.reset();
    } else if (typeof this.peliculaForm().reset === 'function') {
      (this.peliculaForm() as any).reset();
    }
    
    this.mostrarFormulario.set(false);
    setTimeout(() => this.mostrarFormulario.set(true), 0);
  }

  // Abre la ventana de confirmación con la película elegida
  pedirEliminar(pelicula: Pelicula) {
    this.peliculaAEliminar.set(pelicula);
  }

  cancelarEliminar() {
    this.peliculaAEliminar.set(null);
  }

  confirmarEliminar() {
    const id = this.peliculaAEliminar()?.id;
    this.peliculaAEliminar.set(null);
    if (!id) return;

    this.peliculasService.deletePelicula(id).then(() => {
      this.cargarPeliculas();
    });
  }

  volverAtras(){
    this.router.navigate(['/admin'])
  }

}
