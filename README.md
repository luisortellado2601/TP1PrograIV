# Sistema de Cine · TP1 Programación IV

Aplicación web (PWA) para un establecimiento de cine: cartelera, programación de funciones con asignación automática de salas, candy bar, compra de entradas con mapa de butacas en tiempo real, PDF con QR, validación y cancelación, notificaciones push de estreno, fidelización (canje de puntos y "Mis películas") y, próximamente, reportes para el administrador.

- **URL desplegada:** https://tp1programacion-3f7a9.web.app
- **Repositorio:** https://github.com/luisortellado2601/TP1PrograIV
- **Estado del proyecto:** en desarrollo por sprints. Ver el detalle requisito por requisito en [docs/REQUERIMIENTOS.md](docs/REQUERIMIENTOS.md).

## Documentación

Este README es solo la portada. El resto de la documentación está dividida por tema:

- **[docs/REQUERIMIENTOS.md](docs/REQUERIMIENTOS.md)** — qué pidió el cliente, agrupado por sprint, con el estado real de cada punto (✅/🔧/⏳) y las decisiones que todavía quedan por definir con él.
- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)** — documentación técnica: stack, estructura del código, rutas, modelo de datos, reglas de negocio garantizadas en la base, seguridad y decisiones de diseño.
- **[docs/FUNCIONALIDAD.md](docs/FUNCIONALIDAD.md)** — explicación de todo lo que hace la app en lenguaje simple, sin términos técnicos (para alguien que solo la va a usar, no a programarla).

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Gerente (administra todo) | _completar_ | _completar_ |
| Empleado (panel de administración) | _completar_ | _completar_ |
| Cliente | _completar_ | _completar_ |

## Cómo ejecutarlo

```bash
npm install
ng serve          # desarrollo en http://localhost:4200
ng build          # build de producción en dist/TP1PrograIV
ng test           # pruebas unitarias
```

**Configuración de Supabase:** la URL y la clave pública (`publishable key`) están en `src/environments/environment.ts`. Es una clave pensada para el navegador: la seguridad de los datos la garantizan las políticas RLS de la base. Nunca debe versionarse una clave `service_role`.

> El service worker (y por lo tanto las notificaciones push) está desactivado a propósito en `ng serve` (`enabled: !isDevMode()` en `app.config.ts`). Para probarlas localmente hay que servir un build de producción, o probar directo en la URL desplegada.

**Despliegue:**

```bash
ng build
firebase deploy --only hosting
```
