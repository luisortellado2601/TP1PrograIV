import { Component, OnInit, signal } from '@angular/core';
import { PeliculasService } from '../../services/peliculas'; 
import { Pelicula } from '../../models/pelicula'; 

@Component({
  selector: 'app-cartelera',
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css'
})
export class Cartelera implements OnInit {
  
  listaPeliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true); 

  constructor(private peliculasService: PeliculasService) {}

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
  }
}