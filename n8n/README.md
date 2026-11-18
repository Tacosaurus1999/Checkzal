# n8n + Telegram: registrar reservas con el PMS

El bot pregunta **nombre, apellidos, correo, fecha de llegada, fecha de salida y habitación**, muestra las
habitaciones libres, pide confirmación y registra el huésped y la reserva. Al final responde con el código de
la reserva y envía un correo de confirmación.

```
Telegram ─► n8n ─► API del PMS (http://localhost:4000/api) ─► PostgreSQL
                └─► correo (SMTP)
```

n8n **no escribe SQL**: llama a la API del proyecto, así se respetan las validaciones (capacidad, fechas,
hotel del usuario) y la protección contra sobreventa (HTTP 409 → "ya no está disponible").

Archivo del flujo: [`flujo-reservas-telegram.json`](flujo-reservas-telegram.json)

## Conversación de ejemplo

```
Tú:  /reservar
Bot: ¿Cuál es tu nombre (o nombres)?      → Isaac
Bot: ¿Y tus apellidos?                    → López Hernández
Bot: ¿Cuál es tu correo electrónico?      → isaac@correo.com
Bot: ¿Qué día llegas? (AAAA-MM-DD)        → 2027-02-10
Bot: ¿Qué día te vas?                     → 2027-02-12
Bot: Habitaciones libres ... 102, 201     → 201
Bot: Confirma tu reserva: ... SI          → SI
Bot: ✅ ¡Reserva registrada! Código: 3F9A12BC ...
```

`/cancelar` en cualquier momento termina la conversación. Las sesiones inactivas más de 30 min se reinician.

## 1. Un bot nuevo para reservas

Telegram permite **un solo webhook por bot**. Si ya usas "Llavero Hotel" para consultar reservas, crea otro bot
en BotFather (`/newbot`, por ejemplo `reservas_hotel_isaaz_bot`) o desactiva el otro flujo. Guarda el token.

## 2. Cuenta de servicio para n8n (WSL)

Un usuario solo para n8n, con rol `recepcionista` (no uses la cuenta de admin):

```bash
cd /mnt/c/hotel-pms/backend
export PGPASSWORD='tu_password_postgres'
H=$(node -e "console.log(require('bcryptjs').hashSync('CambiaEstaClaveN8n1',10))")
psql -U postgres -h localhost -d hotel_pms <<SQL
INSERT INTO usuarios (hotel_id, nombre, email, password_hash, rol)
VALUES (1,'Bot n8n','n8n@casajaguar.mx','$H','recepcionista')
ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, activo=TRUE;
SQL
```

Las reservas del bot quedan en el hotel de ese usuario (hotel 1, Casa Jaguar).

## 3. Credenciales en n8n (menú Credentials → Create)

| Credencial | Tipo | Datos |
|---|---|---|
| **Telegram - Bot de reservas** | Telegram API | Token del bot nuevo |
| **PMS - cuenta de servicio n8n** | Custom Auth | JSON: `{"body": {"email": "n8n@casajaguar.mx", "password": "CambiaEstaClaveN8n1"}}` |
| **SMTP - correo del hotel** | SMTP | Gmail: host `smtp.gmail.com`, puerto `465`, SSL activado, usuario = tu correo, contraseña = **contraseña de aplicación** (cuenta Google con verificación en 2 pasos) |

## 4. Importar y ajustar el flujo

1. n8n → **Workflows → Import from File** → `flujo-reservas-telegram.json`.
2. En cada nodo con aviso rojo, elige la credencial que corresponda (Telegram en 5 nodos, Custom Auth en
   *Login PMS*, SMTP en *Enviar correo de confirmación*).
3. En *Enviar correo de confirmación* cambia **From Email** por tu correo real.
4. Si el backend no está en `http://localhost:4000`, cambia la URL en los 5 nodos HTTP Request
   (Login PMS, Consultar disponibilidad, Buscar huésped por correo, Crear huésped y Crear reserva).
5. **Publica** el flujo (botón *Publish*). Es obligatorio: el estado de la conversación se guarda en los datos
   del flujo y **no persiste en ejecuciones de prueba**.

## 5. Webhook público (igual que en la actividad)

```
ngrok http 5678
set N8N_WEBHOOK_URL=https://<tu-subdominio>.ngrok-free.dev/
npx n8n
```

Con el flujo publicado, n8n registra el webhook ante Telegram. Después, prueba desde el celular con `/reservar`.

## 6. Comprobar que quedó registrado

```bash
psql -U postgres -h localhost -d hotel_pms -c \
 "SELECT r.codigo, hu.nombre||' '||hu.apellidos AS huesped, hu.email, r.fecha_entrada, r.fecha_salida, r.estado, r.origen, r.total
    FROM reservas r JOIN huespedes hu ON hu.id=r.huesped_id WHERE r.origen='telegram' ORDER BY r.id DESC LIMIT 5;"
```

También aparece en la pantalla **Reservas** de la app (origen `telegram`, estado `pendiente`) para que recepción la confirme.

## Decisiones del flujo

- La reserva se crea **pendiente**; recepción la confirma desde el sistema.
- Adultos: 2, o la capacidad de la habitación si es menor (el bot no lo pregunta).
- Si el correo ya existe como huésped, se reutiliza; si no, se crea (con su `telegramChatId`).
- El precio sale del tipo de habitación, y el total es noches × precio.
- Si dos personas eligen la misma habitación a la vez, la segunda recibe el aviso de no disponible (409).

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `ECONNREFUSED` en *Login PMS* | n8n (Windows) no alcanza el backend (WSL). Prueba `http://localhost:4000/api/health` en el navegador de Windows; si no abre, usa la IP de WSL (`hostname -I`) en las URLs. |
| 401 en login | Correo o contraseña de la credencial Custom Auth distintos a los del usuario de servicio. |
| El bot repite "¿Cuál es tu nombre?" siempre | El flujo no está publicado (modo prueba no guarda el estado) o se reinició la sesión por inactividad. |
| Reserva creada pero sin correo | Falla de SMTP; el flujo sigue (el correo no bloquea la reserva). Revisa la contraseña de aplicación. |
| "No pude registrar la reserva: ..." | Es el mensaje de validación de la API (fechas, capacidad, etc.). |
