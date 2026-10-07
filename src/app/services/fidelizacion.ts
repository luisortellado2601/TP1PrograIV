import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Canje, ResultadoCanje } from '../models/canje';

@Service()
export class FidelizacionService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    misCanjes(usuarioId: string): Observable<Canje[]> {
        return from(this.supabase
            .from('canjes_puntos')
            .select('id, tipo, producto_nombre, puntos_usados, valor, consumido, creada_en')
            .eq('usuario_id', usuarioId)
            .order('creada_en', { ascending: false })
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as Canje[];
            })
        );
    }

    // Para mostrar el checkbox "usar mi entrada gratis canjeada" en /compra
    tengoVoucherEntrada(usuarioId: string): Observable<boolean> {
        return from(this.supabase
            .from('canjes_puntos')
            .select('id')
            .eq('usuario_id', usuarioId)
            .eq('tipo', 'entrada')
            .eq('consumido', false)
            .limit(1)
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []).length > 0;
            })
        );
    }

    // La base valida los puntos disponibles y calcula el crédito a otorgar; el cliente solo dice qué eligió.
    canjear(tipo: 'entrada' | 'candy', productoId: string | null = null): Observable<ResultadoCanje> {
        return from(this.supabase.rpc('canjear_puntos', {
            p_tipo: tipo,
            p_producto_id: productoId,
        })).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data as ResultadoCanje[])[0];
            })
        );
    }
}
