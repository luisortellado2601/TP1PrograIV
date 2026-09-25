export interface Sala {
    id: string;
    nombre: string;
}

export interface PeliculaResumen {
    id: string;
    nombre: string;
    duracion_minutos: number;
    formatos_disponibles: string[] | null;
    idiomas_disponibles: string[] | null;
}

export interface FuncionAdmin {
    id: string;
    fecha_hora_inicio: string;
    fecha_hora_fin: string;
    formato: string | null;
    idioma: string | null;
    peliculas: { nombre: string } | null;
    salas: { nombre: string } | null;
}

export interface ResultadoCreacion {
    fecha: string;
    ok: boolean;
    mensaje?: string;
}

export const DIAS_SEMANA = [
    { valor: 1, nombre: 'Lun' },
    { valor: 2, nombre: 'Mar' },
    { valor: 3, nombre: 'Mié' },
    { valor: 4, nombre: 'Jue' },
    { valor: 5, nombre: 'Vie' },
    { valor: 6, nombre: 'Sáb' },
    { valor: 0, nombre: 'Dom' },
];

// Fecha local -> 'YYYY-MM-DDTHH:mm:00' (sin zona horaria, como la columna timestamp de Supabase)
export function aTextoLocal(fecha: Date): string {
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
        `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}
