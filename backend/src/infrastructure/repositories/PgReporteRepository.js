'use strict';

const { ReporteRepositoryPort } = require('../../application/ports/repositories');

class PgReporteRepository extends ReporteRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  /** Vista v_ocupacion_hoy (COUNT devuelve bigint como texto → se convierte a número). */
  async ocupacionHoy(hotelId) {
    const { rows } = await this.pool.query('SELECT * FROM v_ocupacion_hoy WHERE hotel_id = $1', [hotelId]);
    const fila = rows[0];
    if (!fila) {
      return { hotelId, hotel: null, totalHabitaciones: 0, ocupadas: 0, porcentajeOcupacion: 0 };
    }
    return {
      hotelId: fila.hotel_id,
      hotel: fila.hotel,
      totalHabitaciones: Number(fila.total_habitaciones),
      ocupadas: Number(fila.ocupadas),
      porcentajeOcupacion: Number(fila.porcentaje_ocupacion || 0),
    };
  }

  /** Vista v_movimientos_hoy: llegadas y salidas del día. */
  async movimientosHoy(hotelId) {
    // El JOIN con reservas (codigo es UNIQUE) aporta el id para abrir el detalle desde el panel.
    const { rows } = await this.pool.query(
      `SELECT m.hotel_id, r.id AS reserva_id, m.codigo, m.huesped, m.habitacion,
              m.fecha_entrada, m.fecha_salida, m.movimiento
         FROM v_movimientos_hoy m
         JOIN reservas r ON r.codigo = m.codigo
        WHERE m.hotel_id = $1
        ORDER BY m.movimiento, length(m.habitacion), m.habitacion`,
      [hotelId]
    );
    return rows.map((fila) => ({
      reservaId: fila.reserva_id,
      codigo: fila.codigo,
      huesped: fila.huesped,
      habitacion: fila.habitacion,
      fechaEntrada: fila.fecha_entrada,
      fechaSalida: fila.fecha_salida,
      movimiento: fila.movimiento,
    }));
  }

  /**
   * Una fila por periodo (semana/mes/año), incluso los vacíos.
   *  - Las reservas se agrupan por fecha de ENTRADA (cohorte): de las reservas que caen en el periodo,
   *    cuántas llegaron (checkin/checkout), cuántas se cancelaron, no_show o siguen por llegar.
   *  - Los ingresos son pagos RECIBIDOS (tabla pagos) agrupados por la fecha del pago.
   */
  async estadisticas(hotelId, { unidad, desde, hasta }) {
    const zona = process.env.TZ_NEGOCIO || 'America/Mexico_City';
    const { rows } = await this.pool.query(
      `WITH periodos AS (
         SELECT generate_series(date_trunc($2::text, $3::date::timestamp),
                                date_trunc($2::text, $4::date::timestamp),
                                ('1 ' || $2::text)::interval)::date AS periodo
       ),
       res AS (
         SELECT date_trunc($2::text, r.fecha_entrada::timestamp)::date AS periodo,
                COUNT(*)                                              AS reservas,
                COUNT(DISTINCT r.huesped_id)                          AS huespedes,
                COALESCE(SUM(r.num_adultos + r.num_ninos), 0)         AS personas,
                COUNT(*) FILTER (WHERE r.estado IN ('checkin', 'checkout'))   AS llegaron,
                COUNT(*) FILTER (WHERE r.estado = 'cancelada')                AS canceladas,
                COUNT(*) FILTER (WHERE r.estado = 'no_show')                  AS no_show,
                COUNT(*) FILTER (WHERE r.estado IN ('pendiente', 'confirmada')) AS por_llegar,
                COALESCE(SUM(r.total) FILTER (WHERE r.estado NOT IN ('cancelada', 'no_show')), 0) AS reservado
           FROM reservas r
          WHERE r.hotel_id = $1 AND r.fecha_entrada BETWEEN $3::date AND $4::date
          GROUP BY 1
       ),
       cobros AS (
         SELECT date_trunc($2::text, (p.fecha AT TIME ZONE $5)::date::timestamp)::date AS periodo,
                SUM(p.monto) AS ingresos
           FROM pagos p
           JOIN reservas r ON r.id = p.reserva_id
          WHERE r.hotel_id = $1
            AND (p.fecha AT TIME ZONE $5)::date BETWEEN $3::date AND $4::date
          GROUP BY 1
       )
       SELECT to_char(pe.periodo, 'YYYY-MM-DD') AS periodo,
              COALESCE(res.reservas, 0)    AS reservas,
              COALESCE(res.huespedes, 0)   AS huespedes,
              COALESCE(res.personas, 0)    AS personas,
              COALESCE(res.llegaron, 0)    AS llegaron,
              COALESCE(res.canceladas, 0)  AS canceladas,
              COALESCE(res.no_show, 0)     AS no_show,
              COALESCE(res.por_llegar, 0)  AS por_llegar,
              COALESCE(res.reservado, 0)   AS reservado,
              COALESCE(cobros.ingresos, 0) AS ingresos
         FROM periodos pe
         LEFT JOIN res    ON res.periodo = pe.periodo
         LEFT JOIN cobros ON cobros.periodo = pe.periodo
        ORDER BY pe.periodo`,
      [hotelId, unidad, desde, hasta, zona]
    );
    return rows.map((f) => ({
      periodo: f.periodo,
      reservas: Number(f.reservas),
      huespedes: Number(f.huespedes),
      personas: Number(f.personas),
      llegaron: Number(f.llegaron),
      canceladas: Number(f.canceladas),
      noShow: Number(f.no_show),
      porLlegar: Number(f.por_llegar),
      reservado: Number(f.reservado),
      ingresos: Number(f.ingresos),
    }));
  }
}

module.exports = { PgReporteRepository };
