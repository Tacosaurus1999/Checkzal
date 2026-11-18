-- =====================================================================
-- Proyecto 9. Sistema de gestión para hoteles boutique y posadas (PMS)
-- Base de datos: PostgreSQL 14+  (compatible con AWS RDS PostgreSQL)
-- Uso:  createdb hotel_pms && psql -d hotel_pms -f schema_hotel_pms.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- necesario para evitar sobreventas

-- ---------------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ---------------------------------------------------------------------
CREATE TYPE tipo_establecimiento AS ENUM ('boutique', 'posada');
CREATE TYPE rol_usuario          AS ENUM ('admin', 'recepcionista', 'gerente');
CREATE TYPE estado_habitacion    AS ENUM ('disponible', 'ocupada', 'limpieza', 'mantenimiento');
CREATE TYPE estado_reserva       AS ENUM ('pendiente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'no_show');
CREATE TYPE origen_reserva       AS ENUM ('directa', 'telefono', 'telegram', 'web', 'booking', 'airbnb', 'otro');
CREATE TYPE metodo_pago          AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'otro');
CREATE TYPE canal_notificacion   AS ENUM ('telegram', 'email', 'sms');
CREATE TYPE estado_notificacion  AS ENUM ('pendiente', 'enviada', 'fallida');

-- ---------------------------------------------------------------------
-- 1. HOTELES (permite manejar varias posadas / hoteles en el mismo sistema)
-- ---------------------------------------------------------------------
CREATE TABLE hoteles (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(120) NOT NULL,
    tipo          tipo_establecimiento NOT NULL DEFAULT 'boutique',
    ciudad        VARCHAR(80)  NOT NULL,            -- Tuxtla Gutiérrez, San Cristóbal...
    estado        VARCHAR(80)  NOT NULL DEFAULT 'Chiapas',
    direccion     VARCHAR(200),
    telefono      VARCHAR(20),
    email         VARCHAR(120),
    hora_checkin  TIME NOT NULL DEFAULT '15:00',
    hora_checkout TIME NOT NULL DEFAULT '12:00',
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. USUARIOS DEL SISTEMA (personal del hotel)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id               SERIAL PRIMARY KEY,
    hotel_id         INT NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    nombre           VARCHAR(120) NOT NULL,
    email            VARCHAR(120) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    rol              rol_usuario NOT NULL DEFAULT 'recepcionista',
    telegram_chat_id BIGINT,                         -- para alertas al personal
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. TIPOS DE HABITACIÓN
-- ---------------------------------------------------------------------
CREATE TABLE tipos_habitacion (
    id           SERIAL PRIMARY KEY,
    hotel_id     INT NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    nombre       VARCHAR(60) NOT NULL,               -- Sencilla, Doble, Suite...
    descripcion  TEXT,
    capacidad    SMALLINT NOT NULL CHECK (capacidad > 0),
    precio_base  NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0),
    UNIQUE (hotel_id, nombre)
);

-- ---------------------------------------------------------------------
-- 4. HABITACIONES
-- ---------------------------------------------------------------------
CREATE TABLE habitaciones (
    id                  SERIAL PRIMARY KEY,
    hotel_id            INT NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    tipo_habitacion_id  INT NOT NULL REFERENCES tipos_habitacion(id),
    numero              VARCHAR(10) NOT NULL,
    piso                SMALLINT DEFAULT 1,
    estado              estado_habitacion NOT NULL DEFAULT 'disponible',
    notas               TEXT,
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (hotel_id, numero)
);

-- ---------------------------------------------------------------------
-- 5. HUÉSPEDES (registro de huéspedes)
-- ---------------------------------------------------------------------
CREATE TABLE huespedes (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(80)  NOT NULL,
    apellidos         VARCHAR(100) NOT NULL,
    email             VARCHAR(120),
    telefono          VARCHAR(20),
    tipo_documento    VARCHAR(30),                   -- INE, pasaporte, licencia
    numero_documento  VARCHAR(50),
    nacionalidad      VARCHAR(60) DEFAULT 'Mexicana',
    fecha_nacimiento  DATE,
    telegram_chat_id  BIGINT,                        -- para confirmaciones por Bot
    notas             TEXT,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tipo_documento, numero_documento)
);
CREATE INDEX idx_huespedes_apellidos ON huespedes (apellidos, nombre);

