import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar que quien llama es empleado o gerente: nadie más puede disparar notificaciones masivas
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) {
      return new Response("No autorizado", { status: 401, headers: corsHeaders });
    }

    const { data: perfil } = await supabaseAdmin
      .from("perfiles")
      .select("rol")
      .eq("id", userData.user.id)
      .single();

    if (!perfil || !["empleado", "gerente"].includes(perfil.rol)) {
      return new Response("No autorizado", { status: 403, headers: corsHeaders });
    }

    const { peliculaId } = await req.json();
    console.log("notificar-estreno: peliculaId =", peliculaId);

    const { data: pelicula } = await supabaseAdmin
      .from("peliculas")
      .select("nombre")
      .eq("id", peliculaId)
      .single();

    if (!pelicula) {
      return new Response("Película no encontrada", { status: 404, headers: corsHeaders });
    }

    // Usuarios que activaron la alerta de esta película
    const { data: alertas } = await supabaseAdmin
      .from("alertas_estreno")
      .select("usuario_id")
      .eq("pelicula_id", peliculaId);

    const usuarioIds = (alertas ?? []).map((a) => a.usuario_id);
    console.log("notificar-estreno: usuarios con alerta =", usuarioIds.length);

    if (usuarioIds.length === 0) {
      return new Response(JSON.stringify({ enviados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("usuario_id", usuarioIds);

    console.log("notificar-estreno: suscripciones push =", subs?.length ?? 0);

    webpush.setVapidDetails(
      "mailto:luisortellado26@hotmail.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    const payload = JSON.stringify({
      notification: {
        title: "¡Ya se estrenó!",
        body: `${pelicula.nombre} ya está disponible. ¡Comprá tus entradas!`,
        icon: "/icons/icon-192x192.png",
        data: {
          onActionClick: {
            default: { operation: "navigateLastFocusedOrOpen", url: "/pelicula-detalle/" + peliculaId },
          },
        },
      },
    });

    let enviados = 0;
    const vencidas: string[] = [];

    for (const sub of subs ?? []) {
      try {
        console.log("notificar-estreno: enviando a", sub.id);
        await conTimeout(
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          ),
          10000
        );
        enviados++;
        console.log("notificar-estreno: OK", sub.id);
      } catch (err: any) {
        console.error("notificar-estreno: fallo en", sub.id, err?.message ?? err);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          vencidas.push(sub.id);
        }
      }
    }

    if (vencidas.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", vencidas);
    }

    return new Response(JSON.stringify({ enviados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notificar-estreno: error general", err?.message ?? err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
