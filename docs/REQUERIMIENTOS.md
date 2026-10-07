# Requerimientos — Sistema de Cine

Lista de requerimientos pedidos por el cliente, agrupados por sprint y con el estado real de cada uno a hoy. Referencias: ✅ terminado · 🔧 parcial o pendiente de confirmar · ⏳ sin empezar.

Para cómo está armado técnicamente cada punto ver [ARQUITECTURA.md](ARQUITECTURA.md); para una explicación de uso sin términos técnicos ver [FUNCIONALIDAD.md](FUNCIONALIDAD.md).

## Sprint 0 — Base del proyecto

*Análisis · infraestructura · diseño*

- ✅ Documento de requerimientos (entregable 1) y lista de dudas
- ✅ Modelo de datos completo en una sola pasada (películas, géneros, salas, butacas, funciones, compras, entradas, productos, categorías, combos, cupones, puntos, recompensas, créditos, reseñas, alertas, log)
- ✅ Triggers de log de actividad desde el día 1
- ✅ Repositorio en GitHub, proyecto en Supabase, Storage para imágenes
- ✅ PWA inicial (manifest, service worker) y primer despliegue con URL funcional
- ✅ Estilo visual único: paleta, tipografías y componentes base

## Sprint 1 — Acceso y componentes compartidos

*Autenticación · seguridad · UI base*

- ✅ Registro (mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos, días de vacaciones), login y logout
- ✅ Compra anónima permitida
- ✅ Roles (cliente, empleado, admin), guards de rutas y políticas RLS de todas las tablas
- ✅ Layout general, navbar y footer
- ✅ Selector de fecha/hora propio (sin calendario desplegable ni scroll largo)
- ⏳ Tabla y formulario CRUD genérico reutilizable — cada ABM (películas, candy, funciones, configuración) tiene su propio componente; no hay un componente genérico compartido

## Sprint 2 — Todos los ABM del administrador

*Panel admin (CRUD)*

- ✅ Películas: nombre, duración, imagen, sinopsis, géneros múltiples, formato (2D/3D/4D/5D), idioma, restricción de edad, fecha de estreno, destacada en portada
- 🔧 Preventa por película: precio especial desde `fecha_fin_preventa` — ya aplicado en Angular (la pantalla de compra muestra el precio de preventa); falta confirmar que se corrió en Supabase el `comprar()` actualizado que lo cobra de verdad
- ✅ Salas y butacas: **5 salas**, 20 filas (A–T), columnas 4/20/4; fila J accesible (2/10/2) y fila K como pasillo (decisión ya resuelta con el cliente); filas R, S, T VIP
- ✅ Candy: productos y categorías
- 🔧 Combos: hoy es una categoría más del candy (con marca de "destacado"); falta el combo real de entrada + pochoclos + bebida a precio fijo
- ✅ Cupones y configuración: % de primera compra, cupón +50 años, costo en puntos de cada recompensa

## Sprint 3 — Funciones y asignación automática de salas

*Lógica de negocio central*

- ✅ Crear funciones con película, formato, idioma y horario
- ✅ Funciones recurrentes (ej.: lunes, martes y viernes a las 18 hs)
- ✅ Asignación automática de sala sin solapamientos y con 30 min mínimos entre funciones
- ✅ Validación en el backend (constraint de exclusión GiST), no solo en el frontend
- ✅ Mensajes claros cuando no hay sala disponible

## Sprint 4 — Portal público

*Cartelera y catálogo (cliente)*

- ✅ Portada con las 3 películas más vendidas primero
- ✅ Listado con buscador y filtro por múltiples géneros — el filtro solo muestra los géneros que efectivamente tienen alguna película cargada
- ✅ Detalle de película: funciones disponibles, reseñas (estrellas + comentario corto) y puntuación promedio
- 🔧 Sección "Próximamente" y botón para activar alerta de venta — la vista, el guardado de la preferencia y el envío real por push funcionan; el disparo queda **manual** a propósito (lo dispara un admin), para poder probarlo en la defensa
- 🔧 Combos destacados en la página de compra — ligado al mismo pendiente de combos reales del Sprint 2

## Sprint 5 — Flujo de compra

*Butacas · pago · PDF · QR*

