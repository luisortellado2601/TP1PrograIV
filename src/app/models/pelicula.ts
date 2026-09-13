export interface Pelicula {
    id?: string; // Suele ser opcional al crear una nueva
    nombre: string;
    sinopsis?: string;
    imagen?: string;
}