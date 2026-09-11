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

    addPelicula(pelicula: Pelicula) {
        return this.supabase.from('peliculas').insert(pelicula);
    }

    updatePelicula(pelicula: Pelicula) {
        return this.supabase.from('peliculas').update(pelicula).eq('id', pelicula.id);
    }
}
