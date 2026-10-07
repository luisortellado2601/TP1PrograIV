import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Pelicula } from '../models/pelicula';

@Service()
export class PeliculasService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    getPeliculas() {
        return this.supabase.from('peliculas').select('*');
    }

    // Un id por cada entrada vendida (no cancelada), para armar el ranking en el cliente.
    // No hay agregación en el servidor (evita crear una vista/función SQL nueva).
    async getVentasPorPelicula(): Promise<string[]> {
        const { data, error } = await this.supabase
            .from('entradas_tickets')
            .select('funciones(pelicula_id)')
            .neq('estado', 'cancelada');

        if (error) throw error;
        return (data ?? [])
            .map((fila: any) => fila.funciones?.pelicula_id as string | undefined)
            .filter((id): id is string => !!id);
    }

    async addPelicula(pelicula: Partial<Pelicula>) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .insert(pelicula)
            .select();

        if (error) {
            console.error('Error de Supabase al insertar:', error);
            throw error; 
        }
        return data;
    }

    async updatePelicula(pelicula: any) {
            const { data, error } = await this.supabase
                .from('peliculas')
                .update(pelicula)
                .eq('id', pelicula.id)
                .select();
            if (error) {
                console.error('Error de Supabase al actualizar:', error);
                throw error;
            }
            return data;
        }

    async deletePelicula(id: string) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('Error al eliminar la película:', error.message);
            throw error; 
        }
        return data;
    }

    async notificarEstreno(peliculaId: string): Promise<{ enviados: number }> {
        const { data, error } = await this.supabase.functions.invoke('notificar-estreno', {
            body: { peliculaId },
        });

        if (error) {
            console.error('Error al notificar el estreno:', error.message);
            throw error;
        }
        return data as { enviados: number };
    }

    async getPeliculaById(id: string) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*')
            .eq('id', id)
            .single();

        return { data, error };
        }
}