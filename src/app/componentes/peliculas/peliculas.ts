import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { Pelicula } from '../../models/pelicula';
import { PeliculasService } from '../../services/peliculas';

@Component({
  imports: [CommonModule, FormField],
  selector: 'app-peliculas',
  styleUrl: './peliculas.css',
  templateUrl: './peliculas.html',
})
export class Peliculas implements OnInit {
  // 1. El estado actual del formulario
  peliculaModel = signal<Pelicula>({
    nombre: '', 
  });

  // 2. Configuración de las validaciones
  peliculaForm = form(this.peliculaModel, (schemaPath) => {
    required(schemaPath.nombre, { message: 'El nombre es requerido' });
  });

  // 3. La lista donde guardaremos las películas traídas de la base de datos
  peliculas = signal<Pelicula[]>([]);

  constructor(private peliculasService: PeliculasService) {}

  ngOnInit() {
    this.cargarPeliculas();
  }

  // 4. Función para pedirle al servicio que traiga los datos
  private cargarPeliculas() {
    this.peliculasService.getPeliculas().then(result => {
      this.peliculas.set(result.data || []);
    });
  }

  // 5. Función que se ejecuta al darle "Submit" al formulario
  onSubmit(event: Event) {
    event.preventDefault();
    const nombreNuevo = this.peliculaModel().nombre.trim();
    
    if (!nombreNuevo) {
      return;
    }

    this.agregarPelicula({ nombre: nombreNuevo });
  }

  // 6. Función para mandar a guardar la película en Supabase
  agregarPelicula(pelicula: Pelicula) {
    this.peliculasService.addPelicula(pelicula).then(() => {
      // Limpiamos el input del formulario volviendo a dejar el nombre vacío
      this.peliculaModel.set({ nombre: '' });
      // Recargamos la tabla para que aparezca la nueva película
      this.cargarPeliculas();
    });
  }
}