-- ---------------------------------------------------------------------
-- 6. RESERVAS
-- ---------------------------------------------------------------------
CREATE TABLE reservas (
    id             SERIAL PRIMARY KEY,
    codigo         VARCHAR(12) NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
    hotel_id       INT NOT NULL REFERENCES hoteles(id),
    huesped_id     INT NOT NULL REFERENCES huespedes(id),
    usuario_id     INT REFERENCES usuarios(id),      -- quién la registró (NULL si fue automática)
    fecha_entrada  DATE NOT NULL,
    fecha_salida   DATE NOT NULL,
    num_adultos    SMALLINT NOT NULL DEFAULT 1 CHECK (num_adultos > 0),
    num_ninos      SMALLINT NOT NULL DEFAULT 0 CHECK (num_ninos >= 0),
    estado         estado_reserva NOT NULL DEFAULT 'pendiente',
    origen         origen_reserva NOT NULL DEFAULT 'directa',
    total          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    notas          TEXT,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (fecha_salida > fecha_entrada)
);
CREATE INDEX idx_reservas_fechas ON reservas (hotel_id, fecha_entrada, fecha_salida);
CREATE INDEX idx_reservas_estado ON reservas (estado);

-- ---------------------------------------------------------------------
-- 7. RESERVA_HABITACIONES (asignación de cuartos)
--    La restricción EXCLUDE impide a nivel de base de datos que una
--    habitación se asigne a dos reservas activas en fechas que se traslapan
--    => elimina las sobreventas.
-- ---------------------------------------------------------------------
CREATE TABLE reserva_habitaciones (
    id             SERIAL PRIMARY KEY,
    reserva_id     INT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    habitacion_id  INT NOT NULL REFERENCES habitaciones(id),
    fecha_entrada  DATE NOT NULL,
    fecha_salida   DATE NOT NULL,
    precio_noche   NUMERIC(10,2) NOT NULL CHECK (precio_noche >= 0),
    activa         BOOLEAN NOT NULL DEFAULT TRUE,    -- FALSE si se cancela la reserva
    CHECK (fecha_salida > fecha_entrada),
    CONSTRAINT sin_sobreventa EXCLUDE USING gist (
        habitacion_id WITH =,
        daterange(fecha_entrada, fecha_salida, '[)') WITH &&
    ) WHERE (activa)
);
CREATE INDEX idx_rh_reserva ON reserva_habitaciones (reserva_id);

-- ---------------------------------------------------------------------
-- 8. ESTANCIAS (check-in / check-out reales)
-- ---------------------------------------------------------------------
CREATE TABLE estancias (
    id                       SERIAL PRIMARY KEY,
    reserva_habitacion_id    INT NOT NULL UNIQUE REFERENCES reserva_habitaciones(id),
    checkin_real             TIMESTAMPTZ NOT NULL DEFAULT now(),
    checkout_real            TIMESTAMPTZ,
    usuario_checkin_id       INT REFERENCES usuarios(id),
    usuario_checkout_id      INT REFERENCES usuarios(id),
    observaciones            TEXT,
    CHECK (checkout_real IS NULL OR checkout_real > checkin_real)
);

-- ---------------------------------------------------------------------
-- 9. HUÉSPEDES ACOMPAÑANTES (varios huéspedes por habitación)
-- ---------------------------------------------------------------------
CREATE TABLE estancia_huespedes (
    estancia_id  INT NOT NULL REFERENCES estancias(id) ON DELETE CASCADE,
    huesped_id   INT NOT NULL REFERENCES huespedes(id),
    PRIMARY KEY (estancia_id, huesped_id)
);

-- ---------------------------------------------------------------------
-- 10. SERVICIOS EXTRA Y CONSUMOS
-- ---------------------------------------------------------------------
CREATE TABLE servicios (
    id       SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hoteles(id) ON DELETE CASCADE,
    nombre   VARCHAR(80) NOT NULL,                   -- desayuno, lavandería, tour...
    precio   NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    activo   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (hotel_id, nombre)
);

