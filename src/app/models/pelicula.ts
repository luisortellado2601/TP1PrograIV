export interface Pelicula {
    id?: string;
    nombre: string;
    sinopsis: string;
    imagen: string; 
    duracion_minutos: number;
    restriccion_edad: string;
    formatos_disponibles: string; 
    idiomas_disponibles: string; 
    generos: string []; 
    fecha_fin_preventa: string; 
    precio_preventa: number;
    fecha_estreno?: string;
    activa?: boolean;
}

export const RESTRICCIONES_EDAD = ['ATP', '+13', '+18']; 
export const IDIOMAS = ['Castellano', 'Subtitulada'];
export const FORMATOS = ['2D', '3D', '4D', '5D'];

export const GENEROS = ['Acción', 'Comedia', 'Drama', 'Terror', 'Ciencia Ficción', 'Animación', 'Suspenso', 'Romance'];