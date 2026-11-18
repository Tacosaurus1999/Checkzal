-- =====================================================================
-- DATOS DE PRUEBA para la pantalla de Estadísticas (Hotel Casa Jaguar, hotel_id = 1)
-- No modifica el esquema: solo inserta huéspedes, reservas, asignaciones, estancias y pagos.
-- Todo lo creado queda marcado con notas = 'DEMO' para poder borrarlo (ver la sección final).
--
--   Cargar:   psql -U postgres -h localhost -d hotel_pms -f database/datos_demo_estadisticas.sql
-- =====================================================================

DO $$
DECLARE
    v_hotel      CONSTANT INT  := 1;
    v_usuario    INT;
    v_inicio     CONSTANT DATE := DATE '2025-01-01';
    v_fin        CONSTANT DATE := DATE '2027-02-28';
    v_hoy        CONSTANT DATE := CURRENT_DATE;
    v_hab        RECORD;
    v_huespedes  INT[];
    v_cursor     DATE;
    v_noches     INT;
    v_salida     DATE;
    v_hue        INT;
    v_adultos    INT;
    v_ninos      INT;
    v_total      NUMERIC;
    v_estado     estado_reserva;
    v_origen     origen_reserva;
    v_r          DOUBLE PRECISION;
    v_creada     DATE;
    v_reserva    INT;
    v_rh         INT;
    v_anticipo   NUMERIC;
    v_metodos    metodo_pago[] := ARRAY['efectivo','tarjeta','transferencia','deposito']::metodo_pago[];
    v_origenes   origen_reserva[] := ARRAY['directa','telefono','telegram','web','booking','airbnb']::origen_reserva[];
    v_gap_max    INT;
