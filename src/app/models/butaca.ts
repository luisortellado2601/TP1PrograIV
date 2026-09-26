export type TipoButaca = 'normal' | 'vip' | 'accesible';

export interface Butaca {
    fila: string;
    numero: number;
    tipo: TipoButaca;
}

// Una fila de la sala: tres bloques (4, 20 y 4 butacas). null = hueco (no hay butaca en esa posición)
export interface FilaSala {
    letra: string;
    bloques: (Butaca | null)[][];
}

export interface FuncionMapa {
    id: string;
    fecha_hora_inicio: string;
    formato: string | null;
    idioma: string | null;
    peliculas: { id: string; nombre: string; restriccion_edad: string | null } | null;
    salas: { nombre: string } | null;
}

export interface ButacaOcupada {
    fila: string;
    columna: number;
}

export interface ReservaButaca {
    fila: string;
    columna: number;
    sesion_id: string;
}

export const MAX_BUTACAS = 6;

const LETRAS_FILAS = 'ABCDEFGHIJKLMNOPQRST'.split('');
const FILAS_VIP = ['R', 'S', 'T'];
const ACCESIBLES_J = [2, 3, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 28, 29];

export function claveButaca(fila: string, numero: number): string {
    return `${fila}-${numero}`;
}

function crearButaca(fila: string, numero: number): Butaca | null {
    if (fila === 'K') return null;                                   // pasillo
    if (fila === 'J') {                                              // fila accesible: 2, 10 y 2 butacas
        return ACCESIBLES_J.includes(numero) ? { fila, numero, tipo: 'accesible' } : null;
    }
    return { fila, numero, tipo: FILAS_VIP.includes(fila) ? 'vip' : 'normal' };
}

function crearBloque(fila: string, desde: number, hasta: number): (Butaca | null)[] {
    const bloque: (Butaca | null)[] = [];
    for (let numero = desde; numero <= hasta; numero++) {
        bloque.push(crearButaca(fila, numero));
    }
    return bloque;
}

// Filas A a T. Los números 5 y 26 no existen (son los pasillos entre bloques)
export function construirSala(): FilaSala[] {
    return LETRAS_FILAS.map(letra => ({
        letra,
        bloques: [
            crearBloque(letra, 1, 4),
            crearBloque(letra, 6, 25),
            crearBloque(letra, 27, 30),
        ],
    }));
}
