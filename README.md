# Sistema de Cine · TP1 Programación IV

Aplicación web (PWA) para un establecimiento de cine: cartelera, programación de funciones con asignación automática de salas, candy bar, compra de entradas con mapa de butacas en tiempo real, PDF con QR, validación y cancelación, notificaciones push de estreno, fidelización (canje de puntos y "Mis películas") y, próximamente, reportes para el administrador.

- **URL desplegada:** https://tp1programacion-3f7a9.web.app
- **Repositorio:** https://github.com/luisortellado2601/TP1PrograIV
- **Estado del proyecto:** en desarrollo por sprints. Ver [Estado de avance](#estado-de-avance).

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Gerente (administra todo) | _completar_ | _completar_ |
| Empleado (panel de administración) | _completar_ | _completar_ |
| Cliente | _completar_ | _completar_ |

## Tecnologías

| Área | Tecnología |
|---|---|
| Framework | Angular 22 (componentes standalone, signals, control flow `@if` / `@for`) |
| Backend como servicio | Supabase: Auth, PostgreSQL, Row Level Security y Realtime |
| PWA | `@angular/service-worker` + `manifest.webmanifest` |
| Hosting | Firebase Hosting (build estático) |
| Pruebas | Vitest (`ng test`) |

## Cómo ejecutarlo

```bash
npm install
ng serve          # desarrollo en http://localhost:4200
ng build          # build de producción en dist/TP1PrograIV
ng test           # pruebas unitarias
```

**Configuración de Supabase:** la URL y la clave pública (`publishable key`) están en `src/environments/environment.ts`. Es una clave pensada para el navegador: la seguridad de los datos la garantizan las políticas RLS de la base. Nunca debe versionarse una clave `service_role`.

**Despliegue:**

```bash
ng build
firebase deploy --only hosting
```

## Arquitectura

```mermaid
flowchart LR
    U[Navegador / PWA instalada] -->|HTTPS| H[Firebase Hosting<br/>build estático de Angular]
    U -->|supabase-js| A[Supabase Auth]
    U -->|supabase-js + RLS| D[(PostgreSQL)]
    U -->|WebSocket| R[Supabase Realtime<br/>butacas en vivo]
    D --- F[Funciones SQL y triggers<br/>crear_funcion, log_cambio]
```

La aplicación es una SPA sin servidor propio. La lógica que debe ser inviolable (que dos funciones no se solapen, que una butaca no se venda dos veces, quién puede leer o escribir cada dato) **vive en la base de datos**, no en Angular. Así, aunque alguien saltee la interfaz, las reglas se siguen cumpliendo.

### Estructura del código

```
src/app/
├── componentes/
│   ├── cartelera/          Portada con buscador y filtro por género
│   ├── pelicula-detalle/   Ficha de la película
│   ├── login/ register/    Acceso y alta de usuarios
│   ├── navbar/             Navegación según el rol
│   ├── candy-cliente/      Candy bar con carrito, cupón y pago simulado (candy solo, sin butacas)
│   ├── admin/              Panel principal de administración
│   ├── peliculas/          ABM de películas y preventa
│   ├── admin-candy/        ABM de productos del candy
│   ├── admin-funciones/    Programación de funciones (asignación automática)
│   ├── admin-configuracion/  Precios, recargo VIP, puntos y cupones
│   ├── selector-horario/   Selector de hora reutilizable (@Input / @Output)
│   ├── ventana-confirmacion/  Ventana de confirmación centrada (@Input / @Output)
│   ├── mapa-butacas/       Mapa de butacas en tiempo real con reserva temporal
│   ├── compra/             Compra de entradas + candy: cupón, bloqueo por edad, pago simulado y PDF con QR
│   ├── mis-compras/        Historial de compras del usuario, con cancelación hasta 2 horas antes
│   ├── admin-validacion/   Panel de empleados: escaneo de QR por cámara o código manual, entrada y candy por separado
│   └── fidelizacion/       Perfil: puntos, crédito, canje de recompensas, historial de canjes y "Mis películas"
├── services/               auth, peliculas, candy, funciones, configuracion, resenas, butacas, compras, alertas, push, validacion, fidelizacion (acceso a Supabase)
├── models/                 pelicula.ts, funcion.ts, configuracion.ts, resena.ts, butaca.ts, compra.ts, canje.ts
├── guards/                 auth-guard, admin-guard
├── directives/             edad-color, destacado-color
└── pipes/                  formato-duracion, formato-puntos
```

### Rutas

| Ruta | Acceso | Carga |
|---|---|---|
| `/cartelera` | Público | Lazy |
| `/pelicula-detalle/:id` | Público | Lazy |
| `/login`, `/register` | Público | Lazy |
| `/butacas/:funcionId` | Público (también compradores anónimos) | Lazy |
| `/compra/:funcionId` | Público (también compradores anónimos) | Lazy |
| `/candy-cliente` | Público (candy solo, sin butacas; también anónimos) | Lazy |
| `/mis-compras`, `/fidelizacion` | Solo usuarios registrados (`authGuard`) | Lazy |
| `/admin` | Empleado o gerente (`adminGuard`) | Lazy |
| `/peliculas`, `/admin-candy`, `/admin-funciones`, `/admin-configuracion`, `/admin-validacion` | Empleado o gerente (`adminGuard`) | Lazy |

## Modelo de datos

```mermaid
erDiagram
    PERFILES ||--o{ COMPRAS : realiza
    PERFILES ||--o{ RESENAS : escribe
    PELICULAS ||--o{ RESENAS : recibe
    PELICULAS ||--o{ FUNCIONES : tiene
    SALAS ||--o{ FUNCIONES : aloja
    FUNCIONES ||--o{ ENTRADAS_TICKETS : vende
    COMPRAS ||--o{ ENTRADAS_TICKETS : incluye
    COMPRAS ||--o{ COMPRA_ITEMS : incluye
    PRODUCTOS_CANDY ||--o{ COMPRA_ITEMS : se_vende_en
    COMBOS ||--o{ COMBOS_ITEMS : contiene
    CUPONES ||--o{ COMPRAS : descuenta
```

| Grupo | Tablas |
|---|---|
| Usuarios | `perfiles` (rol, datos personales, puntos, crédito) |
| Cartelera | `peliculas`, `salas`, `funciones` |
| Venta | `compras`, `entradas_tickets`, `compra_items`, `reservas_butacas` |
| Candy | `productos_candy`, `combos`, `combos_items` |
| Promociones y fidelización | `cupones`, `canjes_puntos`, `movimientos_credito`, `alertas_estreno` |
| Configuración | `configuracion`, `precios_formato` |
| Contenido y auditoría | `resenas`, `logs_actividad` |

## Reglas de negocio garantizadas en la base

| Regla | Cómo se garantiza |
|---|---|
| Nunca dos funciones a la vez en la misma sala, con **30 minutos** de margen entre una y otra | Constraint de exclusión `funciones_sin_solape` (índice GiST sobre sala y rango de tiempo) |
| Asignación automática de sala | Función SQL `crear_funcion`: calcula el fin según la duración de la película y usa la primera sala libre; si ninguna sirve, devuelve un error claro |
| Una butaca no se vende dos veces | Índice único parcial sobre `(funcion_id, fila, columna)` para entradas no canceladas |
| Reserva temporal (5 min) y máximo de 6 butacas por compra | Función SQL `reservar_butaca` (con clave primaria por función, fila y columna: dos personas no pueden reservar la misma butaca) |
| Precio, recargo VIP, cupón, edad y puntos siempre calculados por el servidor | Función SQL `comprar`: recibe solo lo elegido (butacas reservadas, candy y código de cupón) y devuelve el total y el QR ya validados |
| Cancelación solo hasta 2 horas antes, sin devolución de dinero | Función SQL `cancelar_compra`: valida dueño y horario límite, libera la butaca, invalida el QR y otorga el crédito |
| Canje de puntos siempre validado y descontado por el servidor | Función SQL `canjear_puntos`: valida que el usuario tenga los puntos suficientes y los descuenta. Si es candy, genera directamente una compra real a $0 con su QR; si es una entrada, guarda un voucher pendiente (no toca `credito_extra`, que es solo de cancelaciones) |
| El voucher de entrada gratis se usa una sola vez | `comprar` (parámetro `p_usar_voucher`) busca con `for update` un voucher propio sin consumir, descuenta su valor antes de calcular los puntos de esa compra (para no generar puntos sobre algo pagado con puntos) y lo marca consumido al confirmarse |
| Solo existen butacas válidas | Constraint `butaca_valida` (ver distribución abajo) |
| Cada usuario solo ve lo suyo | Políticas RLS por tabla |
| Registro de actividad | Trigger `log_cambio` sobre funciones, precios, configuración, productos y combos |

### Distribución de la sala

Todas las salas son iguales: filas **A a T**, con tres columnas de **4, 20 y 4** butacas. Los asientos se numeran del 1 al 30 dejando dos pasillos (los números 5 y 26 no existen).

- **Fila J:** butacas accesibles (2, 10 y 2 por columna). La fila **K** queda vacía y funciona como pasillo.
- **Filas R, S y T:** butacas VIP, con precio mayor y diferenciadas en el mapa.
- Cada sala tiene 518 butacas: 504 normales o VIP y 14 accesibles.

La grilla se genera por código, ya que es idéntica en todas las salas.

## Seguridad

- **Roles:** `cliente`, `empleado` y `gerente`. Un empleado o gerente accede al panel de administración; solo el gerente puede editar perfiles y roles.
- **RLS activo en todas las tablas.** El catálogo (películas, salas, funciones, productos, combos, precios) es de lectura pública y solo lo modifica un administrador. Compras, puntos y crédito solo los ve su dueño o un administrador.
- **Las compras no se insertan directo desde el cliente.** Se hacen mediante la función SQL `comprar`, que valida precios, recargo VIP, cupón y edad, de modo que nadie pueda fijar su propio precio. Esto permite además la compra **anónima** sin abrir escritura pública.

## Temas de la materia aplicados

| Tema | Dónde |
|---|---|
| Lazy loading | Todas las rutas usan `loadComponent` (`app.routes.ts`) |
| Directivas | `EdadColorDirective` (color según clasificación) y `DestacadoColorDirective` (resalta combos) |
| Pipes | `FormatoDuracionPipe` (minutos a horas) y `FormatoPuntosPipe` |
| ReactiveFormsModule | Formulario de programación de funciones (`admin-funciones`), con validadores propios de fecha y de rango |
| Observables | `FuncionesService` devuelve Observables (`from` y `map`); el componente los consume con `subscribe` (`next`, `error` y `complete`) |
| Input y Output | `selector-horario` y `ventana-confirmacion` reciben datos con `@Input` y avisan a la pantalla con `@Output` |

Además se usan **signals** (`signal`, `computed`), **Signal Forms** en login, registro, películas y candy, guards de ruta y PWA.

## Decisiones técnicas

1. **Lógica crítica en SQL y no en Angular.** Es la única forma de garantizar que las reglas se cumplan siempre, aun con datos cargados por fuera de la app.
2. **Un QR por compra.** El mismo código sirve para ingresar a la función y para retirar el candy. La compra guarda estados separados (`estado_entrada` y `estado_candy`), de modo que validar la entrada no consume el retiro de comida, y cada uno deja de funcionar una vez usado.
3. **Formato e idioma por función.** Una misma película puede proyectarse en 2D castellano y en 3D subtitulada, por eso esos datos pertenecen a la función y no a la película.
4. **Funciones recurrentes como filas independientes.** El admin elige días, horario y período; el sistema crea una función por cada fecha, cada una con su sala asignada. Si en una fecha no hay sala libre, esa se informa y las demás se crean igual.
5. **Selector de horario y fechas propios.** El cliente pidió evitar calendarios desplegables y scroll: la hora se elige con botones y la fecha se escribe con máscara `DD/MM/AAAA`.
6. **Grilla de butacas por código.** Como todas las salas son iguales, no se guarda cada butaca en la base; lo que se persiste son las entradas vendidas y las reservas temporales.
7. **Reserva temporal de butacas.** Mientras un usuario elige, las butacas quedan reservadas unos minutos y el resto las ve ocupadas en tiempo real (Supabase Realtime).
8. **Compra anónima.** `usuario_id` es opcional en compras y entradas. Los anónimos ven solo el aviso de restricción de edad; no se les pide identificación.
9. **Dos enfoques de formularios.** Los formularios existentes usan Signal Forms; el nuevo panel de funciones usa ReactiveFormsModule por ser el tema visto en clase.

## Estado de avance

Referencias: ✅ terminado · 🔧 parcial · ⏳ pendiente.

| Requisito | Estado | Detalle |
|---|---|---|
| Registro, login y logout | ✅ | Con mail, nombre, apellido, nacimiento, sangre, ojos y vacaciones |
| Roles, guards y RLS | ✅ | Cliente, empleado y gerente |
| ABM de películas | ✅ | Con géneros múltiples, clasificación y preventa |
| ABM del candy (productos y categorías) | ✅ | |
| Combos | 🔧 | Hoy es una categoría más del candy (con marca de "destacado"); falta el combo real de entrada + pochoclos + bebida a precio fijo |
| Funciones y asignación automática de salas | ✅ | Con recurrencia y validación en la base |
| Cartelera con buscador y filtro por género | ✅ | |
| Las 3 películas más vendidas primero | ✅ | Ranking real por ventas desde `entradas_tickets` |
| Detalle de película con funciones y reseñas | ✅ | Funciones por día y horario; reseñas con estrellas, comentario y promedio (una por usuario registrado) |
| "Próximamente" y alertas de estreno | 🔧 | La vista y el botón guardan la preferencia en `alertas_estreno` y suscriben al push (`PushService`); el aviso real ya se envía (edge function `notificar-estreno` con Web Push + VAPID), pero el disparo es manual: lo dispara un admin desde el panel de películas, no se envía solo en la fecha de estreno |
| Mapa de butacas en tiempo real | ✅ | Filas A a T, J accesible, VIP en R, S y T, reserva temporal y máximo de 6 |
| Confirmación de la compra (pago simulado) | ✅ | Formulario de tarjeta simulado (titular, número, vencimiento no vencido, CVV) con ventana de confirmación antes de pagar; la función SQL `comprar` recalcula precio, recargo VIP, cupón y puntos |
| PDF con QR, validación por empleados y carga manual del código | ✅ | La confirmación de compra genera un PDF descargable (`jspdf` + `qrcode`) con los datos de la función, butacas, candy y el QR; el panel `/admin-validacion` lo valida por cámara (`html5-qrcode`) o código manual, con estados de entrada y candy independientes |
| Precios por formato, recargo VIP, puntos y cancelación | ✅ | Configurables desde el panel de administración |
| Cupón de bienvenida (20 %) y cupón para mayores de 50 | ✅ | Se aplican automáticamente según elegibilidad (o a mano con código) en la compra de entradas y en el candy solo; la base los recalcula y consume |
| Restricción de edad | ✅ | Bloquea el pago si el usuario logueado no cumple la edad de la película; los anónimos solo ven el aviso |
| Puntos, canjes y crédito | ✅ | Los puntos se calculan y suman en cada compra (`puntos_ganados`); desde `/fidelizacion` (y también desde el Candy Bar) se canjean por candy o por una entrada gratis (2D). El candy sale al toque como una compra real a $0 con su propio QR; la entrada gratis genera un voucher que se aplica en la próxima compra de butacas (independiente del `credito_extra`, que sigue siendo solo el de las cancelaciones). Queda historial de canjes con su estado (pendiente/usado) |
| Cancelación hasta 2 horas antes, con crédito | ✅ | Desde `/mis-compras`: libera la butaca, invalida el QR y acredita el crédito según el límite horario configurado |
| Preventa por película | 🔧 | Campos cargados; falta aplicar el precio en la compra |
| "Mis películas" | ✅ | Desde `/fidelizacion`: películas con entrada pagada, con póster, fecha de la función y calificación propia editable (reutiliza las reseñas de `pelicula-detalle`) |
| Reportes, gráficos y exportación a PDF y Excel | ⏳ | |
| Log de actividad | 🔧 | Se registra en la base; falta la pantalla para consultarlo |
| PWA | 🔧 | Instalable, con service worker y notificaciones push funcionando (ver fila de "Próximamente" arriba); falta el disparo automático en la fecha de estreno |
| Despliegue con URL funcional | ✅ | Firebase Hosting |

### Funcionalidad opcional

Mapa del cine que indique la sala de la entrada comprada. El cliente aún no dio luz verde, por lo que queda fuera del alcance actual.
