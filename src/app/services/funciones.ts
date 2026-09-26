import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FuncionAdmin, FuncionPublica, PeliculaResumen, aTextoLocal } from '../models/funcion';

@Service()
export class FuncionesService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    getPeliculas(): Observable<PeliculaResumen[]> {
        return from(this.supabase
            .from('peliculas')
            .select('id, nombre, duracion_minutos, formatos_disponibles, idiomas_disponibles')
            .order('nombre')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as PeliculaResumen[];
            })
        );
    }

    getFunciones(): Observable<FuncionAdmin[]> {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        return from(this.supabase
            .from('funciones')
            .select('id, fecha_hora_inicio, fecha_hora_fin, formato, idioma, peliculas(nombre), salas(nombre)')
            .gte('fecha_hora_inicio', aTextoLocal(hoy))
            .order('fecha_hora_inicio')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as unknown as FuncionAdmin[];
            })
        );
    }

    // Funciones futuras de una película, para que el cliente elija cuál ver
    getFuncionesDePelicula(peliculaId: string): Observable<FuncionPublica[]> {
        return from(this.supabase
            .from('funciones')
            .select('id, fecha_hora_inicio, formato, idioma')
            .eq('pelicula_id', peliculaId)
            .gte('fecha_hora_inicio', aTextoLocal(new Date()))
            .order('fecha_hora_inicio')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as FuncionPublica[];
            })
        );
    }

    crearFuncion(peliculaId: string, inicio: string, formato: string, idioma: string): Observable<string> {
        return from(this.supabase.rpc('crear_funcion', {
            p_pelicula_id: peliculaId,
            p_inicio: inicio,
            p_formato: formato,
            p_idioma: idioma,
        })).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return data as string;
            })
        );
    }

    eliminarFuncion(id: string): Observable<void> {
        return from(this.supabase.from('funciones').delete().eq('id', id)).pipe(
            map(({ error }) => {
                if (error) {
                    if (error.code === '23503') {
                        throw new Error('No se puede eliminar: la función ya tiene entradas vendidas.');
                    }
                    throw new Error(error.message);
                }
            })
        );
    }
}
