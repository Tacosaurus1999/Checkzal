# Checkzal — gestión para hoteles boutique y posadas (PMS): Backend hexagonal (PostgreSQL) + SPA React

Mismo estilo de arquitectura que `ecommerce-spotify-ui`, aplicado al Proyecto 9:

- **Base de datos**: PostgreSQL 14+ (`database/schema.sql`): ENUMs, `EXCLUDE USING gist` contra sobreventas, triggers, función `habitaciones_disponibles` y vistas.
- **Backend**: Node.js 20, JavaScript puro (CommonJS), arquitectura hexagonal (Dominio → Aplicación → Infraestructura), Express, `pg`, `bcryptjs`, JWT.
- **Frontend**: React + Vite + Tailwind CSS (paleta hueso / vino / café, títulos con serifa), consumiendo la API con Axios.

Documentos: [`AVANCE.md`](AVANCE.md) (estado y pendientes) · [`docs/DESPLIEGUE_UBUNTU.md`](docs/DESPLIEGUE_UBUNTU.md) (guía de despliegue) · [`n8n/README.md`](n8n/README.md) (reservas por Telegram con n8n, versión con webhook) · [`n8n/README_MENU.md`](n8n/README_MENU.md) (bot con menú: reservar, ver y cancelar).

---

## 1. Árbol de carpetas

```
hotel-pms/
├── database/schema.sql                    # Esquema del proyecto (sin modificar)
├── deploy/                                # Unidad systemd y sitio Nginx para Ubuntu
├── docs/DESPLIEGUE_UBUNTU.md
├── docker-compose.yml                     # PostgreSQL opcional con Docker
│
├── backend/
│   ├── package.json · .env.example
│   ├── scripts/
│   │   ├── establecerPassword.js          # fija la contraseña de un usuario existente
│   │   └── crearAdmin.js                  # hotel + primer administrador (producción)
│   ├── tests/reservas.test.js             # pruebas unitarias sin BD (npm test)
│   └── src/
│       ├── domain/                        # CAPA DE DOMINIO (sin frameworks ni driver de BD)
│       │   ├── entities/  Usuario · Habitacion(+TipoHabitacion) · Huesped · Reserva(+ReservaHabitacion) · Pago
│       │   └── errors/DomainError.js
│       ├── application/                   # CAPA DE APLICACIÓN
│       │   ├── ports/     repositories.js · CifradoService.js
│       │   └── useCases/  usuario · habitacion · huesped · reserva · pago · reporte
│       ├── infrastructure/                # ADAPTADORES
│       │   ├── db/        pgConnection.js · pgErrors.js (SQLSTATE → DomainError)
│       │   ├── repositories/ PgUsuario · PgHabitacion · PgHuesped · PgReserva · PgPago · PgReporte
│       │   ├── security/BcryptCifradoService.js   # bcryptjs + JWT
│       │   └── http/
│       │       ├── app.js                 # Composition root: ensambla TODAS las capas
│       │       ├── middlewares/authMiddleware.js  # autenticar · requerirRol · requerirAdmin · requerirGestion
│       │       ├── controllers/  auth · usuario · habitacion · huesped · reserva · pago · dashboard
│       │       └── routes/       auth · usuario · habitacion(+tipos) · huesped · reserva · pago · dashboard
│       └── server.js
│
└── frontend/
    ├── package.json · vite.config.js · tailwind.config.js · postcss.config.js · index.html
    └── src/
        ├── main.jsx · App.jsx · index.css
        ├── services/     api · auth · habitacion · huesped · reserva · pago · usuario · dashboard
        ├── context/      AuthContext (sesión) · SeleccionContext (reserva/habitación activa + refresco)
        ├── utils/        estados.js (mapeo de ENUMs → estilos) · formato.js
        ├── components/
        │   ├── layout/        Sidebar · DetailPanel (reserva, check-in/out, pagos) · BottomBar (cuarto + ocupación)
        │   ├── dashboard/     ResumenOcupacion · RoomGrid · OperacionesDia
        │   ├── reservations/  ReservationList · ReservationFormModal · PaymentForm
        │   ├── rooms/         RoomList · RoomFormModal · RoomTypeManager
        │   ├── guests/        GuestList · GuestFormModal
        │   ├── users/         UserList · UserFormModal
        │   ├── auth/Login.jsx
        │   └── ui/            Modal · Campo · EstadoReserva
        └── pages/        PanelPage · ReservasPage · HabitacionesPage · HuespedesPage · UsuariosPage · PerfilPage
```