- ✅ Mapa de butacas en tiempo real con Supabase Realtime
- ✅ Butacas accesibles resaltadas y VIP diferenciadas, con aviso claro antes de pagar
- ✅ Reserva temporal con expiración (evitar compras dobles)
- ✅ Bloqueo por edad (+13/+18) y leyenda de restricción en la entrada
- 🔧 Precio de preventa o normal según la fecha — mismo estado que en el Sprint 2
- ✅ Aplicación de cupones
- 🔧 Productos y combos en la misma compra — candy sí, combos reales no
- ✅ Pago simulado / sandbox
- ✅ PDF de la entrada con QR único, válido también para el candy

## Sprint 6 — Gestión de entradas

*Validación y cancelación (ciclo de vida del QR)*

- ✅ Panel de empleados: escaneo de QR con cámara e ingreso manual del código
- ✅ Estados separados para entrada y candy; al validar o entregar, el QR deja de funcionar
- ✅ Cancelación hasta 2 horas antes de la función sin devolución: genera crédito, libera butaca, invalida QR
- ⏳ Definir qué pasa con puntos y cupones de una compra cancelada — sigue sin resolver con el cliente; hoy `comprar()` calcula los puntos sobre el valor íntegro de la compra, sin importar si después se canceló o se pagó con crédito

## Sprint 7 — Perfil y fidelización del usuario

*Cuenta del cliente*

- ✅ Puntos: 1 punto por peso gastado, solo usuarios registrados
- ✅ Canje por entradas gratis o productos del candy según costos configurados
- ✅ Crédito visible en el perfil y combinable con otros métodos de pago
- ✅ Historial de canjes y puntos acumulados (no transferibles)
- ✅ "Mis películas": historial visual con póster, fecha y calificación propia

## Sprint 8 — Reportes, gráficos y auditoría

*Análisis del administrador*

- ⏳ Reporte de facturación por día y entradas vendidas
- ⏳ Exportación a PDF y Excel (reutilizando la librería de PDF del Sprint 5)
- ⏳ Gráficos: películas más vistas por semana y por mes
- ⏳ Gráfico: producto del candy más vendido
- 🔧 Vista del log de actividad (quién creó una función, modificó un precio o validó un QR, con fecha y hora) — pantalla `/admin-log` lista, visible solo para el gerente, con lectura en lenguaje natural (no JSON técnico); falta confirmar que se corrieron en Supabase el trigger de auditoría sobre `compras` y la política RLS que restringe la lectura a `gerente`

## Sprint 9 — Cierre y entrega

*PWA · calidad · defensa*

- 🔧 PWA completa: instalable, caché offline básico y notificaciones push (alertas de estreno) — todo funciona; el disparo automático en la fecha de estreno queda pendiente a propósito (ver Sprint 4)
- ⏳ Responsive y revisión de usabilidad (poco scroll, navegación clara para clientes y empleados) — sin una revisión dedicada todavía
- ⏳ Estados de carga y manejo de errores — sin una revisión dedicada todavía
- ✅ Revisión de buenas prácticas de Angular: lazy loading, tipado, signals/RxJS
- 🔧 README con arquitectura, decisiones técnicas y usuarios de prueba — documentación dividida en este set de documentos; la tabla de usuarios de prueba (admin, empleado, cliente) todavía tiene los datos sin completar
- ✅ Verificar despliegue final con URL funcional
- ⏳ Preparar la defensa oral
- ✅ Ruta comodín (`**`) para cualquier URL no reconocida

## Decisiones a definir

Puntos donde el mail del cliente es ambiguo o contradictorio.

- ✅ **Filas J y K:** resuelto — la fila J es la accesible (2, 10 y 2 butacas), la fila K queda vacía como pasillo
- ⏳ **Restricción de edad:** falta confirmar si la leyenda "debe ir un adulto" aplica también al adulto que compra para un menor
- ✅ **QR:** confirmado — entrada y candy se validan de forma independiente
- ⏳ **Cupones:** falta definir si se acumulan entre sí y si aplican también al candy
- ⏳ **Puntos:** falta definir sobre qué monto se calculan y si se ganan al pagar con crédito (ver Sprint 6)
- ⏳ **Cancelación:** falta definir qué pasa con puntos y cupones ya usados en esa compra
- ✅ **Pago:** confirmado — se implementa como pasarela simulada

## Funcionalidad opcional (backlog)

- ⏳ Mapa del cine que indique la sala de la entrada comprada. El cliente todavía no dio luz verde, queda fuera del alcance actual.
