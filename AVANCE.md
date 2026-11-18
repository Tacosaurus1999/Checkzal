# Avance — Proyecto 9: PMS para hoteles boutique y posadas

Estado: **versión mínima funcional (MVP) del núcleo operativo**. Misma arquitectura que `ecommerce-spotify-ui`
(backend hexagonal + SPA React/Tailwind), sobre el esquema `database/schema.sql` sin modificar.

## Ya funciona

| Módulo | Qué hace |
|---|---|
| **Acceso** | Inicio de sesión con JWT. Roles `admin`, `gerente`, `recepcionista` (ENUM `rol_usuario`). Todo queda acotado al `hotel_id` del usuario. |
| **Panel** | Ocupación del día (`v_ocupacion_hoy`), grid de habitaciones coloreado por `estado_habitacion`, llegadas y salidas del día (`v_movimientos_hoy`). |
| **Reservas** | Alta con disponibilidad real (`habitaciones_disponibles`), varias habitaciones por reserva, transacción `reservas` + `reserva_habitaciones`, **HTTP 409 ante sobreventa** (`sin_sobreventa`, SQLSTATE `23P01`). Listado con filtros. Confirmar, cancelar, no-show (el trigger libera cuartos). |
| **Check-in / check-out** | Crea y cierra `estancias`, marca habitaciones `ocupada` → `limpieza`. El check-out con saldo pendiente solo lo fuerza admin/gerente. |
| **Pagos** | Anticipos y abonos por método; saldo con `v_saldo_reservas`; rechaza pagos mayores al saldo. |
| **Habitaciones** | CRUD de habitaciones y tipos; cambio de estado operativo (limpieza, mantenimiento…) desde la tabla o la barra inferior. |
| **Huéspedes** | CRUD con búsqueda por nombre, teléfono, correo o documento. |
| **Estadísticas** | (solo admin) reservas, personas, llegadas, cancelaciones, no-show e ingresos cobrados por semana, mes o año, con gráfica, tabla y rango de fechas editable. |
| **Personal** | (solo admin) alta, rol, activar/desactivar, restablecer contraseña. |

Calidad: 24 pruebas unitarias (`npm test` en `backend/`, sin base de datos); consultas SQL del backend probadas contra PostgreSQL 16 (disponibilidad, traslape `23P01`, check-in/out, trigger de cancelación, vistas, claves foráneas/únicas).

## Correcciones recientes

| Área | Problema | Corrección |
|---|---|---|
| Reservas | Se podían crear reservas con entrada en el pasado | Rechazadas (`FECHA_PASADA`), salvo admin/gerente |
| Reservas | Se podía marcar *no-show* una reserva futura (distorsionaba estadísticas) | Solo desde la fecha de llegada (`NO_SHOW_PREMATURO`) |
| Reservas | Check-in en cualquier fecha | Solo entre la entrada y la salida (`CHECKIN_FUERA_DE_FECHA`); la interfaz oculta los botones que no aplican |
| Seguridad | Una cuenta desactivada seguía operando hasta 8 h con su token | Se verifica la cuenta y el rol vigentes (caché de 30 s) |
| Seguridad | Sin límite de intentos de login | 8 fallos por IP+correo en 15 min → HTTP 429 |
| API | JSON mal formado devolvía HTML; errores sin formato | Respuestas JSON siempre |
| API | `%` y `_` en las búsquedas actuaban como comodín | Se escapan |
| Servidor | Sin apagado ordenado; mensaje poco claro con puerto ocupado; BD caída colgaba peticiones | SIGTERM/SIGINT cierran el pool; aviso claro de `EADDRINUSE`; timeouts de conexión y de consulta |
| Base de datos | Faltaban índices para FK y búsquedas | `database/indices_opcionales.sql` (opcional) |

## Marca: Checkzal

- El programa se llama **Checkzal**: logo (árbol) en `frontend/src/assets/logo.png` (fondo transparente), favicon en `frontend/public/`, nombre en barra lateral, login, título de la pestaña y correo.

## Rediseño con Bootstrap 5

- Todo el frontend usa **Bootstrap 5.3** (sin Tailwind) con el tema propio vino/crema/café en `frontend/src/tema.css` (variables de Bootstrap sobreescritas + clases `pms-*`).
- Iconos con Bootstrap Icons; modales de Bootstrap controlados por React (sin JS de Bootstrap); navegación móvil inferior.
- Dependencias nuevas: `bootstrap`, `bootstrap-icons`. Se quitaron `tailwindcss`, `postcss`, `autoprefixer`. Hay que correr `npm install` en `frontend`.
- Revisado con capturas renderizadas (escritorio y móvil) de panel, reservas, detalle, habitaciones, huéspedes, usuarios, estadísticas, escaneo y login.

