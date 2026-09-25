import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CAMPOS_CONFIG, Cupon } from '../../models/configuracion';
import { FORMATOS } from '../../models/pelicula';
import { ConfiguracionService } from '../../services/configuracion';
import { VentanaConfirmacion } from '../ventana-confirmacion/ventana-confirmacion';

const VALIDAR_NUMERO = [Validators.required, Validators.min(0)];

@Component({
  selector: 'app-admin-configuracion',
  imports: [ReactiveFormsModule, VentanaConfirmacion],
  templateUrl: './admin-configuracion.html',
  styleUrl: './admin-configuracion.css',
})

export class AdminConfiguracion implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private configuracionService = inject(ConfiguracionService);

  readonly formatos = FORMATOS;
  readonly camposConfig = CAMPOS_CONFIG;

  // Valores tal como están guardados: sirven para enviar solo lo que cambió
  private originalesPrecios: Record<string, number> = {};
  private originalesConfig: Record<string, number> = {};

  // Campos que no se guardaron por estar vacíos o inválidos
  private omitidos: string[] = [];

  guardando = signal(false);
  mensaje = signal('');
  mensajeEsError = signal(false);

  formPrecios = this.fb.nonNullable.group({
    '2D': [0, VALIDAR_NUMERO],
    '3D': [0, VALIDAR_NUMERO],
    '4D': [0, VALIDAR_NUMERO],
    '5D': [0, VALIDAR_NUMERO],
  });

  formConfig = this.fb.nonNullable.group({
    recargo_vip: [0, VALIDAR_NUMERO],
    puntos_por_peso: [1, VALIDAR_NUMERO],
    costo_puntos_entrada: [500, VALIDAR_NUMERO],
    horas_limite_cancelar: [2, VALIDAR_NUMERO],
  });

  // ----- Cupones -----
  cupones = signal<Cupon[]>([]);
  cuponEditandoId = signal<string | null>(null);
  cuponAEliminar = signal<Cupon | null>(null);
  errorCupon = signal('');

  formCupon = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
    descripcion: [''],
    porcentaje: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    edad_minima: [null as number | null, Validators.min(1)],
    solo_primera_compra: [false],
  });

  ngOnInit() {
    this.cargarValores();
    this.cargarCupones();

    // Al modificar cualquier campo se limpia el mensaje anterior
    this.formPrecios.valueChanges.subscribe(() => this.mensaje.set(''));
    this.formConfig.valueChanges.subscribe(() => this.mensaje.set(''));
    this.formCupon.valueChanges.subscribe(() => this.errorCupon.set(''));
  }

  private cargarValores() {
    this.configuracionService.getPreciosFormato().subscribe({
      next: precios => {
        const valores: Record<string, number> = {};
        precios.forEach(p => valores[p.formato] = Number(p.precio));
        this.originalesPrecios = valores;
        // emitEvent: false para que cargar los valores no borre el mensaje de "guardado"
        Object.entries(valores).forEach(([formato, precio]) =>
          this.formPrecios.get(formato)?.setValue(precio, { emitEvent: false }));
      },
      error: () => this.mostrar('No se pudieron cargar los precios.', true),
    });

    this.configuracionService.getConfiguracion().subscribe({
      next: items => {
        const valores: Record<string, number> = {};
        items.forEach(i => valores[i.clave] = Number(i.valor));
        this.originalesConfig = valores;
        Object.entries(valores).forEach(([clave, valor]) =>
          this.formConfig.get(clave)?.setValue(valor, { emitEvent: false }));
      },
      error: () => this.mostrar('No se pudo cargar la configuración.', true),
    });
  }

  private mostrar(texto: string, esError: boolean) {
    this.mensaje.set(texto);
    this.mensajeEsError.set(esError);
  }

  invalidoPrecio(formato: string): boolean {
    const control = this.formPrecios.get(formato);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  invalidoConfig(clave: string): boolean {
    const control = this.formConfig.get(clave);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  // Mensaje según el error del campo numérico (vacío o negativo)
  mensajeNumero(control: AbstractControl | null): string {
    if (control?.hasError('required')) return 'Campo requerido';
    if (control?.hasError('min')) return 'No puede ser negativo';
    return 'Valor inválido';
  }

  guardar() {
    this.formPrecios.markAllAsTouched();
    this.formConfig.markAllAsTouched();
    this.omitidos = [];

    // Se guardan solo los campos válidos que cambiaron; los vacíos o inválidos se omiten y se avisa
    const precios: { formato: string; precio: number }[] = [];
    this.formatos.forEach(formato => {
      const control = this.formPrecios.get(formato);
      if (control?.invalid) {
        this.omitidos.push('Precio ' + formato);
        return;
      }
      const precio = Number(control?.value);
      if (precio !== this.originalesPrecios[formato]) precios.push({ formato, precio });
    });

    const config: { clave: string; valor: number }[] = [];
    this.camposConfig.forEach(campo => {
      const control = this.formConfig.get(campo.clave);
      if (control?.invalid) {
        this.omitidos.push(campo.etiqueta);
        return;
      }
      const valor = Number(control?.value);
      if (valor !== this.originalesConfig[campo.clave]) config.push({ clave: campo.clave, valor });
    });

    if (!precios.length && !config.length) {
      this.mostrar(
        this.omitidos.length
          ? `No se guardó: ${this.omitidos.join(', ')} (vacío o inválido).`
          : 'No hay cambios para guardar.',
        this.omitidos.length > 0,
      );
      return;
    }

    this.guardando.set(true);
    this.mensaje.set('');

    if (precios.length) {
      this.configuracionService.guardarPrecios(precios).subscribe({
        next: () => this.guardarConfig(config),
        error: err => this.falloGuardado(err),
      });
    } else {
      this.guardarConfig(config);
    }
  }

  private guardarConfig(config: { clave: string; valor: number }[]) {
    if (!config.length) {
      this.terminarGuardado();
      return;
    }

    this.configuracionService.guardarConfiguracion(config).subscribe({
      next: () => this.terminarGuardado(),
      error: err => this.falloGuardado(err),
    });
  }

  private terminarGuardado() {
    this.guardando.set(false);
    this.mostrar(
      this.omitidos.length
        ? `Se guardaron los cambios válidos. No se guardó: ${this.omitidos.join(', ')} (vacío o inválido).`
        : '✅ Cambios guardados.',
      this.omitidos.length > 0,
    );
    this.cargarValores();
  }

  private falloGuardado(err: Error) {
    this.guardando.set(false);
    this.mostrar('No se pudo guardar: ' + err.message, true);
  }

  // ----- Cupones -----
  private cargarCupones() {
    this.configuracionService.getCupones().subscribe({
      next: cupones => this.cupones.set(cupones),
      error: () => this.errorCupon.set('No se pudieron cargar los cupones.'),
    });
  }

  invalidoCupon(campo: 'codigo' | 'porcentaje' | 'edad_minima'): boolean {
    const control = this.formCupon.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  // Mensaje según el error del campo: vacío o fuera de rango
  mensajeCupon(campo: 'codigo' | 'porcentaje' | 'edad_minima'): string {
    if (this.formCupon.controls[campo].hasError('required')) {
      return campo === 'codigo' ? 'Ingresá un código' : 'Ingresá un porcentaje';
    }
    if (campo === 'codigo') return 'Entre 3 y 20 caracteres';
    if (campo === 'porcentaje') return 'Entre 1 y 100';
    return 'Debe ser mayor a 0';
  }

  guardarCupon() {
    if (this.formCupon.invalid) {
      this.formCupon.markAllAsTouched();
      return;
    }

    const v = this.formCupon.getRawValue();
    const cupon: Cupon = {
      codigo: v.codigo.trim().toUpperCase(),
      descripcion: v.descripcion.trim() || null,
      porcentaje: Number(v.porcentaje),
      edad_minima: v.edad_minima ? Number(v.edad_minima) : null,
      solo_primera_compra: v.solo_primera_compra,
    };

    const id = this.cuponEditandoId();
    const peticion = id
      ? this.configuracionService.actualizarCupon(id, cupon)
      : this.configuracionService.crearCupon(cupon);

    peticion.subscribe({
      next: () => {
        this.limpiarCupon();
        this.cargarCupones();
      },
      error: err => this.errorCupon.set(err.message),
    });
  }

  cargarParaEditar(cupon: Cupon) {
    this.cuponEditandoId.set(cupon.id ?? null);
    this.errorCupon.set('');
    this.formCupon.setValue({
      codigo: cupon.codigo,
      descripcion: cupon.descripcion ?? '',
      porcentaje: cupon.porcentaje,
      edad_minima: cupon.edad_minima,
      solo_primera_compra: cupon.solo_primera_compra,
    });
  }

  limpiarCupon() {
    this.cuponEditandoId.set(null);
    this.errorCupon.set('');
    this.formCupon.reset({
      codigo: '',
      descripcion: '',
      porcentaje: 10,
      edad_minima: null,
      solo_primera_compra: false,
    });
  }

  alternarActivo(cupon: Cupon) {
    if (!cupon.id) return;
    this.configuracionService.actualizarCupon(cupon.id, { activo: !cupon.activo }).subscribe({
      next: () => this.cargarCupones(),
      error: err => this.errorCupon.set(err.message),
    });
  }

  pedirEliminar(cupon: Cupon) {
    this.cuponAEliminar.set(cupon);
  }

  cancelarEliminar() {
    this.cuponAEliminar.set(null);
  }

  confirmarEliminar() {
    const id = this.cuponAEliminar()?.id;
    this.cuponAEliminar.set(null);
    if (!id) return;

    this.configuracionService.eliminarCupon(id).subscribe({
      next: () => this.cargarCupones(),
      error: err => this.errorCupon.set(err.message),
    });
  }

  volverAtras() {
    this.router.navigate(['/admin']);
  }
}