CREATE TABLE consumos (
    id          SERIAL PRIMARY KEY,
    reserva_id  INT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    servicio_id INT NOT NULL REFERENCES servicios(id),
    cantidad    SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unit NUMERIC(10,2) NOT NULL CHECK (precio_unit >= 0),
    fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 11. PAGOS
-- ---------------------------------------------------------------------
CREATE TABLE pagos (
    id          SERIAL PRIMARY KEY,
    reserva_id  INT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    usuario_id  INT REFERENCES usuarios(id),
    monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    metodo      metodo_pago NOT NULL,
    referencia  VARCHAR(80),
    fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pagos_reserva ON pagos (reserva_id);

-- ---------------------------------------------------------------------
-- 12. NOTIFICACIONES (n8n / Node-RED / Telegram Bot)
-- ---------------------------------------------------------------------
CREATE TABLE notificaciones (
    id          SERIAL PRIMARY KEY,
    reserva_id  INT REFERENCES reservas(id) ON DELETE SET NULL,
    huesped_id  INT REFERENCES huespedes(id) ON DELETE SET NULL,
    usuario_id  INT REFERENCES usuarios(id) ON DELETE SET NULL,
    canal       canal_notificacion NOT NULL DEFAULT 'telegram',
    tipo        VARCHAR(40) NOT NULL,                -- confirmacion, recordatorio, checkout, alerta_ocupacion
    mensaje     TEXT NOT NULL,
    estado      estado_notificacion NOT NULL DEFAULT 'pendiente',
    creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviada_en  TIMESTAMPTZ
);
CREATE INDEX idx_notif_pendientes ON notificaciones (estado) WHERE estado = 'pendiente';

-- ---------------------------------------------------------------------
-- 13. BLOQUEOS DE HABITACIÓN (mantenimiento, uso del propietario)
-- ---------------------------------------------------------------------
CREATE TABLE bloqueos_habitacion (
    id             SERIAL PRIMARY KEY,
    habitacion_id  INT NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
    fecha_inicio   DATE NOT NULL,
    fecha_fin      DATE NOT NULL,
    motivo         VARCHAR(200),
    CHECK (fecha_fin > fecha_inicio),
    CONSTRAINT sin_bloqueo_traslapado EXCLUDE USING gist (
        habitacion_id WITH =,
        daterange(fecha_inicio, fecha_fin, '[)') WITH &&
    )
);

-- =====================================================================
-- TRIGGER: actualizar "actualizado_en" en reservas
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_actualizado_en() RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservas_actualizado
BEFORE UPDATE ON reservas
FOR EACH ROW EXECUTE FUNCTION fn_actualizado_en();

-- TRIGGER: al cancelar una reserva se liberan sus habitaciones
CREATE OR REPLACE FUNCTION fn_liberar_habitaciones() RETURNS trigger AS $$
BEGIN
    IF NEW.estado IN ('cancelada', 'no_show') AND OLD.estado NOT IN ('cancelada', 'no_show') THEN
        UPDATE reserva_habitaciones SET activa = FALSE WHERE reserva_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reserva_cancelada
AFTER UPDATE OF estado ON reservas
FOR EACH ROW EXECUTE FUNCTION fn_liberar_habitaciones();

-- =====================================================================
-- FUNCIÓN: habitaciones disponibles en un rango de fechas
--   SELECT * FROM habitaciones_disponibles(1, '2026-12-20', '2026-12-24');
-- =====================================================================
CREATE OR REPLACE FUNCTION habitaciones_disponibles(p_hotel INT, p_entrada DATE, p_salida DATE)
RETURNS TABLE (habitacion_id INT, numero VARCHAR, tipo VARCHAR, capacidad SMALLINT, precio_base NUMERIC) AS $$
    SELECT h.id, h.numero, t.nombre, t.capacidad, t.precio_base
    FROM habitaciones h
    JOIN tipos_habitacion t ON t.id = h.tipo_habitacion_id
    WHERE h.hotel_id = p_hotel
      AND h.activa
      AND NOT EXISTS (
            SELECT 1 FROM reserva_habitaciones rh
            WHERE rh.habitacion_id = h.id AND rh.activa
              AND daterange(rh.fecha_entrada, rh.fecha_salida, '[)') && daterange(p_entrada, p_salida, '[)'))
      AND NOT EXISTS (
            SELECT 1 FROM bloqueos_habitacion b
            WHERE b.habitacion_id = h.id
              AND daterange(b.fecha_inicio, b.fecha_fin, '[)') && daterange(p_entrada, p_salida, '[)'))
    ORDER BY h.numero;
$$ LANGUAGE sql STABLE;

-- =====================================================================
-- VISTAS
-- =====================================================================
-- Ocupación de hoy por hotel (control de ocupación)
CREATE OR REPLACE VIEW v_ocupacion_hoy AS
SELECT ho.id AS hotel_id,
       ho.nombre AS hotel,
       COUNT(h.id) AS total_habitaciones,
       COUNT(rh.id) AS ocupadas,
       ROUND(100.0 * COUNT(rh.id) / NULLIF(COUNT(h.id), 0), 1) AS porcentaje_ocupacion
FROM hoteles ho
JOIN habitaciones h ON h.hotel_id = ho.id AND h.activa
LEFT JOIN reserva_habitaciones rh
       ON rh.habitacion_id = h.id AND rh.activa
      AND CURRENT_DATE >= rh.fecha_entrada AND CURRENT_DATE < rh.fecha_salida
GROUP BY ho.id, ho.nombre;

-- Saldo pendiente por reserva
CREATE OR REPLACE VIEW v_saldo_reservas AS
SELECT r.id AS reserva_id, r.codigo, r.hotel_id,
       r.total + COALESCE(c.total_consumos, 0) AS total_a_pagar,
       COALESCE(p.total_pagado, 0)             AS total_pagado,
       r.total + COALESCE(c.total_consumos, 0) - COALESCE(p.total_pagado, 0) AS saldo
FROM reservas r
LEFT JOIN (SELECT reserva_id, SUM(cantidad * precio_unit) AS total_consumos FROM consumos GROUP BY reserva_id) c ON c.reserva_id = r.id
LEFT JOIN (SELECT reserva_id, SUM(monto) AS total_pagado FROM pagos GROUP BY reserva_id) p ON p.reserva_id = r.id;

-- Llegadas y salidas de hoy (útil para el Bot de Telegram)
CREATE OR REPLACE VIEW v_movimientos_hoy AS
SELECT r.hotel_id, r.codigo, hu.nombre || ' ' || hu.apellidos AS huesped,
       h.numero AS habitacion, rh.fecha_entrada, rh.fecha_salida,
       CASE WHEN rh.fecha_entrada = CURRENT_DATE THEN 'llegada' ELSE 'salida' END AS movimiento
FROM reserva_habitaciones rh
JOIN reservas r    ON r.id = rh.reserva_id
JOIN huespedes hu  ON hu.id = r.huesped_id
JOIN habitaciones h ON h.id = rh.habitacion_id
WHERE rh.activa AND (rh.fecha_entrada = CURRENT_DATE OR rh.fecha_salida = CURRENT_DATE);

-- =====================================================================
-- DATOS DE EJEMPLO
-- =====================================================================
INSERT INTO hoteles (nombre, tipo, ciudad, direccion, telefono, email) VALUES
('Hotel Boutique Casa Jaguar', 'boutique', 'San Cristóbal de las Casas', 'Real de Guadalupe 45', '9671234567', 'info@casajaguar.mx'),
('Posada Los Laureles',        'posada',   'Tuxtla Gutiérrez',          'Av. Central 120',       '9617654321', 'hola@loslaureles.mx');

INSERT INTO usuarios (hotel_id, nombre, email, password_hash, rol) VALUES
(1, 'Ana Morales',  'ana@casajaguar.mx',   '$2b$10$hash_de_ejemplo_1', 'admin'),
(2, 'Luis Pérez',   'luis@loslaureles.mx', '$2b$10$hash_de_ejemplo_2', 'recepcionista');

INSERT INTO tipos_habitacion (hotel_id, nombre, descripcion, capacidad, precio_base) VALUES
(1, 'Sencilla', 'Cama matrimonial, baño privado', 2, 850.00),
(1, 'Suite',    'Suite con terraza y chimenea',    4, 1800.00),
(2, 'Doble',    'Dos camas individuales',          2, 650.00);

INSERT INTO habitaciones (hotel_id, tipo_habitacion_id, numero, piso) VALUES
(1, 1, '101', 1), (1, 1, '102', 1), (1, 2, '201', 2),
(2, 3, '1', 1),   (2, 3, '2', 1);

INSERT INTO huespedes (nombre, apellidos, email, telefono, tipo_documento, numero_documento) VALUES
('María', 'López Hernández', 'maria@correo.com', '9611112233', 'INE', 'LOHM900101MCSPRR09');

INSERT INTO reservas (hotel_id, huesped_id, usuario_id, fecha_entrada, fecha_salida, num_adultos, estado, origen, total)
VALUES (1, 1, 1, '2026-12-20', '2026-12-23', 2, 'confirmada', 'telegram', 2550.00);

INSERT INTO reserva_habitaciones (reserva_id, habitacion_id, fecha_entrada, fecha_salida, precio_noche)
VALUES (1, 1, '2026-12-20', '2026-12-23', 850.00);

-- Prueba de sobreventa: esta inserción debe FALLAR por la restricción "sin_sobreventa"
-- INSERT INTO reserva_habitaciones (reserva_id, habitacion_id, fecha_entrada, fecha_salida, precio_noche)
-- VALUES (1, 1, '2026-12-21', '2026-12-24', 850.00);