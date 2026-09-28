import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Service()
export class AlertasService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    // Une usuario y película: si ya estaba activada, no rompe (23505 = ya existe)
    async activarAlerta(peliculaId: string, usuarioId: string) {
        const { error } = await this.supabase
            .from('alertas_estreno')
            .insert({ pelicula_id: peliculaId, usuario_id: usuarioId });

        if (error && error.code !== '23505') throw error;
    }

    // Alertas ya activadas por este usuario, para no ofrecer de nuevo el botón
    async getActivasDeUsuario(usuarioId: string): Promise<string[]> {
        const { data, error } = await this.supabase
            .from('alertas_estreno')
            .select('pelicula_id')
            .eq('usuario_id', usuarioId);

        if (error) throw error;
        return (data ?? []).map(a => a.pelicula_id as string);
    }
}
