export interface ConfigItem {
    clave: string;
    valor: number;
    descripcion: string | null;
}

export interface PrecioFormato {
    formato: string;
    precio: number;
}

export interface Cupon {
    id?: string;
    codigo: string;
    descripcion: string | null;
    porcentaje: number;
    edad_minima: number | null;
    solo_primera_compra: boolean;
    activo?: boolean;
}

// Valores configurables por el admin (claves de la tabla `configuracion`)
export const CAMPOS_CONFIG = [
    { clave: 'recargo_vip', etiqueta: 'Recargo butaca VIP ($)' },
    { clave: 'puntos_por_peso', etiqueta: 'Puntos por cada $1 gastado' },
    { clave: 'costo_puntos_entrada', etiqueta: 'Puntos por entrada gratis' },
    { clave: 'horas_limite_cancelar', etiqueta: 'Horas límite para cancelar' },
];
