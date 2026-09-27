import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CandyService } from '../../services/candy';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { Auth } from '../../services/auth';
import { Cupon } from '../../models/configuracion';
import { ResultadoCompra } from '../../models/compra';
import { FormatoPuntosPipe } from '../../pipes/formato-puntos-pipe-pipe';
import { DestacadoColorDirective } from '../../directives/destacado-color-directive';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

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

// La tarjeta no puede estar vencida (el pattern del campo ya garantiza el formato MM/AA)
function tarjetaVencida(control: AbstractControl): ValidationErrors | null {
  const valor = control.value as string;
  if (!/^\d{2}\/\d{2}$/.test(valor)) return null;

  const [mes, anio] = valor.split('/').map(Number);
  const hoy = new Date();
  const anioActual = hoy.getFullYear() % 100;
  const mesActual = hoy.getMonth() + 1;

  return (anio < anioActual || (anio === anioActual && mes < mesActual)) ? { vencida: true } : null;
}

@Component({
  selector: 'app-candy-cliente',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    FormatoPuntosPipe,
    DestacadoColorDirective,
    VentanaConfirmacion,
  ],
  templateUrl: './candy-cliente.html',
  styleUrl: './candy-cliente.css'
})
export class CandyCliente implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private configuracionService = inject(ConfiguracionService);
  private comprasService = inject(ComprasService);

  productos = signal<ProductoCandy[]>([]);
  carrito = signal<ItemCarrito[]>([]);
  cupones = signal<Cupon[]>([]);

  procesando = signal(false);
  errorPago = signal('');
  mostrarConfirmacion = signal(false);
  resultado = signal<ResultadoCompra | null>(null);

  LIMITE_ITEMS = 6;

  formPago = this.fb.nonNullable.group({
    titular: ['', [Validators.required, Validators.minLength(3)]],
    numero: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/), tarjetaVencida]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  private perfil = computed(() => this.auth.perfilActual());

  // Computed signal que recalcula el total automáticamente cada vez que cambia el carrito
  totalPagar = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  });

  // Cantidad total de artículos en el carrito (suma de todas las cantidades)
  totalArticulos = computed(() => {
    return this.carrito().reduce((acc, item) => acc + item.cantidad, 0);
  });

  // El cupón lo elige el sistema: entre los que le corresponden al usuario, el de mayor descuento (uno solo, no acumulable).
  // Los cupones son solo para clientes: empleados y gerentes no son elegibles.
  cuponElegible = computed<Cupon | null>(() => {
    const perfil = this.perfil();
    if (!perfil?.fecha_nacimiento || perfil.rol !== 'cliente') return null;

    const edad = this.calcularEdad(perfil.fecha_nacimiento);
    const candidatos = this.cupones().filter(c =>
      c.activo !== false &&
      (c.edad_minima == null || edad >= c.edad_minima) &&
      (!c.solo_primera_compra || !perfil.uso_cupon_registro));

    if (!candidatos.length) return null;
    return candidatos.reduce((mejor, c) => c.porcentaje > mejor.porcentaje ? c : mejor);
  });

  descuento = computed(() => {
    const cupon = this.cuponElegible();
    return cupon ? Number((this.totalPagar() * cupon.porcentaje / 100).toFixed(2)) : 0;
  });

  totalFinal = computed(() => this.totalPagar() - this.descuento());

  constructor(private candyService: CandyService) {}

  ngOnInit() {
    this.candyService.getProductos().then(result => {
      // "Combo Económico" incluye una entrada obligatoria: acá no hay ninguna, así que no se ofrece.
      // La categoría "Combos" (ya existente) sí se sigue mostrando, como siempre.
      this.productos.set((result.data || []).filter(p => p.categoria !== 'Combo Económico'));
    });

    this.configuracionService.getCupones().subscribe({
      next: lista => this.cupones.set(lista),
    });
  }

  private calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const yaCumplio = hoy.getMonth() > nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
    return yaCumplio ? edad : edad - 1;
  }

  agregarAlCarrito(producto: ProductoCandy) {
    if (this.totalArticulos() >= this.LIMITE_ITEMS) return;

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

  // ----- Pago simulado -----
  invalidoPago(campo: 'titular' | 'numero' | 'vencimiento' | 'cvv'): boolean {
    const control = this.formPago.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  mensajePago(campo: 'titular' | 'numero' | 'vencimiento' | 'cvv'): string {
    const control = this.formPago.controls[campo];
    if (control.hasError('required')) return 'Campo requerido';
    if (campo === 'vencimiento' && control.hasError('vencida')) return 'La tarjeta está vencida';
    const mensajes = { titular: 'Mínimo 3 caracteres', numero: '16 números', vencimiento: 'Formato MM/AA', cvv: '3 números' };
    return mensajes[campo];
  }

  pedirConfirmacion() {
    if (!this.carrito().length) return;
    if (this.formPago.invalid) {
      this.formPago.markAllAsTouched();
      return;
    }
    this.mostrarConfirmacion.set(true);
  }

  cancelarConfirmacion() {
    this.mostrarConfirmacion.set(false);
  }

  confirmarCompra() {
    this.mostrarConfirmacion.set(false);
    this.procesando.set(true);
    this.errorPago.set('');

    const candy = this.carrito().map(i => ({ producto_id: i.id!, cantidad: i.cantidad }));
    const cuponCodigo = this.cuponElegible()?.codigo ?? null;

    this.comprasService.comprar(null, null, cuponCodigo, candy).subscribe({
      next: resultado => {
        this.resultado.set(resultado);
        this.carrito.set([]);
        this.procesando.set(false);
        this.auth.refrescarPerfil(); // los puntos y el uso del cupón cambiaron en la base
      },
      error: err => {
        this.errorPago.set(err.message);
        this.procesando.set(false);
      },
    });
  }

  pedirOtroPedido() {
    this.resultado.set(null);
    this.formPago.reset();
  }
}
