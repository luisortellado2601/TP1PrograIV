import { CommonModule, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { form, FormField, required, min, minLength } from '@angular/forms/signals';
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

const CATEGORIAS_CANDY = ['Pochoclos', 'Bebidas', 'Golosinas', 'Combos'];

@Component({
  imports: [
    CommonModule, 
    FormField, 
    TitleCasePipe, 
    CurrencyPipe, 
    RouterLink, 
    FormatoPuntosPipe, 
    DestacadoColorDirective
  ],
  selector: 'app-candy',
  styleUrl: './admin-candy.css',
  templateUrl: './admin-candy.html',
})
export class Candy implements OnInit {
  listaCategorias = CATEGORIAS_CANDY;
  
  mostrarFormulario = signal(true);
  productoEditandoId = signal<string | null>(null);

  productoModel = signal<ProductoCandy>({
    nombre: '',
    categoria: '',
    precio: 0,
    costo_en_puntos: 0,
    es_combo_destacado: false
  });

  productoForm = form(this.productoModel, (schemaPath) => {
    required(schemaPath.nombre, { message: 'El nombre es obligatorio' });
    minLength(schemaPath.nombre, 2, { message: 'Mínimo 2 caracteres' });
    required(schemaPath.precio, { message: 'Requerido' });
    min(schemaPath.precio, 1, { message: 'Debe ser mayor a 0' });
    required(schemaPath.categoria, { message: 'Seleccione una categoría' });
    min(schemaPath.costo_en_puntos, 0, { message: 'No puede ser negativo' });
  });

  productos = signal<ProductoCandy[]>([]);

  constructor(private candyService: CandyService) {}

  ngOnInit() {
    this.cargarProductos();
  }

  private cargarProductos() {
    this.candyService.getProductos().then(result => {
      this.productos.set(result.data || []);
    });
  }

  cargarParaEditar(producto: ProductoCandy) {
    this.productoEditandoId.set(producto.id || null);
    
    this.productoModel.set({
      nombre: producto.nombre,
      categoria: producto.categoria || '',
      precio: producto.precio || 0,
      costo_en_puntos: producto.costo_en_puntos || 0,
      es_combo_destacado: producto.es_combo_destacado || false
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleDestacado(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.productoModel.update(model => ({
      ...model,
      es_combo_destacado: isChecked
    }));
  }

  onSubmit(event: Event) {
    event.preventDefault();
    
    if (this.productoForm().valid()) {
      const formValues = this.productoModel();
      
      const payload: any = {
        nombre: formValues.nombre,
        categoria: formValues.categoria,
        precio: Number(formValues.precio),
        costo_en_puntos: Number(formValues.costo_en_puntos),
        es_combo_destacado: formValues.es_combo_destacado
      };

      const idEditando = this.productoEditandoId();
      
      if (idEditando) {
        payload.id = idEditando;
        this.actualizarProducto(payload);
      } else {
        this.agregarProducto(payload);
      }
    }
  }

  agregarProducto(producto: any) {
    this.candyService.addProducto(producto).then(() => {
      this.limpiarFormulario();
      this.cargarProductos();
    });
  }

  actualizarProducto(producto: any) {
    this.candyService.updateProducto(producto).then(() => {
      this.limpiarFormulario();
      this.cargarProductos();
    });
  }

  cancelarEdicion() {
    this.limpiarFormulario();
  }

  private limpiarFormulario() {
    this.productoEditandoId.set(null);
    this.productoModel.set({
      nombre: '', categoria: '', precio: 0, costo_en_puntos: 0, es_combo_destacado: false
    });

    const formObj = this.productoForm as any;
    if (typeof formObj.reset === 'function') {
      formObj.reset();
    } else if (typeof this.productoForm().reset === 'function') {
      (this.productoForm() as any).reset();
    }
    
    this.mostrarFormulario.set(false);
    setTimeout(() => this.mostrarFormulario.set(true), 0);
  }

  eliminarProducto(id?: string) {
    if (!id) return;
    if (confirm('¿Estás seguro de que querés eliminar este producto?')) {
      this.candyService.deleteProducto(id).then(() => {
        this.cargarProductos(); 
      });
    }
  }
}