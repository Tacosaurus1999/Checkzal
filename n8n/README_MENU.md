# Bot con menú: Reservar · Ver mi reserva · Cancelar mi reserva

Archivo: [`flujo-menu-telegram.json`](flujo-menu-telegram.json). Misma estructura que tu flujo
(Schedule Trigger → Obtener offset → Telegram - Recibir → Procesar mensaje → … → Telegram - Enviar),
con respuestas predefinidas y **sin agente de IA**. No necesita ngrok (lee los mensajes con `getUpdates`).

## Menú

```
¡Hola Isaac! 👋 Soy el asistente del Hotel Casa Jaguar.
¿Qué quieres hacer?

1️⃣ Reservar
2️⃣ Ver mi reserva
3️⃣ Cancelar mi reserva
```

También salen como botones bajo el teclado. En cualquier momento, **Menú** (o `/start`) vuelve al inicio.

| Opción | Qué pide | Qué hace |
|---|---|---|
| Reservar | nombre, apellidos, correo, llegada, salida, habitación, SI | Crea el huésped (o reutiliza el del correo) y la reserva pendiente; responde con el código, **manda el QR al chat** y el PMS envía el correo con el QR |
| Ver mi reserva | código (8 caracteres) + correo | Muestra huésped, habitación, fechas, estado, total, pagado y saldo, y **manda el QR** de la reserva |
| Cancelar mi reserva | código + correo + SI | Cancela si está pendiente o confirmada; si ya tuvo check-in, la manda a recepción |

El correo del titular se pide para ver o cancelar: así nadie consulta reservas ajenas adivinando códigos.

## Cómo ponerlo

1. n8n → **Import from File** → `flujo-menu-telegram.json` (no borres el tuyo; solo **desactívalo**, dos flujos no pueden leer el mismo bot).
2. Abre el nodo **Configuración** y cambia:
   - `token`: el token de tu bot,
   - `pms_url`: `http://localhost:4000/api`,
   - `pms_email` / `pms_password`: el usuario `n8n@casajaguar.mx` (rol recepcionista) de la guía anterior.
3. Correo: **ya no se configura en n8n.** El correo con el QR lo envía el propio PMS: llena las variables `SMTP_*` en `backend/.env` (ver abajo) y reinicia el backend.
4. **Publica** el flujo. Con el flujo sin publicar no se guarda en qué paso va cada chat.
5. Escribe `/start` al bot.

> Si el bot tuvo antes un *webhook* (Telegram Trigger), `getUpdates` falla con "webhook is active". Ábrelo una vez en el navegador:
> `https://api.telegram.org/bot<TOKEN>/deleteWebhook`

## Notas

- Procesa **un mensaje por vuelta (cada 5 s)**; si llegan varios, se atienden en orden en las siguientes vueltas.
- El JSON exportado contiene el token y la contraseña del nodo Configuración: **no lo compartas** con esos datos puestos.
- Revisa que *Executions* no se llene (corre cada 5 s): en Settings del flujo puedes poner "Save successful production executions: Do not save".

## Correo y QR

- Al registrar una reserva, el flujo la crea con `?sinCorreo=1` (para que el backend no mande un segundo correo) y **el propio flujo envía el correo** con los datos y el QR en el paso **Enviar correo con QR**. El bot **no** manda el QR por Telegram al reservar: confirma que lo envió al correo (o avisa si falló).
- Para enviarlo, ese paso llama al PMS (`POST /reservas/:id/enviar-correo`), que usa el SMTP del `.env` del backend. **No hace falta credencial SMTP en n8n** (y no bloquea *Publish*).
- En *Ver mi reserva* el bot sí muestra el QR en el chat, y si la reserva está pendiente ofrece confirmarla (SI/NO). La cancelación solo se confirma por Telegram.

### Configurar el correo en el backend (Gmail)
1. Cuenta de Google → Seguridad → activa la **verificación en 2 pasos**.
2. Busca **Contraseñas de aplicaciones**, crea una (nombre "PMS") y copia las 16 letras.
3. En `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=tucorreo@gmail.com
   SMTP_PASS=las16letras
   SMTP_FROM=Hotel Casa Jaguar <tucorreo@gmail.com>
   URL_PUBLICA=http://192.168.1.50:5173
   ```
4. Reinicia el backend (`npm run dev`).

`URL_PUBLICA` es la dirección donde se abre el PMS; **va dentro del QR**. Para que el celular del recepcionista abra la reserva al apuntar la cámara, debe ser una dirección que el celular alcance (la IP de tu PC en la red, o tu dominio con HTTPS cuando lo publiques), no `localhost`.

## Si el bot repite mensajes o pide datos que no diste

Es un bucle: se lee el mismo mensaje varias veces. Pasos:
1. **Unpublish** el flujo para detenerlo.
2. Confirma los mensajes pendientes en Telegram abriendo en el navegador (cambia `<TOKEN>`):
   `https://api.telegram.org/bot<TOKEN>/getUpdates?offset=-1`
3. Reimporta la versión nueva del flujo (confirma cada mensaje en Telegram en cuanto lo lee y descarta repetidos).
4. Inicia n8n **con una sola ejecución a la vez** y publica:
   ```
   set N8N_CONCURRENCY_PRODUCTION_LIMIT=1
   npx n8n
   ```
5. Escribe `Menú` al bot para limpiar cualquier conversación a medias.

## El bot siempre responde (versión reforzada)
- Si el sistema (PMS) responde con error al consultar disponibilidad, huésped o reserva, el bot te dice el motivo en vez de quedarse callado.
- Si el login del bot falla (usuario `n8n@casajaguar.mx` inexistente o clave mal puesta en el nodo Config), responde: "El bot no pudo iniciar sesión…".
- Cualquier fallo inesperado en un nodo de código responde "Algo salió mal… toca Menú".
- Correos y códigos se comparan sin importar mayúsculas/minúsculas.
- Tras importar: vuelve a llenar el nodo Config (token, pms_url, pms_email, pms_password) y **publica** el flujo.
