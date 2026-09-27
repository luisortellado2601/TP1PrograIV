import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ResultadoCompra } from '../models/compra';

@Service()
export class ComprasService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    // La base recalcula todo (precios, recargo VIP, cupón y edad): el cliente solo informa qué eligió.
    // funcionId y sesionId van null cuando es una compra de candy sola, sin butacas.
    comprar(
        funcionId: string | null,
        sesionId: string | null,
        cuponCodigo: string | null,
        candy: { producto_id: string; cantidad: number }[],
    ): Observable<ResultadoCompra> {
        return from(this.supabase.rpc('comprar', {
            p_funcion_id: funcionId,
            p_sesion_id: sesionId,
            p_cupon_codigo: cuponCodigo,
            p_candy: candy,
        })).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data as ResultadoCompra[])[0];
            })
        );
    }
}
