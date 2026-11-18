# Guía de despliegue en Ubuntu (22.04 / 24.04)

Resultado final: el PMS en un servidor Ubuntu con **PostgreSQL + API Node.js (systemd) + frontend servido por Nginx**.

```
Navegador ──► Nginx :80/:443 ──┬─► /            frontend compilado (React)
                               └─► /api/*  ──►  Node.js :4000 ──► PostgreSQL :5432
```

Todos los comandos se ejecutan en el servidor, con un usuario con `sudo`.
Sustituye los valores entre `<...>` por los tuyos.

---

## 0. Antes de empezar

| Necesitas | Detalle |
|---|---|
| Servidor Ubuntu | 1 GB de RAM alcanza para ejecutar; para **compilar** el frontend en el servidor con 1 GB agrega swap (paso 1) o compila en tu PC y copia `dist/` (paso 8, opción B). |
| Puertos abiertos | 22 (SSH), 80 (HTTP) y 443 (HTTPS). **No abras el 4000 ni el 5432** al público. En AWS: grupo de seguridad de la instancia. |
| Código | Este repositorio en tu GitHub, o el `.zip` copiado con `scp`. |

---

## 1. Preparar el servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip ufw build-essential

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # se crea al instalar Nginx (paso 9); si falla, repite después
sudo ufw enable

# (Solo servidores de 1 GB) swap de 1 GB para poder compilar el frontend
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> Si `ufw allow 'Nginx Full'` dice que el perfil no existe, instala Nginx (paso 9) y vuelve a ejecutarlo.

---

## 2. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v    # v20.x
```

---

## 3. PostgreSQL y la base `hotel_pms`

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Crea un usuario propio para la aplicación (no uses `postgres`) y la base de datos:

```bash
sudo -u postgres psql -c "CREATE USER hotel_app WITH PASSWORD '<PASSWORD_DB>';"
sudo -u postgres psql -c "CREATE DATABASE hotel_pms OWNER hotel_app;"
```

> `btree_gist` (necesaria para evitar sobreventas con `EXCLUDE USING gist`) es una extensión *trusted* en PostgreSQL 13+, por lo que el dueño de la base puede crearla sin ser superusuario.

---

## 4. Código de la aplicación

```bash
# Usuario de sistema sin login para ejecutar la API
sudo useradd --system --home /opt/hotel-pms --shell /usr/sbin/nologin hotelpms

# Opción A: desde GitHub
sudo git clone https://github.com/<TU_USUARIO>/<TU_REPO>.git /opt/hotel-pms

# Opción B: desde el .zip (cópialo antes con: scp hotel-pms.zip ubuntu@<IP>:~)
# sudo unzip ~/hotel-pms.zip -d /opt        # crea /opt/hotel-pms

sudo chown -R $USER:$USER /opt/hotel-pms
```

---

## 5. Importar el esquema

Elige **una** de las dos opciones.

### Opción A — Demo con datos de ejemplo

Crea 2 hoteles, 5 habitaciones, 1 huésped y 1 reserva de prueba.

```bash
cd /opt/hotel-pms
PGPASSWORD='<PASSWORD_DB>' psql -h localhost -U hotel_app -d hotel_pms -v ON_ERROR_STOP=1 -f database/schema.sql
```

### Opción B — Producción (sin datos de ejemplo)

Importa solo tablas, tipos, triggers, funciones y vistas (corta el archivo antes de la sección `DATOS DE EJEMPLO`):

```bash
cd /opt/hotel-pms
sed '/DATOS DE EJEMPLO/,$d' database/schema.sql > /tmp/schema_prod.sql
PGPASSWORD='<PASSWORD_DB>' psql -h localhost -U hotel_app -d hotel_pms -v ON_ERROR_STOP=1 -f /tmp/schema_prod.sql
rm /tmp/schema_prod.sql
```

Verifica:

```bash
PGPASSWORD='<PASSWORD_DB>' psql -h localhost -U hotel_app -d hotel_pms -c '\dt'
```

---

## 6. Backend

```bash
cd /opt/hotel-pms/backend
npm install --omit=dev
cp .env.example .env
nano .env
```

Contenido de `.env` (genera el secreto con `openssl rand -hex 48`):

```ini
PORT=4000
CORS_ORIGIN=
DB_HOST=localhost
DB_PORT=5432
DB_USER=hotel_app
DB_PASSWORD=<PASSWORD_DB>
DB_NAME=hotel_pms
JWT_SECRET=<RESULTADO_DE_openssl_rand_-hex_48>
```

> En producción el servidor **se niega a arrancar sin `JWT_SECRET`**. Como Nginx sirve frontend y API desde el mismo dominio, `CORS_ORIGIN` puede quedar vacío; si algún día separas dominios, pon ahí el origen del frontend (por ejemplo `https://pms.mihotel.mx`).

