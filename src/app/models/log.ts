export type SubtipoCompra = 'cancelacion' | 'candy' | 'entrada' | 'otro';

export interface LogActividad {
    id: string;
    usuario_empleado_id: string | null;
    accion: string;
    fecha_hora: string | null;
    entidad: string | null;
    detalle: Record<string, unknown> | null;
    empleado?: { nombre: string; apellido: string } | null;
    // Solo para entidad 'compras': qué cambió puntualmente en esta fila, resuelto comparando
    // contra la fila anterior de la misma compra (el trigger solo guarda la foto final, no el diff).
    subtipoCompra?: SubtipoCompra;
}
