import { Service } from '@angular/core';
import { environment } from '../../environments/environment';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Service()
export class Auth { 
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    signIn(email: string, password: string) {
        return this.supabase.auth.signInWithPassword({ email, password });
    }

    async signUp(
        email: string,
        password: string,
        nombre: string,
        apellido: string,
        fecha_nacimiento: string,
        tipo_sangre: string,
        color_ojos: string,
        dias_vacaciones: number
    ) {
        const response = await this.supabase.auth.signUp({ email, password });

        if (response.error) return response;
        if (response.data.user) {
            const { error: dbError } = await this.supabase.from('perfiles').insert([
                {
                    id: response.data.user.id, 
                    email: email,
                    nombre: nombre,
                    apellido: apellido,
                    fecha_nacimiento: fecha_nacimiento,
                    tipo_sangre: tipo_sangre,
                    color_ojos: color_ojos,
                    dias_vacaciones_por_ano: dias_vacaciones,
                    rol: 'cliente' // Por defecto asignamos el rol
                }
            ]);
            
            if (dbError) {
                return { data: null, error: dbError }; 
            }
        }
        return response;
    }

    signOut() {
        return this.supabase.auth.signOut();
    }

    getUser() {
        return this.supabase.auth.getUser();
    }

    getUsers() {
        return this.supabase.auth.admin.listUsers();
    }
}