La dependencia solo va **hacia adentro**: Infraestructura → Aplicación → Dominio. El dominio no conoce Express, `pg` ni `bcryptjs`; la aplicación solo conoce los **puertos**.

## 2. Permisos por rol

| Módulo | recepcionista | gerente | admin |
|---|---|---|---|
| Panel, reservas (crear, confirmar, check-in/out, cancelar), pagos, huéspedes (alta/edición) | ✅ | ✅ | ✅ |
| Cambiar estado operativo de una habitación | ✅ | ✅ | ✅ |
| Modificar precio por noche al reservar · forzar check-out con saldo · borrar huéspedes | ❌ | ✅ | ✅ |
| Crear/editar/eliminar habitaciones y tipos | ❌ | ✅ | ✅ |
| Personal (usuarios) · eliminar reservas · **Estadísticas** (reservas, llegadas, cancelaciones, ingresos) | ❌ | ❌ | ✅ |

Cada consulta se filtra por el `hotel_id` guardado en el token: el personal de un hotel nunca ve datos de otro.

## 3. Desarrollo local en WSL (Ubuntu)

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# PostgreSQL (o usa: docker compose up -d)
sudo apt install -y postgresql postgresql-contrib && sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'tu_password_postgres';"
sudo -u postgres psql -c "CREATE DATABASE hotel_pms;"
psql -U postgres -h localhost -d hotel_pms -f database/schema.sql

# Variables de entorno
cp backend/.env.example backend/.env && nano backend/.env

# Dependencias y ejecución (backend :4000, frontend :5173)
npm install && npm run install:all
npm run usuario:password --prefix backend -- ana@casajaguar.mx 'Clave12345'
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con `ana@casajaguar.mx` (admin del hotel de ejemplo).
Comprobación rápida: `curl http://localhost:4000/api/health` → `{"status":"ok"}`.

Pruebas: `npm test`.

## 4. Endpoints

Todos exigen `Authorization: Bearer <token>` salvo `login` y `health`.

| Recurso | Método | Ruta | Rol |
|---|---|---|---|
| Auth | POST | `/api/auth/login` | público |
| Auth | GET | `/api/auth/perfil` | autenticado |
| Usuarios | GET · POST · PUT `/:id` · DELETE `/:id` | `/api/usuarios` | admin |
| Tipos | GET · POST · PUT `/:id` · DELETE `/:id` | `/api/tipos-habitacion` | lectura: todos · escritura: admin/gerente |
| Habitaciones | GET · POST · PUT `/:id` · DELETE `/:id` | `/api/habitaciones` | lectura: todos · escritura: admin/gerente |
| Habitaciones | PATCH | `/api/habitaciones/:id/estado` | autenticado |
| Disponibilidad | GET | `/api/disponibilidad?entrada=YYYY-MM-DD&salida=YYYY-MM-DD` | autenticado |
| Huéspedes | GET `?q=` · GET `/:id` · POST · PUT `/:id` | `/api/huespedes` | autenticado |
| Huéspedes | DELETE | `/api/huespedes/:id` | admin/gerente |
| Reservas | GET `?estado=&q=&desde=&hasta=` · GET `/:id` · POST | `/api/reservas` | autenticado |
| Reservas | PATCH | `/api/reservas/:id/estado` (`confirmada` · `cancelada` · `no_show`) | autenticado |
| Reservas | POST | `/api/reservas/:id/checkin` · `/checkout` (`{ forzar }`) | autenticado |
| Reservas | DELETE | `/api/reservas/:id` | admin |
| Pagos | GET · POST | `/api/reservas/:id/pagos` | autenticado |
| Dashboard | GET | `/api/dashboard/resumen` | autenticado |
| Estadísticas | GET | `/api/dashboard/estadisticas?granularidad=semana\|mes\|anio&desde=&hasta=` | **admin** |

Errores de negocio: `{ "error": "...", "codigo": "SOBREVENTA" }` con el HTTP correspondiente
(`409` sobreventa / habitación no disponible / transición inválida / saldo pendiente; `403` sin permiso; `404`; `400` validación).

## 5. Despliegue

Ver [`docs/DESPLIEGUE_UBUNTU.md`](docs/DESPLIEGUE_UBUNTU.md): PostgreSQL + API con systemd + Nginx (+ HTTPS), variante AWS EC2 + RDS, actualizaciones y respaldos.
