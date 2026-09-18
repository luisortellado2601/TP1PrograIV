import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { form, FormField, required, min, minLength } from '@angular/forms/signals';
import { Pelicula, RESTRICCIONES_EDAD, IDIOMAS, FORMATOS, GENEROS } from '../../models/pelicula';
import { PeliculasService } from '../../services/peliculas';
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';

@Component({
  imports: [CommonModule, FormField, EdadColorDirective, TitleCasePipe, FormatoDuracionPipe],
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
  });

  peliculas = signal<Pelicula[]>([]);

  constructor(private peliculasService: PeliculasService) {}

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
      fecha_fin_preventa: pelicula.fecha_fin_preventa ? pelicula.fecha_fin_preventa.split('T')[0] : '',
      precio_preventa: pelicula.precio_preventa || 0
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        payload.fecha_fin_preventa = formValues.fecha_fin_preventa;
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

  eliminarPelicula(id?: string) {
    if (!id) return;
    if (confirm('¿Estás seguro de que querés eliminar esta película?')) {
      this.peliculasService.deletePelicula(id).then(() => {
        this.cargarPeliculas(); 
      });
    }
  }
}