'use strict';

const { DomainError } = require('../errors/DomainError');

// Mismos valores que el ENUM metodo_pago del esquema SQL.
const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia', 'deposito', 'otro'];

class Pago {
  constructor({
    id = null,
    reservaId,
    usuarioId = null,
    usuarioNombre = null,
    monto,
    metodo,
    referencia = null,
    fecha = null,
  }) {
    if (!reservaId) throw new DomainError('El pago debe estar asociado a una reserva.');
    if (monto === undefined || monto === null || Number.isNaN(Number(monto)) || Number(monto) <= 0) {
      throw new DomainError('El monto del pago debe ser mayor a 0.');
    }
    if (!METODOS_PAGO.includes(metodo)) {
      throw new DomainError(`Método de pago inválido. Valores permitidos: ${METODOS_PAGO.join(', ')}.`);
    }
    if (referencia && String(referencia).length > 80) {
      throw new DomainError('La referencia no puede exceder 80 caracteres.');
    }

    this.id = id;
    this.reservaId = reservaId;
    this.usuarioId = usuarioId;
    this.usuarioNombre = usuarioNombre;
    this.monto = Number(Number(monto).toFixed(2));
    this.metodo = metodo;
    this.referencia = referencia || null;
    this.fecha = fecha;
  }

  toJSON() {
    return {
      id: this.id,
      reservaId: this.reservaId,
      usuarioId: this.usuarioId,
      usuarioNombre: this.usuarioNombre,
      monto: this.monto,
      metodo: this.metodo,
      referencia: this.referencia,
      fecha: this.fecha,
    };
  }
}

module.exports = { Pago, METODOS_PAGO };
