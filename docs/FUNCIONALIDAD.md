# Qué hace la aplicación — Sistema de Cine

Esta es una guía de todo lo que la aplicación permite hacer, explicada en lenguaje simple, sin términos técnicos. Pensala como el manual de uso que le mostrarías a alguien que nunca programó y quiere entender para qué sirve el sistema.

## ¿Qué es?

Es el sistema completo de un cine: la página donde cualquier persona entra a ver qué películas están dando, elige sus butacas, compra la entrada y el candy, y después el cine usa el mismo sistema para controlar el ingreso a la sala y administrar todo el negocio (películas, horarios, precios, empleados).

Funciona desde el celular o la computadora, con o sin cuenta creada, y se puede instalar como una aplicación (como cualquier app del celular) para abrirla más rápido y recibir avisos.

## Lo que puede hacer cualquier visitante (sin registrarse)

- **Ver la cartelera**: qué películas están dando, buscarlas por nombre y filtrar por género (acción, comedia, terror, etc. — solo aparecen los géneros que realmente tienen alguna película cargada).
- **Ver el detalle de una película**: sinopsis, duración, clasificación de edad, en qué formatos y horarios se puede ver, y las reseñas que dejaron otros usuarios (puntaje en estrellas y comentario).
- **Comprar entradas sin crear una cuenta**: elegir función, ver el mapa de butacas de la sala en tiempo real (se actualiza solo si otra persona está reservando al mismo tiempo), elegir los asientos, pagar (con una pasarela de pago simulada, no se cobra plata real) y recibir un PDF con un código QR para presentar en la sala.
- **Comprar candy sin comprar entrada**: pochoclos, bebidas y golosinas, para quien ya tiene su entrada y solo quiere pedir algo para comer.
- Si la película tiene restricción de edad, el sistema avisa que tiene que ir acompañado de un adulto responsable.

## Lo que gana un cliente al crear una cuenta

Registrarse pide algunos datos (nombre, apellido, fecha de nacimiento, mail) y a cambio desbloquea:

- **Historial de compras** ("Mis compras"): ver todas las entradas y pedidos de candy que hizo, con la posibilidad de **cancelar una compra hasta 2 horas antes de la función**. No se devuelve el dinero en efectivo, pero queda como crédito a favor para la próxima compra.
- **Puntos de fidelización**: por cada peso gastado se suman puntos, que después se pueden canjear por una entrada gratis o por productos del candy.
- **Crédito combinable**: el crédito que se generó al cancelar una compra se puede usar junto con la tarjeta (simulada) en una compra nueva, no hace falta gastarlo todo de una vez.
- **"Mis películas"**: un historial visual (con el póster) de todas las películas que vio, donde además puede poner su propia calificación.
- **Cupones automáticos**: por ejemplo, un descuento en la primera compra o un descuento para mayores de 50 años, que el sistema aplica solo si corresponde.
- **Avisos de estreno**: en la sección "Próximamente" se puede activar una alerta para una película que todavía no se estrenó, y recibir una notificación (push, como cualquier notificación del celular) el día que esté disponible.

## El código QR de la entrada

Cada compra genera un único código QR que sirve para dos cosas a la vez, pero de forma independiente:

- **Entrar a la sala**: el empleado lo escanea en la puerta.
- **Retirar el candy**: si la compra incluía pochoclos o bebida, el mismo código se usa para retirarlo en el mostrador.

Validar la entrada no gasta el candy, y retirar el candy no gasta la entrada: son dos sellos separados sobre el mismo código. Una vez que cada uno se usó, no se puede volver a usar.

## Lo que puede hacer un empleado del cine

Un empleado inicia sesión con una cuenta especial y accede a un panel de administración con:

- **Validación en la puerta**: escanear el código QR con la cámara del celular o computadora, o escribirlo a mano si el QR no se puede leer. El sistema avisa si ya fue usado, si está cancelado, o si es válido.
- Gestión del catálogo: cargar y editar películas, productos del candy, horarios de funciones y precios (ver abajo, es lo mismo que puede hacer el gerente excepto por el log de actividad).

## Lo que puede hacer el gerente (además de todo lo del empleado)

- **Cargar y editar películas**: nombre, duración, imagen, sinopsis, géneros, formato (2D/3D/4D/5D), idioma, clasificación de edad, fecha de estreno y un precio especial de preventa antes del estreno.
- **Armar la grilla de funciones**: elegir película, formato, idioma y horario; el sistema elige automáticamente en qué sala la pone, evitando que se pisen dos funciones en la misma sala, y avisa con claridad si no queda ninguna sala libre en ese horario. También se pueden crear funciones que se repiten varios días (por ejemplo, todos los lunes y viernes a las 18hs).
- **Administrar el candy**: cargar productos, precios y categorías.
- **Configurar precios y promociones**: precio por formato, recargo de las butacas VIP, cuántos puntos se ganan por peso gastado, hasta cuántas horas antes se puede cancelar una compra, y los cupones de descuento.
- **Ver el log de actividad**: una lista de quién hizo qué cambio administrativo y cuándo (quién creó una función, quién modificó un precio, quién validó una entrada o canceló una compra), escrita en frases simples en vez de datos técnicos. Esta pantalla es exclusiva del gerente — un empleado no puede verla.
- *(En construcción)* Reportes de facturación, entradas vendidas y gráficos de qué productos/películas se venden más.

## Qué la hace confiable

Las reglas importantes del negocio no dependen de que la pantalla funcione bien: están garantizadas por el sistema que guarda los datos, así que aunque alguien intente hacer trampa o se cuelgue la conexión, nunca puede pasar que:

- Se venda la misma butaca dos veces.
- Dos funciones se superpongan en la misma sala.
- Alguien fije su propio precio al pagar.
- Alguien canjee más puntos de los que tiene.
- Un cupón o un voucher de entrada gratis se use más de una vez.

## Cómo se usa

No hace falta instalar nada para empezar: es una página web normal. Si se quiere, se puede "instalar" desde el navegador (como una app) para tener un ícono en la pantalla de inicio, abrirla más rápido y recibir las notificaciones de estreno.