Protege el archivo y entrégalo al usuario del servicio:

```bash
sudo chown -R hotelpms:hotelpms /opt/hotel-pms/backend
sudo chmod 600 /opt/hotel-pms/backend/.env
```

### Crear el primer acceso

**Opción A (demo):** los usuarios de ejemplo traen un hash de mentira. Asígnales contraseña real:

```bash
cd /opt/hotel-pms/backend
sudo -u hotelpms npm run usuario:password -- ana@casajaguar.mx '<ClaveSegura123>'
```

**Opción B (producción):** crea tu hotel y su administrador:

```bash
cd /opt/hotel-pms/backend
sudo -u hotelpms npm run admin:crear -- "Hotel Casa Jaguar" "San Cristóbal de las Casas" "Ana Morales" ana@hotel.mx '<ClaveSegura123>'
```

Las contraseñas deben tener mínimo 8 caracteres, con letras y números. Después, desde el sistema (módulo **Personal**), el administrador da de alta al resto del equipo, y desde **Habitaciones** registra los tipos y cuartos.

### Prueba rápida antes de dejarlo como servicio

```bash
cd /opt/hotel-pms/backend
sudo -u hotelpms NODE_ENV=production node src/server.js &
sleep 2; curl http://localhost:4000/api/health      # {"status":"ok"}
kill %1
```

---

## 7. API como servicio (systemd)

```bash
sudo cp /opt/hotel-pms/deploy/hotel-pms-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hotel-pms-backend
sudo systemctl status hotel-pms-backend --no-pager
curl http://localhost:4000/api/health
```

Logs en vivo: `sudo journalctl -u hotel-pms-backend -f`

---

## 8. Frontend (compilado)

### Opción A — Compilar en el servidor

```bash
cd /opt/hotel-pms/frontend
npm install
npm run build                # genera frontend/dist
sudo mkdir -p /var/www/hotel-pms
sudo cp -r dist/* /var/www/hotel-pms/
```

### Opción B — Compilar en tu computadora y copiar (recomendado en servidores de 1 GB)

```bash
# En tu PC
cd frontend && npm install && npm run build
scp -r dist/* ubuntu@<IP_SERVIDOR>:/tmp/dist/        # crea /tmp/dist antes con ssh si hace falta

# En el servidor
sudo mkdir -p /var/www/hotel-pms
sudo cp -r /tmp/dist/* /var/www/hotel-pms/
```

No necesitas `.env` en el frontend: usa rutas relativas (`/api`) y Nginx las reenvía al backend.

---

## 9. Nginx

```bash
sudo apt install -y nginx
sudo cp /opt/hotel-pms/deploy/nginx-hotel-pms.conf /etc/nginx/sites-available/hotel-pms
sudo ln -s /etc/nginx/sites-available/hotel-pms /etc/nginx/sites-enabled/hotel-pms
sudo rm -f /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/hotel-pms     # cambia server_name _ por tu dominio, si lo tienes
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'
```

Abre `http://<IP_DEL_SERVIDOR>` → debe aparecer la pantalla de inicio de sesión.

---

## 10. HTTPS (si tienes dominio)

