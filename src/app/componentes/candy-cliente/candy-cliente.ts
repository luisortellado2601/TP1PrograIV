import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CandyService } from '../../services/candy';
import { FormatoPuntosPipe } from '../../pipes/formato-puntos-pipe-pipe';
import { DestacadoColorDirective } from '../../directives/destacado-color-directive';

export interface ProductoCandy {
  id?: string;
  nombre: string;
  categoria: string;
  precio: number;
  costo_en_puntos: number;
  es_combo_destacado: boolean;
}

interface ItemCarrito extends ProductoCandy {
  cantidad: number;
}

@Component({
  selector: 'app-candy-cliente',
  standalone: true,
  imports: [
    CommonModule, 
    TitleCasePipe, 
    CurrencyPipe, 
    RouterLink, 
    FormatoPuntosPipe, 
    DestacadoColorDirective
  ],
  templateUrl: './candy-cliente.html',
  styleUrl: './candy-cliente.css'
})
export class CandyCliente implements OnInit {
  productos = signal<ProductoCandy[]>([]);
  carrito = signal<ItemCarrito[]>([]);

  // Computed signal que recalcula el total automáticamente cada vez que cambia el carrito
  totalPagar = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  });

  constructor(private candyService: CandyService) {}

  ngOnInit() {
    this.candyService.getProductos().then(result => {
      this.productos.set(result.data || []);
    });
  }

  agregarAlCarrito(producto: ProductoCandy) {
    this.carrito.update(items => {
      const existe = items.find(i => i.id === producto.id);
      if (existe) {
        return items.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...items, { ...producto, cantidad: 1 }];
    });
  }

  quitarDelCarrito(productoId: string) {
    this.carrito.update(items => {
      const existe = items.find(i => i.id === productoId);
      if (existe && existe.cantidad > 1) {
        return items.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i);
      }
      return items.filter(i => i.id !== productoId);
    });
  }

  obtenerCantidad(productoId: string | undefined): number {
    if (!productoId) return 0;
    const item = this.carrito().find(i => i.id === productoId);
    return item ? item.cantidad : 0;
  }
}