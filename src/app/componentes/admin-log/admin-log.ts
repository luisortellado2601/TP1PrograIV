import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LogActividad } from '../../models/log';
import { LogsService } from '../../services/logs';

const VERBOS: Record<string, string> = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' };

const ENTIDADES: Record<string, string> = {
  funciones: 'una función',
  peliculas: 'una película',
  productos_candy: 'un producto del candy',
  combos: 'un combo',
  cupones: 'un cupón',
  precios_formato: 'un precio por formato',
  configuracion: 'la configuración',
  compras: 'una compra',
};

const TITULOS_COMPRA: Record<NonNullable<LogActividad['subtipoCompra']>, string> = {
  cancelacion: 'Canceló una compra',
  candy: 'Entregó el candy de una compra',
  entrada: 'Validó la entrada de una compra',
  otro: 'Modificó una compra',
};

// UUID internos: no le dicen nada a un lector no técnico, se ocultan de la vista amigable
const CAMPOS_OCULTOS = new Set([
  'id', 'usuario_id', 'cupon_id', 'pelicula_id', 'sala_id', 'producto_id', 'compra_id', 'usuario_empleado_id',
]);

const CAMPOS_FECHA = new Set([
  'creada_en', 'fecha_hora_inicio', 'fecha_hora_fin', 'fecha_estreno', 'fecha_fin_preventa', 'fecha_nacimiento',
]);

const CAMPOS_MONEDA = new Set([
  'precio', 'precio_preventa', 'total', 'subtotal', 'descuento', 'credito_usado', 'precio_unitario', 'valor',
]);

interface CampoDetalle {
  etiqueta: string;
  valor: string;
}

@Component({
  selector: 'app-admin-log',
  imports: [],
  templateUrl: './admin-log.html',
  styleUrl: './admin-log.css',
})
export class AdminLog implements OnInit {
  private router = inject(Router);
  private logsService = inject(LogsService);

  cargando = signal(true);
  error = signal('');
  logs = signal<LogActividad[]>([]);
  private expandidos = signal<Set<string>>(new Set());

  ngOnInit() {
    this.logsService.getLogs().subscribe({
      next: lista => {
        this.logs.set(lista);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  nombreEmpleado(log: LogActividad): string {
    if (!log.empleado) return 'Sistema / usuario eliminado';
    return `${log.empleado.nombre} ${log.empleado.apellido}`;
  }

  formatoFecha(fecha: string | null): string {
    if (!fecha) return '-';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(fecha));
  }

  // "UPDATE compras" / "INSERT funciones" -> "Canceló una compra" / "Creó una función"
  tituloLog(log: LogActividad): string {
    const [operacion, tabla] = log.accion.split(' ');

    if (tabla === 'compras') {
      return TITULOS_COMPRA[log.subtipoCompra ?? 'otro'];
    }

    const verbo = VERBOS[operacion] ?? operacion;
    const entidad = ENTIDADES[tabla] ?? this.humanizarClave(tabla ?? '');
    return `${verbo} ${entidad}`;
  }

  camposDetalle(log: LogActividad): CampoDetalle[] {
    if (!log.detalle) return [];
    return Object.entries(log.detalle)
      .filter(([clave]) => !CAMPOS_OCULTOS.has(clave))
      .map(([clave, valor]) => ({
        etiqueta: this.humanizarClave(clave),
        valor: this.formatearValor(clave, valor),
      }));
  }

  estaExpandido(id: string): boolean {
    return this.expandidos().has(id);
  }

  toggleDetalle(id: string) {
    this.expandidos.update(set => {
      const nuevo = new Set(set);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  }

  volverAtras() {
    this.router.navigate(['/admin']);
  }

  private humanizarClave(clave: string): string {
    const texto = clave.replace(/_/g, ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  private formatearValor(clave: string, valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return '-';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';

    if (CAMPOS_FECHA.has(clave) && typeof valor === 'string') {
      const fecha = new Date(valor);
      if (!isNaN(fecha.getTime())) return this.formatoFecha(valor);
    }

    if (CAMPOS_MONEDA.has(clave) && typeof valor === 'number') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
      }).format(valor);
    }

    if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '-';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
  }
}
