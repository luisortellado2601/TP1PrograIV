import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeliculasService } from '../../services/peliculas'; 
import { Pelicula, GENEROS } from '../../models/pelicula'; 
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';

@Component({
  selector: 'app-cartelera',
  imports: [CommonModule, FormatoDuracionPipe, EdadColorDirective],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css'
})
export class Cartelera implements OnInit {
  listaGeneros = GENEROS;
  listaPeliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true); 
  generoSeleccionado = signal<string>('Todos');

  peliculasFiltradas = computed(() => {
    const genero = this.generoSeleccionado();
    const todas = this.listaPeliculas();
    
    if (genero === 'Todos') return todas;
    return todas.filter(p => p.generos?.includes(genero));
  });

  top3Peliculas = computed(() => {
    return this.listaPeliculas().slice(0, 3);
  });

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

  cambiarFiltro(genero: string) {
    this.generoSeleccionado.set(genero);
  }
}