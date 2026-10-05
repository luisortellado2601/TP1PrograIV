import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CompraResumen, ResultadoCompra } from '../models/compra';

const SELECT_MIS_COMPRAS = `
    id, codigo_qr, total, puntos_ganados, estado, estado_entrada, estado_candy, creada_en,
    entradas_tickets(fila, columna, es_vip, es_accesible,
        funciones(fecha_hora_inicio, formato, idioma, peliculas(nombre), salas(nombre))),
    compra_items(cantidad, precio_unitario, productos_candy(nombre))
`;

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
        usarCredito: boolean = false,
    ): Observable<ResultadoCompra> {
        return from(this.supabase.rpc('comprar', {
            p_funcion_id: funcionId,
            p_sesion_id: sesionId,
            p_cupon_codigo: cuponCodigo,
            p_candy: candy,
            p_usar_credito: usarCredito,
        })).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data as ResultadoCompra[])[0];
            })
        );
    }

    // Se filtra explícito por usuario: un empleado/gerente logueado no debe ver compras ajenas acá
    // (la política RLS deja leer todo a un admin, pero esta pantalla es "mis compras", no el panel de validación)
    misCompras(usuarioId: string): Observable<CompraResumen[]> {
        return from(this.supabase
            .from('compras')
            .select(SELECT_MIS_COMPRAS)
            .eq('usuario_id', usuarioId)
            .order('creada_en', { ascending: false })
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as unknown as CompraResumen[];
            })
        );
    }

    // Devuelve el monto acreditado como crédito; la base valida dueño, estado y horario límite
    cancelar(compraId: string): Observable<number> {
        return from(this.supabase.rpc('cancelar_compra', { p_compra_id: compraId })).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data as { credito_otorgado: number }[])[0]?.credito_otorgado ?? 0;
            })
        );
    }
}