BEGIN
    IF EXISTS (SELECT 1 FROM reservas WHERE notas = 'DEMO') THEN
        RAISE NOTICE 'Los datos DEMO ya existen: no se insertó nada (borra primero con la sección final).';
        RETURN;
    END IF;

    SELECT id INTO v_usuario FROM usuarios WHERE hotel_id = v_hotel AND rol = 'admin' ORDER BY id LIMIT 1;
    PERFORM setseed(0.42);  -- resultados repetibles

    -- ---------------- Huéspedes ----------------
    WITH nuevos AS (
        INSERT INTO huespedes (nombre, apellidos, email, telefono, tipo_documento, nacionalidad, notas)
        SELECT n, a, lower(translate(n || '.' || split_part(a, ' ', 1), 'áéíóúñ ', 'aeioun')) || '@correo.com',
               '96' || lpad((10000000 + (random() * 89999999)::INT)::TEXT, 8, '0'), NULL,
               CASE WHEN random() < 0.85 THEN 'Mexicana' ELSE (ARRAY['Estadounidense','Francesa','Alemana','Española','Canadiense'])[1 + (random()*4)::INT] END,
               'DEMO'
        FROM unnest(
            ARRAY['Juan','Sofía','Carlos','Valeria','Miguel','Fernanda','Luis','Daniela','Jorge','Paola',
                  'Ricardo','Mariana','Andrés','Camila','Héctor','Lucía','Diego','Ximena','Pablo','Renata',
                  'Emilio','Isabel','Sergio','Natalia','Tomás','Regina','Adrián','Elena','Raúl','Montserrat'],
            ARRAY['Pérez Ruiz','Gómez Díaz','Martínez Cruz','Hernández Vega','Ramírez Soto','Torres Luna','Flores Mena','Morales Ríos',
                  'Ortiz Salas','Castillo Paz','Jiménez Rojas','Vargas León','Reyes Ibarra','Mendoza Aguilar','Silva Cano',
                  'Navarro Pineda','Cabrera Solís','Domínguez Vera','Aguirre Lara','Guzmán Peña',
                  'Estrada Mora','Santiago Cruz','Cortés Meza','Ávila Ponce','Rangel Nava','Campos Ochoa','Salazar Bravo','Medina Toledo','Ruiz Cordero','Lozano Arce']
        ) AS t(n, a)
        RETURNING id
    )
    SELECT array_agg(id) INTO v_huespedes FROM nuevos;

    -- ---------------- Reservas por habitación (sin traslapes) ----------------
    FOR v_hab IN
        SELECT h.id, h.numero, t.precio_base, t.capacidad
          FROM habitaciones h JOIN tipos_habitacion t ON t.id = h.tipo_habitacion_id
         WHERE h.hotel_id = v_hotel AND h.activa
         ORDER BY h.id
    LOOP
        v_cursor := v_inicio + (random() * 3)::INT;
        WHILE v_cursor < v_fin LOOP
            v_noches := 1 + (random() * 3)::INT;          -- 1 a 4 noches
            v_salida := v_cursor + v_noches;

            -- No chocar con reservas activas que ya existan (p. ej. la de ejemplo del esquema)
            IF EXISTS (
                SELECT 1 FROM reserva_habitaciones rh
                 WHERE rh.habitacion_id = v_hab.id AND rh.activa
                   AND daterange(rh.fecha_entrada, rh.fecha_salida, '[)') && daterange(v_cursor, v_salida, '[)')
            ) THEN
                v_cursor := v_salida;
                CONTINUE;
            END IF;

            -- Estado según el momento de la estancia
            v_r := random();
            IF v_salida <= v_hoy THEN                       -- ya terminó
                v_estado := CASE WHEN v_r < 0.78 THEN 'checkout' WHEN v_r < 0.91 THEN 'cancelada' ELSE 'no_show' END;
            ELSIF v_cursor <= v_hoy THEN                    -- en curso hoy
                v_estado := CASE WHEN v_r < 0.90 THEN 'checkin' ELSE 'cancelada' END;
            ELSE                                            -- futura
                v_estado := CASE WHEN v_r < 0.65 THEN 'confirmada' WHEN v_r < 0.90 THEN 'pendiente' ELSE 'cancelada' END;
            END IF;

            v_hue     := v_huespedes[1 + (random() * (array_length(v_huespedes, 1) - 1))::INT];
            v_adultos := LEAST(v_hab.capacidad, 1 + (random() * 1)::INT);
            v_ninos   := CASE WHEN v_hab.capacidad >= 4 AND random() < 0.35 THEN 1 + (random() * 1)::INT ELSE 0 END;
            v_origen  := v_origenes[1 + (random() * (array_length(v_origenes, 1) - 1))::INT];
            v_total   := v_noches * v_hab.precio_base;
            v_creada  := GREATEST(v_inicio - 30, v_cursor - (2 + (random() * 28)::INT));

            INSERT INTO reservas (hotel_id, huesped_id, usuario_id, fecha_entrada, fecha_salida,
                                  num_adultos, num_ninos, estado, origen, total, notas, creado_en, actualizado_en)
            VALUES (v_hotel, v_hue, v_usuario, v_cursor, v_salida, v_adultos, v_ninos, v_estado, v_origen,
                    v_total, 'DEMO', v_creada::TIMESTAMPTZ + TIME '10:00', v_creada::TIMESTAMPTZ + TIME '10:00')
            RETURNING id INTO v_reserva;

            INSERT INTO reserva_habitaciones (reserva_id, habitacion_id, fecha_entrada, fecha_salida, precio_noche, activa)
            VALUES (v_reserva, v_hab.id, v_cursor, v_salida, v_hab.precio_base,
                    v_estado NOT IN ('cancelada', 'no_show'))
            RETURNING id INTO v_rh;

            -- Estancia real (check-in / check-out)
            IF v_estado IN ('checkin', 'checkout') THEN
                INSERT INTO estancias (reserva_habitacion_id, checkin_real, checkout_real, usuario_checkin_id, usuario_checkout_id)
                VALUES (v_rh, v_cursor::TIMESTAMPTZ + TIME '15:00',
                        CASE WHEN v_estado = 'checkout' THEN v_salida::TIMESTAMPTZ + TIME '11:30' END,
                        v_usuario, CASE WHEN v_estado = 'checkout' THEN v_usuario END);
            END IF;

            -- Pagos
            IF v_estado = 'checkout' THEN
                v_anticipo := round(v_total * 0.5, 2);
                INSERT INTO pagos (reserva_id, usuario_id, monto, metodo, referencia, fecha)
                VALUES (v_reserva, v_usuario, v_anticipo, v_metodos[1 + (random()*3)::INT], 'Anticipo', v_creada::TIMESTAMPTZ + TIME '10:30'),
                       (v_reserva, v_usuario, v_total - v_anticipo, v_metodos[1 + (random()*3)::INT], 'Liquidación', v_salida::TIMESTAMPTZ + TIME '11:00');
            ELSIF v_estado = 'checkin' THEN
                INSERT INTO pagos (reserva_id, usuario_id, monto, metodo, referencia, fecha)
                VALUES (v_reserva, v_usuario, round(v_total * 0.5, 2), v_metodos[1 + (random()*3)::INT], 'Anticipo', v_creada::TIMESTAMPTZ + TIME '10:30');
            ELSIF v_estado = 'confirmada' THEN
                INSERT INTO pagos (reserva_id, usuario_id, monto, metodo, referencia, fecha)
                VALUES (v_reserva, v_usuario, round(v_total * 0.3, 2), v_metodos[1 + (random()*3)::INT], 'Anticipo',
                        LEAST(v_creada::TIMESTAMPTZ + TIME '10:30', now()));
            ELSIF v_estado IN ('cancelada', 'no_show') AND random() < 0.4 THEN
                INSERT INTO pagos (reserva_id, usuario_id, monto, metodo, referencia, fecha)
                VALUES (v_reserva, v_usuario, round(v_total * 0.2, 2), v_metodos[1 + (random()*3)::INT], 'Depósito no reembolsable',
                        LEAST(v_creada::TIMESTAMPTZ + TIME '10:30', now()));
            END IF;

            -- Hueco hasta la siguiente reserva: más ocupación en jul-ago y dic; menos en ene-feb y sep-oct; 2025 más flojo
            v_gap_max := CASE WHEN EXTRACT(MONTH FROM v_salida) IN (7, 8, 12) THEN 2
                              WHEN EXTRACT(MONTH FROM v_salida) IN (1, 2, 9, 10) THEN 8
                              ELSE 5 END
                         + CASE WHEN EXTRACT(YEAR FROM v_salida) = 2025 THEN 3 ELSE 0 END;
            v_cursor := v_salida + (random() * v_gap_max)::INT;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Datos DEMO insertados: % reservas.', (SELECT count(*) FROM reservas WHERE notas = 'DEMO');
END $$;

-- Resumen de lo cargado
SELECT to_char(date_trunc('month', fecha_entrada), 'YYYY-MM') AS mes,
       count(*)                                              AS reservas,
       count(*) FILTER (WHERE estado IN ('checkin','checkout')) AS llegaron,
       count(*) FILTER (WHERE estado = 'cancelada')          AS canceladas,
       count(*) FILTER (WHERE estado = 'no_show')            AS no_show
  FROM reservas WHERE notas = 'DEMO' GROUP BY 1 ORDER BY 1;

-- =====================================================================
-- BORRAR LOS DATOS DEMO (ejecutar solo cuando ya no los quieras)
-- =====================================================================
-- BEGIN;
--   DELETE FROM estancias WHERE reserva_habitacion_id IN
--     (SELECT rh.id FROM reserva_habitaciones rh JOIN reservas r ON r.id = rh.reserva_id WHERE r.notas = 'DEMO');
--   DELETE FROM reservas  WHERE notas = 'DEMO';   -- elimina también sus asignaciones y pagos (ON DELETE CASCADE)
--   DELETE FROM huespedes WHERE notas = 'DEMO';
-- COMMIT;
