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

    async addPelicula(pelicula: Partial<Pelicula>) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .insert(pelicula)
            .select();

        if (error) {
            console.error('🛑 Error de Supabase al insertar:', error);
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
                console.error('🛑 Error de Supabase al actualizar:', error);
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

    async getPeliculaById(id: string) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*')
            .eq('id', id)
            .single();

        return { data, error };
        }
}