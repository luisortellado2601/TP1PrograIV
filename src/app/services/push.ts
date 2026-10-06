import { Service, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Service()
export class PushService {
    private supabase: SupabaseClient;
    private swPush = inject(SwPush);

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    // Pide permiso al navegador y guarda la suscripción; no hace nada si el SW está deshabilitado (dev) o no hay soporte
    async suscribir(usuarioId: string) {
        if (!this.swPush.isEnabled) return;

        const sub = await this.swPush.requestSubscription({
            serverPublicKey: environment.vapidPublicKey,
        });
        const keys = (sub.toJSON() as any).keys;

        const { error } = await this.supabase.from('push_subscriptions').upsert({
            usuario_id: usuarioId,
            endpoint: sub.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
        }, { onConflict: 'usuario_id,endpoint' });

        if (error) throw error;
    }
}
