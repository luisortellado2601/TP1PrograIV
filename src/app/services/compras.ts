import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CompraResumen, ResultadoCompra } from '../models/compra';
import { PeliculaVista } from '../models/canje';

const SELECT_MIS_COMPRAS = `
    id, codigo_qr, total, puntos_ganados, estado, estado_entrada, estado_candy, creada_en,
    entradas_tickets(fila, columna, es_vip, es_accesible,
        funciones(fecha_hora_inicio, formato, idioma, peliculas(nombre), salas(nombre))),
    compra_items(cantidad, precio_unitario, productos_candy(nombre))
`;

// Solo lo necesario para "Mis películas": qué función vio y de qué película (con póster)
const SELECT_MIS_PELICULAS = `
    entradas_tickets(funciones(fecha_hora_inicio, peliculas(id, nombre, imagen)))
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
        usarVoucher: boolean = false,
    ): Observable<ResultadoCompra> {
        return from(this.supabase.rpc('comprar', {
            p_funcion_id: funcionId,
            p_sesion_id: sesionId,
            p_cupon_codigo: cuponCodigo,
            p_candy: candy,
            p_usar_credito: usarCredito,
            p_usar_voucher: usarVoucher,
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

    // Una fila por película con entrada pagada (sin duplicar si vio la misma película más de una vez,
    // se queda con la función más reciente). Se usa en "Mis películas".
    misPeliculas(usuarioId: string): Observable<PeliculaVista[]> {
        return from(this.supabase
            .from('compras')
            .select(SELECT_MIS_PELICULAS)
            .eq('usuario_id', usuarioId)
            .eq('estado', 'pagada')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);

                const porPelicula = new Map<string, PeliculaVista>();
                for (const compra of (data ?? []) as any[]) {
                    for (const entrada of compra.entradas_tickets ?? []) {
                        const pelicula = entrada.funciones?.peliculas;
                        const fecha = entrada.funciones?.fecha_hora_inicio;
                        if (!pelicula || !fecha) continue;

                        const actual = porPelicula.get(pelicula.id);
                        if (!actual || fecha > actual.fecha_hora_inicio) {
                            porPelicula.set(pelicula.id, {
                                pelicula_id: pelicula.id,
                                nombre: pelicula.nombre,
                                imagen: pelicula.imagen,
                                fecha_hora_inicio: fecha,
                            });
                        }
                    }
                }
                return Array.from(porPelicula.values()).sort((a, b) =>
                    b.fecha_hora_inicio.localeCompare(a.fecha_hora_inicio));
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
