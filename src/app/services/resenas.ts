import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { NuevaResena, Resena } from '../models/resena';

@Service()
export class ResenasService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    getResenas(peliculaId: string): Observable<Resena[]> {
        return from(this.supabase
            .from('resenas')
            .select('id, usuario_id, pelicula_id, estrellas, comentario_corto, nombre_autor, creada_en')
            .eq('pelicula_id', peliculaId)
            .order('creada_en', { ascending: false })
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as Resena[];
            })
        );
    }

    guardarResena(resena: NuevaResena): Observable<void> {
        return from(this.supabase
            .from('resenas')
            .upsert(resena, { onConflict: 'usuario_id,pelicula_id' })
        ).pipe(
            map(({ error }) => {
                if (error) throw new Error(error.message);
            })
        );
    }
}
