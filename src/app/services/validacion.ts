import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CompraValidacion } from '../models/compra';

// Mismos datos que necesita la pantalla de confirmación de compra, pero buscados por código en vez de recién generados
const SELECT_COMPRA_VALIDACION = `
    id, codigo_qr, total, puntos_ganados, estado, estado_entrada, estado_candy, creada_en,
    perfiles(nombre, apellido),
    entradas_tickets(fila, columna, es_vip, es_accesible,
        funciones(fecha_hora_inicio, formato, idioma, peliculas(nombre), salas(nombre))),
    compra_items(cantidad, precio_unitario, productos_candy(nombre))
`;

@Service()
export class ValidacionService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    // La política RLS "ver propias o admin" ya deja leer cualquier compra a empleados y gerentes
    buscarPorCodigo(codigo: string): Observable<CompraValidacion> {
        return from(this.supabase
            .from('compras')
            .select(SELECT_COMPRA_VALIDACION)
            .ilike('codigo_qr', codigo.trim())
            .single()
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error('No encontramos ninguna compra con ese código.');
                return data as unknown as CompraValidacion;
            })
        );
    }

    // El .eq('estado_entrada', 'pendiente') evita validar dos veces aunque dos empleados lo intenten a la vez:
    // si ya estaba validada, la condición no matchea ninguna fila y data queda vacío.
    validarEntrada(compraId: string): Observable<void> {
        return from(this.supabase
            .from('compras')
            .update({ estado_entrada: 'validada' })
            .eq('id', compraId)
            .eq('estado_entrada', 'pendiente')
            .select('id')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                if (!data?.length) throw new Error('La entrada ya había sido validada (o la compra está cancelada).');
            })
        );
    }

    validarCandy(compraId: string): Observable<void> {
        return from(this.supabase
            .from('compras')
            .update({ estado_candy: 'entregado' })
            .eq('id', compraId)
            .eq('estado_candy', 'pendiente')
            .select('id')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                if (!data?.length) throw new Error('El candy ya había sido entregado (o la compra está cancelada).');
            })
        );
    }
}
