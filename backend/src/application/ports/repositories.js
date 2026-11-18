'use strict';

/**
 * PUERTOS (contratos lógicos) — capa de Aplicación.
 * Estas clases NO tienen implementación: documentan el contrato que
 * los adaptadores de infraestructura (PostgreSQL) deben cumplir.
 * Los casos de uso dependen únicamente de estas interfaces, nunca
 * del driver `pg` directamente (inversión de dependencias).
 *
 * Multi-hotel: todo método que recibe `hotelId` DEBE filtrar por él, de modo
 * que el personal de un hotel nunca vea ni modifique datos de otro.
 */

class UsuarioRepositoryPort {
  /** @returns {Promise<Usuario|null>} */
  async buscarPorEmail(_email) {
    throw new Error('No implementado: buscarPorEmail');
  }

  /** @returns {Promise<Usuario|null>} */
  async buscarPorId(_id, _hotelId) {
    throw new Error('No implementado: buscarPorId');
  }

  /** @returns {Promise<Usuario[]>} */
  async listarPorHotel(_hotelId) {
    throw new Error('No implementado: listarPorHotel');
  }

  /** @returns {Promise<Usuario>} usuario persistido con id asignado */
  async crear(_usuario) {
    throw new Error('No implementado: crear');
  }

  /** @returns {Promise<Usuario>} */
  async actualizar(_usuario) {
    throw new Error('No implementado: actualizar');
  }

  async actualizarPassword(_id, _passwordHash) {
    throw new Error('No implementado: actualizarPassword');
  }

  async eliminar(_id, _hotelId) {
    throw new Error('No implementado: eliminar');
  }
}

class HabitacionRepositoryPort {
  /** @returns {Promise<Habitacion[]>} con los datos de su tipo */
  async listar(_hotelId) {
    throw new Error('No implementado: listar');
  }

  /** @returns {Promise<Habitacion|null>} */
  async buscarPorId(_id, _hotelId) {
    throw new Error('No implementado: buscarPorId');
  }

  /** @returns {Promise<Habitacion>} */
  async crear(_habitacion) {
    throw new Error('No implementado: crear');
  }

  /** @returns {Promise<Habitacion>} */
  async actualizar(_habitacion) {
    throw new Error('No implementado: actualizar');
  }

  /** @returns {Promise<Habitacion>} */
  async actualizarEstado(_id, _hotelId, _estado) {
    throw new Error('No implementado: actualizarEstado');
  }

  async eliminar(_id, _hotelId) {
    throw new Error('No implementado: eliminar');
  }

  /**
   * Habitaciones libres en [entrada, salida) descontando reservas activas y bloqueos.
   * @returns {Promise<Array<{habitacionId:number,numero:string,tipo:string,capacidad:number,precioBase:number}>>}
   */
  async listarDisponibles(_hotelId, _entrada, _salida) {
    throw new Error('No implementado: listarDisponibles');
  }

  /** @returns {Promise<TipoHabitacion[]>} */
  async listarTipos(_hotelId) {
    throw new Error('No implementado: listarTipos');
  }

  /** @returns {Promise<TipoHabitacion|null>} */
  async buscarTipoPorId(_id, _hotelId) {
    throw new Error('No implementado: buscarTipoPorId');
  }

  /** @returns {Promise<TipoHabitacion>} */
  async crearTipo(_tipo) {
    throw new Error('No implementado: crearTipo');
  }

  /** @returns {Promise<TipoHabitacion>} */
  async actualizarTipo(_tipo) {
    throw new Error('No implementado: actualizarTipo');
  }

  async eliminarTipo(_id, _hotelId) {
    throw new Error('No implementado: eliminarTipo');
  }
}

class HuespedRepositoryPort {
  /** @param {{ q?: string, limite?: number }} filtros @returns {Promise<Huesped[]>} */
  async listar(_filtros) {
    throw new Error('No implementado: listar');
  }

  /** @returns {Promise<Huesped|null>} */
  async buscarPorId(_id) {
    throw new Error('No implementado: buscarPorId');
  }

  /** @returns {Promise<Huesped>} */
  async crear(_huesped) {
    throw new Error('No implementado: crear');
  }

  /** @returns {Promise<Huesped>} */
  async actualizar(_huesped) {
    throw new Error('No implementado: actualizar');
  }

  async eliminar(_id) {
    throw new Error('No implementado: eliminar');
  }
}

class ReservaRepositoryPort {
  /**
   * Persiste la reserva y sus habitaciones en UNA transacción.
   * Debe lanzar DomainError('SOBREVENTA') si la BD rechaza el traslape
   * (restricción EXCLUDE `sin_sobreventa`).
   * @returns {Promise<Reserva>}
   */
  async crear(_reserva) {
    throw new Error('No implementado: crear');
  }

  /** @param {{ estado?: string, desde?: string, hasta?: string, q?: string }} filtros @returns {Promise<Reserva[]>} */
  async listar(_hotelId, _filtros) {
    throw new Error('No implementado: listar');
  }

  /** @returns {Promise<Reserva|null>} con habitaciones y saldo */
  async buscarPorId(_id, _hotelId) {
    throw new Error('No implementado: buscarPorId');
  }

  /** @returns {Promise<Reserva>} */
  async actualizarEstado(_id, _hotelId, _estado) {
    throw new Error('No implementado: actualizarEstado');
  }

  /** Estado = checkin + crea las estancias + marca las habitaciones como ocupadas (transacción). */
  async registrarCheckin(_id, _hotelId, _usuarioId) {
    throw new Error('No implementado: registrarCheckin');
  }

  /** Estado = checkout + cierra las estancias + marca las habitaciones en limpieza (transacción). */
  async registrarCheckout(_id, _hotelId, _usuarioId) {
    throw new Error('No implementado: registrarCheckout');
  }

  async eliminar(_id, _hotelId) {
    throw new Error('No implementado: eliminar');
  }
}

class PagoRepositoryPort {
  /** @returns {Promise<Pago>} */
  async crear(_pago) {
    throw new Error('No implementado: crear');
  }

  /** @returns {Promise<Pago[]>} */
  async listarPorReserva(_reservaId) {
    throw new Error('No implementado: listarPorReserva');
  }

  /** @returns {Promise<{ totalAPagar:number, totalPagado:number, saldo:number }>} */
  async obtenerSaldo(_reservaId) {
    throw new Error('No implementado: obtenerSaldo');
  }
}

class ReporteRepositoryPort {
  /** Consume la vista v_ocupacion_hoy. */
  async ocupacionHoy(_hotelId) {
    throw new Error('No implementado: ocupacionHoy');
  }

  /** Consume la vista v_movimientos_hoy. */
  async movimientosHoy(_hotelId) {
    throw new Error('No implementado: movimientosHoy');
  }

  /**
   * Estadísticas agrupadas por periodo.
   * @param {number} _hotelId
   * @param {{ unidad: 'week'|'month'|'year', desde: string, hasta: string }} _filtros
   * @returns {Promise<Array<{periodo:string, reservas:number, huespedes:number, personas:number,
   *   llegaron:number, canceladas:number, noShow:number, porLlegar:number, reservado:number, ingresos:number}>>}
   */
  async estadisticas(_hotelId, _filtros) {
    throw new Error('No implementado: estadisticas');
  }
}

module.exports = {
  UsuarioRepositoryPort,
  HabitacionRepositoryPort,
  HuespedRepositoryPort,
  ReservaRepositoryPort,
  PagoRepositoryPort,
  ReporteRepositoryPort,
};
