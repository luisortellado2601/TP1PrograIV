export interface Resena {
    id: string;
    usuario_id: string;
    pelicula_id: string;
    estrellas: number;
    comentario_corto: string | null;
    nombre_autor: string | null;
    creada_en: string | null;
}

export interface NuevaResena {
    usuario_id: string;
    pelicula_id: string;
    estrellas: number;
    comentario_corto: string | null;
    nombre_autor: string | null;
}