## QR por reserva

- Cada reserva tiene un **QR** (sin librerías externas: `infrastructure/qr/qrEncoder.js`, verificado decodificándolo). Contiene la URL `URL_PUBLICA/escanear?c=CODIGO`.
- API: `GET /api/reservas/:id/qr` (PNG/SVG), `GET /api/reservas/por-codigo?c=…` (código suelto o texto del QR), `POST /api/reservas/:id/enviar-correo` (envío manual).
- **Correo automático** al crear una reserva si el huésped tiene correo y `SMTP_*` está configurado (no hace fallar la reserva; `?sinCorreo=1` lo omite). Cliente SMTP propio (`infrastructure/email/smtpMailer.js`, 465 SSL o 587 STARTTLS).
- Frontend: QR en el detalle de la reserva (descargar / enviar por correo), pantalla **Escanear QR** (cámara con BarcodeDetector, o código manual) con check-in directo; al abrir un QR con la cámara del teléfono sin sesión, vuelve a la reserva tras iniciar sesión. Vite escucha en la red local (`host: true`).
- Lector en el navegador: BarcodeDetector (Chrome/Edge) o jsQR (Safari/Firefox). La cámara exige HTTPS o localhost: `npm run dev:https` (certificado local) y `URL_PUBLICA=https://IP:5173`.
- Escanear QR: botones contextuales **Confirmar reserva / Check-in / Check-out** y *modo automático* (opcional, se recuerda en el navegador): al leer un QR hace solo el siguiente paso, una vez por lectura.
- Bot: al consultar una reserva *pendiente* ofrece confirmarla (SI/NO).
- Bot de Telegram (n8n): manda la imagen del QR al registrar y en *Ver mi reserva*; el correo lo envía el PMS (ya no hay nodo SMTP en n8n).
- 37 pruebas pasan.

## Búsquedas y alta de huéspedes

- Búsqueda de huéspedes y reservas: insensible a mayúsculas y acentos, por palabras en cualquier orden (hasta 5), con comodines escapados.
  Un código de reserva completo (8 hex) usa igualdad exacta. Código en `infrastructure/db/busqueda.js`.
- Índices nuevos en `database/indices_opcionales.sql` (pg_trgm sobre la misma expresión normalizada). **Hay que volver a ejecutarlo.**
  En 60 mil huéspedes / 150 mil reservas: búsqueda multi-palabra ~117 → ~9 ms, por email ~102 → ~2 ms, por código ~1 ms.
- No se podían dar de alta huéspedes: causa más probable, secuencia `huespedes_id_seq` desfasada tras insertar datos con id explícito.
  Se arregla con `database/reparar_secuencias.sql`. Ahora el error se muestra como SECUENCIA_DESFASADA en vez de "documento duplicado".
- Huéspedes antiguos con tipo de documento y sin número ya se pueden editar; el script y los datos demo lo normalizan.
- 29 pruebas pasan (`node --test tests/*.test.js`).

## Pendiente (siguientes sprints)

1. **Servicios y consumos** (`servicios`, `consumos`): hoy el saldo ya los incluye vía la vista, falta el módulo para cargarlos.
2. **Bloqueos de habitación** (`bloqueos_habitacion`): la disponibilidad ya los respeta; falta la pantalla.
3. **Huéspedes acompañantes** por habitación (`estancia_huespedes`).
4. **Notificaciones** (`notificaciones`): Telegram Bot, n8n y Node-RED consumiendo la tabla/endpoints.
5. **Reportes** gerenciales adicionales (ocupación por periodo, exportar a Excel) y calendario tipo timeline.
6. **Pruebas de integración** de la API contra PostgreSQL y CI.
7. Alta de **hoteles** desde la interfaz (hoy se crea con SQL o `npm run admin:crear`).

## Nota de verificación

El entorno donde se generó el proyecto no pudo descargar paquetes de npm, así que **la primera ejecución de
`npm install`, `npm run dev` y `vite build` ocurrirá en tu máquina**. El JSX se revisó sintácticamente y la lógica
de dominio/SQL se probó por separado; si algo falla al arrancar, avísame con el mensaje de error.

## Bot reforzado
Nodos HTTP con respuesta completa, compuerta de login, respuestas de error y try/catch en nodos de código; comparación de correo/código sin distinguir mayúsculas.
