import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ButacaOcupada, FuncionMapa, ReservaButaca } from '../models/butaca';

@Service()
export class ButacasService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    getFuncion(funcionId: string): Observable<FuncionMapa> {
        return from(this.supabase
            .from('funciones')
            .select('id, fecha_hora_inicio, formato, idioma, peliculas(id, nombre, restriccion_edad), salas(nombre)')
            .eq('id', funcionId)
            .single()
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return data as unknown as FuncionMapa;
            })
        );
    }

    // Butacas ya vendidas (las entradas canceladas vuelven a estar libres)
    getVendidas(funcionId: string): Observable<ButacaOcupada[]> {
        return from(this.supabase
            .from('entradas_tickets')
            .select('fila, columna')
            .eq('funcion_id', funcionId)
            .neq('estado', 'cancelada')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as ButacaOcupada[];
            })
        );
    }

    // Reservas vigentes (la base ya oculta las vencidas)
    getReservas(funcionId: string): Observable<ReservaButaca[]> {
        return from(this.supabase
            .from('reservas_butacas')
            .select('fila, columna, sesion_id')
            .eq('funcion_id', funcionId)
        ).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as ReservaButaca[];
            })
        );
    }

    // La base valida todo: butaca existente, no vendida, no reservada y máximo por compra
    reservarButaca(funcionId: string, fila: string, columna: number, sesionId: string): Observable<void> {
        return from(this.supabase.rpc('reservar_butaca', {
            p_funcion: funcionId,
            p_fila: fila,
            p_columna: columna,
            p_sesion: sesionId,
        })).pipe(
            map(({ error }) => {
                if (error) throw new Error(error.message);
            })
        );
    }

    liberarButaca(funcionId: string, fila: string, columna: number, sesionId: string): Observable<void> {
        return from(this.supabase
            .from('reservas_butacas')
            .delete()
            .eq('funcion_id', funcionId)
            .eq('fila', fila)
            .eq('columna', columna)
            .eq('sesion_id', sesionId)
        ).pipe(
            map(({ error }) => {
                if (error) throw new Error(error.message);
            })
        );
    }

    // Emite cada vez que cambian las reservas o las ventas de la función (Supabase Realtime).
    // Al desuscribirse se cierra el canal.
    cambios(funcionId: string): Observable<void> {
        return new Observable<void>(suscriptor => {
            const canal = this.supabase
                .channel('butacas-' + funcionId)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'reservas_butacas', filter: `funcion_id=eq.${funcionId}` },
                    () => suscriptor.next())
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'entradas_tickets', filter: `funcion_id=eq.${funcionId}` },
                    () => suscriptor.next())
                .subscribe();

            return () => {
                this.supabase.removeChannel(canal);
            };
        });
    }
}
