import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LogActividad } from '../models/log';

const MAX_LOGS = 200;

@Service()
export class LogsService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    }

    // No hay FK entre logs_actividad y perfiles (usuario_empleado_id guarda auth.uid() a secas),
    // así que el nombre del empleado se resuelve en una segunda consulta, no se puede anidar en el select.
    getLogs(): Observable<LogActividad[]> {
        return from(this.supabase
            .from('logs_actividad')
            .select('id, usuario_empleado_id, accion, fecha_hora, entidad, detalle')
            .order('fecha_hora', { ascending: false })
            .limit(MAX_LOGS)
        ).pipe(
            switchMap(({ data, error }) => {
                if (error) throw new Error(error.message);
                const logs = (data ?? []) as LogActividad[];

                const ids = [...new Set(logs.map(l => l.usuario_empleado_id).filter((id): id is string => !!id))];
                if (!ids.length) return of(logs);

                return from(this.supabase.from('perfiles').select('id, nombre, apellido').in('id', ids)).pipe(
                    map(({ data: perfiles }) => {
                        const porId = new Map((perfiles ?? []).map(p => [p.id, p]));
                        return logs.map(l => ({
                            ...l,
                            empleado: l.usuario_empleado_id ? porId.get(l.usuario_empleado_id) ?? null : null,
                        }));
                    })
                );
            }),
            map(logs => this.anotarCambiosCompra(logs)),
        );
    }

    // El trigger guarda la foto final de la fila, no un diff. Para saber si una fila de 'compras'
    // fue "validar entrada", "entregar candy" o "cancelar", se compara contra la fila anterior
    // de la misma compra (recorriendo de la más vieja a la más nueva dentro de lo que se trajo).
    private anotarCambiosCompra(logs: LogActividad[]): LogActividad[] {
        const ultimoEstadoPorCompra = new Map<string, Record<string, unknown>>();

        const anotados = [...logs].reverse().map(log => {
            if (log.entidad !== 'compras' || !log.detalle) return log;

            const actual = log.detalle;
            const compraId = actual['id'] as string;
            const anterior = ultimoEstadoPorCompra.get(compraId);
            ultimoEstadoPorCompra.set(compraId, actual);

            let subtipoCompra: LogActividad['subtipoCompra'] = 'otro';
            if (actual['estado'] === 'cancelada' && anterior?.['estado'] !== 'cancelada') {
                subtipoCompra = 'cancelacion';
            } else if (actual['estado_candy'] === 'entregado' && anterior?.['estado_candy'] !== 'entregado') {
                subtipoCompra = 'candy';
            } else if (actual['estado_entrada'] === 'validada' && anterior?.['estado_entrada'] !== 'validada') {
                subtipoCompra = 'entrada';
            }

            return { ...log, subtipoCompra };
        });

        return anotados.reverse();
    }
}
