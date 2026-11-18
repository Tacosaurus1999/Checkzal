'use strict';

const { ReservaRepositoryPort } = require('../../application/ports/repositories');
const { Reserva, ReservaHabitacion } = require('../../domain/entities/Reserva');
const { TEXTO_HUESPED, terminosBusqueda, patronLike } = require('../db/busqueda');
const { traducirErrorPg } = require('../db/pgErrors');

const SELECT_RESERVA = `
  SELECT r.*,
         hu.nombre || ' ' || hu.apellidos AS huesped_nombre,
         hu.telefono                      AS huesped_telefono,
         hu.email                         AS huesped_email,
         s.total_a_pagar, s.total_pagado, s.saldo
    FROM reservas r
    JOIN huespedes hu        ON hu.id = r.huesped_id
    JOIN v_saldo_reservas s  ON s.reserva_id = r.id`;

const ERR_SOBREVENTA = {
  '23P01': {
    mensaje: 'Una de las habitaciones ya fue reservada en fechas que se traslapan (sobreventa evitada).',
    codigo: 'SOBREVENTA',
  },
  '23503': {
    mensaje: 'Referencia inválida: revisa el hotel, el huésped, el usuario o las habitaciones.',
    codigo: 'REFERENCIA_INVALIDA',
  },
};

function filaAReserva(fila, lineas) {
  return new Reserva({
    id: fila.id,
    codigo: fila.codigo,
    hotelId: fila.hotel_id,
    huespedId: fila.huesped_id,
    huespedNombre: fila.huesped_nombre,
    huespedTelefono: fila.huesped_telefono,
    huespedEmail: fila.huesped_email,
    usuarioId: fila.usuario_id,
    fechaEntrada: fila.fecha_entrada,
    fechaSalida: fila.fecha_salida,
    numAdultos: fila.num_adultos,
    numNinos: fila.num_ninos,
    estado: fila.estado,
    origen: fila.origen,
    total: fila.total,
    totalAPagar: fila.total_a_pagar,
    totalPagado: fila.total_pagado,
    saldo: fila.saldo,
    notas: fila.notas,
    habitaciones: lineas,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  });
}

function filaALinea(fila) {
  return new ReservaHabitacion({
    id: fila.id,
    habitacionId: fila.habitacion_id,
    numero: fila.numero,
    tipo: fila.tipo,
    precioNoche: fila.precio_noche,
    activa: fila.activa,
  });
}

