'use strict';

const { Pago } = require('../../domain/entities/Pago');
const { DomainError } = require('../../domain/errors/DomainError');

async function cargarReserva(reservaRepository, reservaId, hotelId) {
  const reserva = await reservaRepository.buscarPorId(reservaId, hotelId);
  if (!reserva) {
    throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
  }
  return reserva;
}

/** Caso de uso: RegisterPayment (Create) — rechaza pagos sobre reservas canceladas o por encima del saldo */
class RegisterPayment {
  constructor(pagoRepository, reservaRepository) {
    this.pagoRepository = pagoRepository;
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(reservaId, hotelId, usuarioId, { monto, metodo, referencia = null }) {
    const reserva = await cargarReserva(this.reservaRepository, reservaId, hotelId);
    if (reserva.estado === 'cancelada') {
      throw new DomainError('No se pueden registrar pagos en una reserva cancelada.', 'RESERVA_CERRADA');
    }

    const pago = new Pago({ reservaId, usuarioId, monto, metodo, referencia });

    const { saldo } = await this.pagoRepository.obtenerSaldo(reservaId);
    if (pago.monto > saldo + 0.009) {
      throw new DomainError(
        `El pago ($${pago.monto.toFixed(2)}) excede el saldo pendiente ($${Math.max(saldo, 0).toFixed(2)}).`,
        'PAGO_EXCEDE_SALDO'
      );
    }

    const creado = await this.pagoRepository.crear(pago);
    const saldoActualizado = await this.pagoRepository.obtenerSaldo(reservaId);
    return { pago: creado.toJSON(), saldo: saldoActualizado };
  }
}

/** Caso de uso: ListPayments (Read) — pagos de una reserva + saldo */
class ListPayments {
  constructor(pagoRepository, reservaRepository) {
    this.pagoRepository = pagoRepository;
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(reservaId, hotelId) {
    await cargarReserva(this.reservaRepository, reservaId, hotelId);
    const [pagos, saldo] = await Promise.all([
      this.pagoRepository.listarPorReserva(reservaId),
      this.pagoRepository.obtenerSaldo(reservaId),
    ]);
    return { pagos: pagos.map((p) => p.toJSON()), saldo };
  }
}

module.exports = { RegisterPayment, ListPayments };
