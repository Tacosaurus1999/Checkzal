-- =====================================================================
-- ÍNDICES OPCIONALES (no modifican schema.sql ni los datos). Seguros de repetir.
--   psql -U postgres -h localhost -d hotel_pms -f database/indices_opcionales.sql
-- =====================================================================

-- Reservas de un huésped (FK sin índice: borrar huéspedes y búsquedas por huésped recorrían toda la tabla)
CREATE INDEX IF NOT EXISTS idx_reservas_huesped ON reservas (huesped_id);

-- Estadísticas de ingresos: agrupan pagos por fecha
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos (fecha);

-- Panel y filtros: reservas por hotel y estado
CREATE INDEX IF NOT EXISTS idx_reservas_hotel_estado ON reservas (hotel_id, estado);

-- Búsqueda de texto (huéspedes y reservas, también la del bot de Telegram).
-- La expresión DEBE ser idéntica a TEXTO_HUESPED de backend/src/infrastructure/db/busqueda.js
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DROP INDEX IF EXISTS idx_huespedes_nombre_trgm;   -- versiones anteriores de este script
DROP INDEX IF EXISTS idx_huespedes_email_trgm;
CREATE INDEX IF NOT EXISTS idx_huespedes_busqueda_trgm ON huespedes USING gin (
  (translate(lower(nombre || ' ' || apellidos || ' ' || coalesce(email, '') || ' ' || coalesce(telefono, '') || ' ' || coalesce(numero_documento, '')),
             'áéíóúüñ', 'aeiouun')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservas_codigo_trgm ON reservas USING gin (codigo gin_trgm_ops);

ANALYZE huespedes;
ANALYZE reservas;