class PgReservaRepository extends ReservaRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  /**
   * Inserta reserva + reserva_habitaciones de forma atómica (BEGIN/COMMIT/ROLLBACK).
   * La restricción EXCLUDE `sin_sobreventa` es la última defensa contra reservas simultáneas.
   */
  async crear(reserva) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const { rows } = await cliente.query(
        `INSERT INTO reservas
           (hotel_id, huesped_id, usuario_id, fecha_entrada, fecha_salida,
            num_adultos, num_ninos, estado, origen, total, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          reserva.hotelId,
          reserva.huespedId,
          reserva.usuarioId,
          reserva.fechaEntrada,
          reserva.fechaSalida,
          reserva.numAdultos,
          reserva.numNinos,
          reserva.estado,
          reserva.origen,
          reserva.calcularTotal(),
          reserva.notas,
        ]
      );
      const reservaId = rows[0].id;

      for (const linea of reserva.habitaciones) {
        await cliente.query(
          `INSERT INTO reserva_habitaciones
             (reserva_id, habitacion_id, fecha_entrada, fecha_salida, precio_noche)
           VALUES ($1,$2,$3,$4,$5)`,
          [reservaId, linea.habitacionId, reserva.fechaEntrada, reserva.fechaSalida, linea.precioNoche]
        );
      }

      await cliente.query('COMMIT');
      return this.buscarPorId(reservaId, reserva.hotelId);
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => {});
      return traducirErrorPg(error, ERR_SOBREVENTA);
    } finally {
      cliente.release();
    }
  }

  async listar(hotelId, { estado, desde, hasta, q } = {}) {
    const condiciones = ['r.hotel_id = $1'];
    const valores = [hotelId];

    if (estado) {
      valores.push(estado);
      condiciones.push(`r.estado = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`r.fecha_salida >= $${valores.length}::date`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`r.fecha_entrada <= $${valores.length}::date`);
    }
    if (q) {
      const texto = String(q).trim();
      if (/^[0-9a-f]{8}$/i.test(texto)) {
        // Código completo (lo que usa el bot): igualdad exacta sobre el índice UNIQUE de reservas.codigo
        valores.push(texto.toUpperCase());
        condiciones.push(`r.codigo = $${valores.length}`);
      } else {
        // Palabras en cualquier orden: cada una debe aparecer en el código o en los datos del huésped
        for (const termino of terminosBusqueda(texto)) {
          valores.push(patronLike(termino));
          const n = valores.length;
          condiciones.push(
            `(r.codigo ILIKE $${n} OR r.huesped_id IN (SELECT id FROM huespedes WHERE ${TEXTO_HUESPED} LIKE $${n}))`
          );
        }
      }
    }

    const { rows } = await this.pool.query(
      `${SELECT_RESERVA}
        WHERE ${condiciones.join(' AND ')}
        ORDER BY r.fecha_entrada DESC, r.id DESC
        LIMIT 300`,
      valores
    );
    return this._hidratar(rows);
  }

  async buscarPorId(id, hotelId) {
    const { rows } = await this.pool.query(`${SELECT_RESERVA} WHERE r.id = $1 AND r.hotel_id = $2 LIMIT 1`, [
      id,
      hotelId,
    ]);
    if (!rows[0]) return null;
    const [reserva] = await this._hidratar(rows);
    return reserva;
  }

  async actualizarEstado(id, hotelId, estado) {
    // El trigger trg_reserva_cancelada libera las habitaciones al cancelar / no_show.
    await this.pool.query('UPDATE reservas SET estado = $1 WHERE id = $2 AND hotel_id = $3', [estado, id, hotelId]);
    return this.buscarPorId(id, hotelId);
  }

  async registrarCheckin(id, hotelId, usuarioId) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`UPDATE reservas SET estado = 'checkin' WHERE id = $1 AND hotel_id = $2`, [id, hotelId]);
      await cliente.query(
        `INSERT INTO estancias (reserva_habitacion_id, usuario_checkin_id)
         SELECT rh.id, $2 FROM reserva_habitaciones rh WHERE rh.reserva_id = $1 AND rh.activa
         ON CONFLICT (reserva_habitacion_id) DO NOTHING`,
        [id, usuarioId]
      );
      await cliente.query(
        `UPDATE habitaciones SET estado = 'ocupada'
          WHERE id IN (SELECT habitacion_id FROM reserva_habitaciones WHERE reserva_id = $1 AND activa)`,
        [id]
      );
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarPorId(id, hotelId);
  }

  async registrarCheckout(id, hotelId, usuarioId) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`UPDATE reservas SET estado = 'checkout' WHERE id = $1 AND hotel_id = $2`, [id, hotelId]);
      await cliente.query(
        `UPDATE estancias SET checkout_real = now(), usuario_checkout_id = $2
          WHERE checkout_real IS NULL
            AND reserva_habitacion_id IN (SELECT id FROM reserva_habitaciones WHERE reserva_id = $1)`,
        [id, usuarioId]
      );
      await cliente.query(
        `UPDATE habitaciones SET estado = 'limpieza'
          WHERE id IN (SELECT habitacion_id FROM reserva_habitaciones WHERE reserva_id = $1 AND activa)`,
        [id]
      );
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarPorId(id, hotelId);
  }

  async eliminar(id, hotelId) {
    await this.pool.query('DELETE FROM reservas WHERE id = $1 AND hotel_id = $2', [id, hotelId]);
  }

  /** Carga las habitaciones de TODAS las reservas con una sola consulta (sin N+1). */
  async _hidratar(filasReserva) {
    if (filasReserva.length === 0) return [];

    const ids = filasReserva.map((f) => f.id);
    const { rows: filasLineas } = await this.pool.query(
      `SELECT rh.*, h.numero, t.nombre AS tipo
         FROM reserva_habitaciones rh
         JOIN habitaciones h       ON h.id = rh.habitacion_id
         JOIN tipos_habitacion t   ON t.id = h.tipo_habitacion_id
        WHERE rh.reserva_id = ANY($1::int[])
        ORDER BY length(h.numero), h.numero`,
      [ids]
    );

    const porReserva = new Map();
    for (const fila of filasLineas) {
      if (!porReserva.has(fila.reserva_id)) porReserva.set(fila.reserva_id, []);
      porReserva.get(fila.reserva_id).push(filaALinea(fila));
    }

    return filasReserva.map((fila) => filaAReserva(fila, porReserva.get(fila.id) || []));
  }
}

module.exports = { PgReservaRepository };