Apunta un registro DNS **A** de tu dominio a la IP del servidor y ejecuta:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pms.mihotel.mx
sudo systemctl status certbot.timer --no-pager      # renovación automática
```

---

## 11. Verificación final

```bash
curl -s http://localhost/api/health                  # {"status":"ok"}
curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@casajaguar.mx","password":"<ClaveSegura123>"}' | head -c 200
```

En el navegador: inicia sesión → **Panel** (grid de habitaciones y llegadas/salidas del día) → **Nueva reserva** → intenta reservar dos veces la misma habitación en fechas que se traslapan: la segunda debe rechazarse (HTTP 409, sin sobreventa).

---

## 12. Actualizar a una nueva versión

```bash
cd /opt/hotel-pms
sudo -u hotelpms git pull                 # o copia los archivos nuevos
cd backend && sudo -u hotelpms npm install --omit=dev
sudo systemctl restart hotel-pms-backend
cd ../frontend && npm install && npm run build && sudo cp -r dist/* /var/www/hotel-pms/
```

Si la actualización cambia el esquema, aplica el SQL de migración con `psql` **antes** de reiniciar la API.

## 13. Respaldos de la base de datos

```bash
sudo mkdir -p /var/backups/hotel-pms && sudo chown $USER /var/backups/hotel-pms
echo "0 3 * * * PGPASSWORD='<PASSWORD_DB>' pg_dump -h localhost -U hotel_app hotel_pms | gzip > /var/backups/hotel-pms/hotel_pms_\$(date +\%F).sql.gz && find /var/backups/hotel-pms -mtime +14 -delete" | crontab -
```

Restaurar: `gunzip -c respaldo.sql.gz | PGPASSWORD='...' psql -h localhost -U hotel_app -d hotel_pms`.
Copia también los respaldos fuera del servidor (por ejemplo a S3).

---

## Variante: AWS EC2 + RDS PostgreSQL

Es la misma guía, con estas diferencias:

1. **Omite el paso 3** (no instales PostgreSQL en la EC2). Crea una instancia RDS PostgreSQL 14+ en la misma VPC.
2. Grupo de seguridad de RDS: permite el puerto **5432 solo desde el grupo de seguridad de la EC2**.
3. Crea el usuario de la aplicación desde la EC2 (necesitas `sudo apt install -y postgresql-client`):
   ```bash
   psql -h <ENDPOINT_RDS> -U <USUARIO_MAESTRO> -d postgres \
     -c "CREATE USER hotel_app WITH PASSWORD '<PASSWORD_DB>';" \
     -c "GRANT hotel_app TO <USUARIO_MAESTRO>;" \
     -c "CREATE DATABASE hotel_pms OWNER hotel_app;"
   ```
4. En los pasos 5 y 6 usa `-h <ENDPOINT_RDS>` en `psql` y `DB_HOST=<ENDPOINT_RDS>` en `.env`.
5. Si RDS exige SSL, agrega `PGSSLMODE=require` al `.env` (el driver `pg` lo respeta).

---

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| `502 Bad Gateway` en `/api` | La API no está corriendo: `sudo systemctl status hotel-pms-backend` y `journalctl -u hotel-pms-backend -n 50`. |
| El servicio no arranca: `JWT_SECRET es obligatorio` | Falta `JWT_SECRET` en `/opt/hotel-pms/backend/.env`. |
| `password authentication failed for user "hotel_app"` | `DB_PASSWORD` distinto al creado en el paso 3. |
| `permission denied for table …` | Importaste el esquema con otro usuario. Reimporta con `hotel_app`, o reasigna: `ALTER DATABASE hotel_pms OWNER TO hotel_app;` y `REASSIGN OWNED BY postgres TO hotel_app;` (como superusuario, dentro de la base). |
| Al abrir `/reservas` directo da 404 | Falta el `try_files … /index.html` de Nginx (usa el archivo de `deploy/`). |
| `vite build` se queda sin memoria | Agrega swap (paso 1) o compila en tu PC (paso 8, opción B). |
| El login responde "Credenciales inválidas" con los usuarios de ejemplo | Falta asignar contraseña (`npm run usuario:password`, paso 6). |
| Cambios en el frontend no se ven | Vuelve a copiar `dist/` a `/var/www/hotel-pms/` y recarga con Ctrl+F5. |
