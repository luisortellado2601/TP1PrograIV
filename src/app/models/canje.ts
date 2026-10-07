export interface Canje {
    id: string;
    tipo: 'entrada' | 'candy';
    producto_nombre: string;
    puntos_usados: number;
    valor: number;
    consumido: boolean;
    creada_en: string;
}

// Lo que devuelve la función SQL `canjear_puntos`.
// Para 'candy' viene con compra_id/codigo_qr (ya generó su QR); para 'entrada' vienen null (es un voucher pendiente).
export interface ResultadoCanje {
    puntos_restantes: number;
    compra_id: string | null;
    codigo_qr: string | null;
}

// Una película que el usuario ya pagó, para "Mis películas"
export interface PeliculaVista {
    pelicula_id: string;
    nombre: string;
    imagen: string;
    fecha_hora_inicio: string;
}
