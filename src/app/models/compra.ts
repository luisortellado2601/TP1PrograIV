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
    total: number;
    puntos_ganados: number;
}

export const MAX_CANDY = 6;
