import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfigItem, Cupon, PrecioFormato } from '../models/configuracion';

@Service()
export class ConfiguracionService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    getConfiguracion(): Observable<ConfigItem[]> {
        return from(this.supabase.from('configuracion').select('clave, valor, descripcion')).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as ConfigItem[];
            })
        );
    }

    getPreciosFormato(): Observable<PrecioFormato[]> {
        return from(this.supabase.from('precios_formato').select('formato, precio').order('formato')).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as PrecioFormato[];
            })
        );
    }

    // Solo se envían las filas que cambiaron (así el log de actividad no se llena de ruido)
    guardarPrecios(precios: PrecioFormato[]): Observable<void> {
        return from(this.supabase.from('precios_formato').upsert(precios)).pipe(
            map(({ error }) => {
                if (error) throw new Error(error.message);
            })
        );
    }

    guardarConfiguracion(items: { clave: string; valor: number }[]): Observable<void> {
        return from(this.supabase.from('configuracion').upsert(items)).pipe(
            map(({ error }) => {
                if (error) throw new Error(error.message);
            })
        );
    }

    getCupones(): Observable<Cupon[]> {
        return from(this.supabase.from('cupones').select('*').order('codigo')).pipe(
            map(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as Cupon[];
            })
        );
    }

    crearCupon(cupon: Cupon): Observable<void> {
        return from(this.supabase.from('cupones').insert(cupon)).pipe(
            map(({ error }) => {
                if (error) {
                    // 23505 = ya existe un cupón con ese código
                    if (error.code === '23505') throw new Error('Ya existe un cupón con ese código.');
                    throw new Error(error.message);
                }
            })
        );
    }

    actualizarCupon(id: string, cambios: Partial<Cupon>): Observable<void> {
        return from(this.supabase.from('cupones').update(cambios).eq('id', id)).pipe(
            map(({ error }) => {
                if (error) {
                    if (error.code === '23505') throw new Error('Ya existe un cupón con ese código.');
                    throw new Error(error.message);
                }
            })
        );
    }

    eliminarCupon(id: string): Observable<void> {
        return from(this.supabase.from('cupones').delete().eq('id', id)).pipe(
            map(({ error }) => {
                if (error) {
                    // 23503 = el cupón ya se usó en alguna compra
                    if (error.code === '23503') {
                        throw new Error('No se puede eliminar: el cupón ya se usó en una compra. Desactivalo en su lugar.');
                    }
                    throw new Error(error.message);
                }
            })
        );
    }
}
