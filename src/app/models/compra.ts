// Producto de candy elegido, con lo necesario para mostrarlo y para mandarlo a la compra
export interface ItemCandySeleccionado {
    producto_id: string;
    nombre: string;
    precio: number;
    cantidad: number;
}

// Lo que devuelve la función SQL `comprar` (ya con precios y cupón recalculados en la base)
export interface ResultadoCompra {
    compra_id: string;
    codigo_qr: string;
    subtotal: number;
    descuento: number;
    credito_usado: number;
    total: number;
    puntos_ganados: number;
}

export const MAX_CANDY = 6;

// Estados reales de la tabla `compras` (constraints en la base)
export type EstadoCompra = 'pagada' | 'cancelada';
export type EstadoEntrada = 'pendiente' | 'validada' | 'cancelada' | 'sin_entrada';
export type EstadoCandy = 'sin_candy' | 'pendiente' | 'entregado' | 'cancelada';

export interface ButacaValidacion {
    fila: string;
    columna: number;
    es_vip: boolean;
    es_accesible: boolean;
    funciones: {
        fecha_hora_inicio: string;
        formato: string | null;
        idioma: string | null;
        peliculas: { nombre: string } | null;
        salas: { nombre: string } | null;
    } | null;
}

export interface ItemCandyValidacion {
    cantidad: number;
    precio_unitario: number;
    productos_candy: { nombre: string } | null;
}

// Lo que se busca por código de QR en el panel de validación de empleados
export interface CompraValidacion {
    id: string;
    codigo_qr: string;
    total: number;
    puntos_ganados: number;
    estado: EstadoCompra;
    estado_entrada: EstadoEntrada;
    estado_candy: EstadoCandy;
    creada_en: string;
    perfiles: { nombre: string; apellido: string } | null;
    entradas_tickets: ButacaValidacion[];
    compra_items: ItemCandyValidacion[];
}

// Una compra propia, para la pantalla "Mis compras" (sin datos de otro usuario, ya se sabe quién es)
export type CompraResumen = Omit<CompraValidacion, 'perfiles'>;
