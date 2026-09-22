import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeliculasService } from '../../services/peliculas'; 
import { Pelicula, GENEROS } from '../../models/pelicula'; 
import { FormatoDuracionPipe } from '../../pipes/formato-duracion-pipe-pipe';
import { EdadColorDirective } from '../../directives/edad-color-directive';

@Component({
  selector: 'app-cartelera',
  imports: [CommonModule, FormsModule, FormatoDuracionPipe, EdadColorDirective],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css'
})
export class Cartelera implements OnInit {
  listaGeneros = GENEROS;
  listaPeliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true); 
  generoSeleccionado = signal<string>('Todos');
  terminoBusqueda = signal<string>('');

  peliculasFiltradas = computed(() => {
    const genero = this.generoSeleccionado();
    const busqueda = this.terminoBusqueda().toLowerCase();
    const todas = this.listaPeliculas();
    
    return todas.filter(p => {
      const coincideTexto = p.nombre.toLowerCase().includes(busqueda);
      const coincideGenero = genero === 'Todos' || p.generos?.includes(genero);
      return coincideTexto && coincideGenero;
    });
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

  cambiarBusqueda(termino: string) {
    this.terminoBusqueda.set(termino);
  }
}