-- =====================================================================
-- REPARAR SECUENCIAS Y DATOS DE HUÉSPEDES (seguro de repetir; no borra datos)
--
--   psql -U postgres -h localhost -d hotel_pms -f database/reparar_secuencias.sql
--
-- 1) Si registros se insertaron con id explícito (importaciones, restauraciones, scripts), el contador
--    automático (SERIAL) puede quedar por detrás del id más alto. Entonces TODA alta nueva falla con
--    "duplicate key value violates unique constraint ..._pkey". Aquí se reajusta cada contador.
-- 2) Huéspedes con tipo de documento pero sin número (datos de prueba antiguos): se limpia el tipo,
--    porque la aplicación exige indicar ambos o ninguno al editar.
-- =====================================================================

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT c.relname AS tabla, a.attname AS columna
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
         ORDER BY c.relname
    LOOP
        EXECUTE format(
            'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(%I), 0) + 1, false) FROM %I',
            'public.' || t.tabla, t.columna, t.columna, t.tabla);
        RAISE NOTICE 'Secuencia de %.% reajustada', t.tabla, t.columna;
    END LOOP;
END $$;

UPDATE huespedes SET tipo_documento = NULL WHERE tipo_documento IS NOT NULL AND numero_documento IS NULL;

-- Comprobación: la columna "siguiente_id" debe ser mayor que "mayor_id" en todas las filas
SELECT 'huespedes' AS tabla, (SELECT COALESCE(MAX(id), 0) FROM huespedes) AS mayor_id, nextval('huespedes_id_seq') AS siguiente_id
UNION ALL SELECT 'reservas', (SELECT COALESCE(MAX(id), 0) FROM reservas), nextval('reservas_id_seq')
UNION ALL SELECT 'pagos', (SELECT COALESCE(MAX(id), 0) FROM pagos), nextval('pagos_id_seq');
