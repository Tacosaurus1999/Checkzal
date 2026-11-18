'use strict';

const { PagoRepositoryPort } = require('../../application/ports/repositories');
const { Pago } = require('../../domain/entities/Pago');

function filaAPago(fila) {
  if (!fila) return null;
  return new Pago({
    id: fila.id,
    reservaId: fila.reserva_id,
    usuarioId: fila.usuario_id,
    usuarioNombre: fila.usuario_nombre || null,
    monto: fila.monto,
    metodo: fila.metodo,
    referencia: fila.referencia,
    fecha: fila.fecha,
  });
}

class PgPagoRepository extends PagoRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async crear(pago) {
    const { rows } = await this.pool.query(
      `INSERT INTO pagos (reserva_id, usuario_id, monto, metodo, referencia)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [pago.reservaId, pago.usuarioId, pago.monto, pago.metodo, pago.referencia]
    );
    return filaAPago(rows[0]);
  }

  async listarPorReserva(reservaId) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.nombre AS usuario_nombre
         FROM pagos p
         LEFT JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.reserva_id = $1
        ORDER BY p.fecha DESC, p.id DESC`,
      [reservaId]
    );
    return rows.map(filaAPago);
  }

  /** Consume la vista v_saldo_reservas (total + consumos − pagos). */
  async obtenerSaldo(reservaId) {
    const { rows } = await this.pool.query(
      'SELECT total_a_pagar, total_pagado, saldo FROM v_saldo_reservas WHERE reserva_id = $1',
      [reservaId]
    );
    const fila = rows[0] || { total_a_pagar: 0, total_pagado: 0, saldo: 0 };
    return {
      totalAPagar: Number(fila.total_a_pagar),
      totalPagado: Number(fila.total_pagado),
      saldo: Number(fila.saldo),
    };
  }
}

module.exports = { PgPagoRepository };
