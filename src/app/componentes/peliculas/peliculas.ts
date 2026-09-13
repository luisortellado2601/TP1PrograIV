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

  peliculaModel = signal<Pelicula>({
    nombre: '', 
  });

  peliculaForm = form(this.peliculaModel, (schemaPath) => {
    required(schemaPath.nombre, { message: 'El nombre es requerido' });
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

  onSubmit(event: Event) {
    event.preventDefault();
    const nombreNuevo = this.peliculaModel().nombre.trim();
    
    if (!nombreNuevo) {
      return;
    }

    this.agregarPelicula({ nombre: nombreNuevo });
  }

  agregarPelicula(pelicula: Pelicula) {
    this.peliculasService.addPelicula(pelicula).then(() => {
      this.peliculaModel.set({ nombre: '' });
      this.cargarPeliculas();
    });
  }
}