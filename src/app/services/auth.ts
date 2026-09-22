import { Service, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Service()
export class Auth { 
    private supabase: SupabaseClient;

    perfilActual = signal<any>(null);

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl, 
            environment.supabasePublishableKey,
        );
        this.recuperarSesion();
    }

    private async recuperarSesion(){
        const { data: { session }} = await this.supabase.auth.getSession();

        if (session?.user){
            const { data: perfil } = await this.supabase
                .from('perfiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
            if (perfil){
                this.perfilActual.set(perfil);
            }
        }
        this.supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT'){
                this.perfilActual.set(null);
            }
        });
    }

    async signIn(email: string, password: string) {
        const response = await this.supabase.auth.signInWithPassword({ email, password });
        if (response.error) return response;

        if (response.data.user) {
            const { data: perfil } = await this.supabase
                .from('perfiles')
                .select('*')
                .eq('id', response.data.user.id)
                .single();
            if (perfil) {
                this.perfilActual.set(perfil);
            }
        }
        return response;
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
                    rol: 'cliente' 
                }
            ]);
            
            if (dbError) {
                return { data: null, error: dbError }; 
            }
        }
        return response;
    }

    async signOut() {
        const response = await this.supabase.auth.signOut();
        this.perfilActual.set(null);
        return response;
    }

    getUser() {
        return this.supabase.auth.getUser();
    }

    getUsers() {
        return this.supabase.auth.admin.listUsers();
    }

    async getRolUsuario(userId: string) {
        const { data } = await this.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', userId)
        .single();
        
        return data?.rol; 
    }

    async cerrarSesion() {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            console.error('Error al cerrar sesión:', error.message);
        } else {
            this.perfilActual.set(null);
        }
    }
}
