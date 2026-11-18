'use strict';

const { Reserva, ReservaHabitacion, validarRangoFechas } = require('../../domain/entities/Reserva');
const { DomainError } = require('../../domain/errors/DomainError');
const { hoyNegocio } = require('../utils/fechas');

const ROLES_CON_PRECIO_LIBRE = ['admin', 'gerente'];

/**
 * Caso de uso: CreateReservation (Create)
 * Orquesta:
 *   1. Validar fechas y existencia del huésped titular.
 *   2. Verificar disponibilidad (función SQL habitaciones_disponibles) de cada habitación.
 *   3. Resolver el precio por noche (precio base del tipo; solo admin/gerente pueden modificarlo).
 *   4. Verificar que las habitaciones alcancen para los adultos + niños.
 *   5. Persistir reserva + habitaciones en una transacción. Si dos recepcionistas reservan
 *      el mismo cuarto a la vez, la restricción EXCLUDE de PostgreSQL rechaza al segundo
 *      (el repositorio lo traduce a DomainError 'SOBREVENTA' -> HTTP 409).
 */
class CreateReservation {
  /**
   * @param {ReservaRepositoryPort} reservaRepository
   * @param {HabitacionRepositoryPort} habitacionRepository
   * @param {HuespedRepositoryPort} huespedRepository
   */
  constructor(reservaRepository, habitacionRepository, huespedRepository, { hoy = hoyNegocio } = {}) {
    this.reservaRepository = reservaRepository;
    this.habitacionRepository = habitacionRepository;
    this.huespedRepository = huespedRepository;
    this.hoy = hoy;
  }

  /** @param {{id:number, rol:string, hotelId:number}} solicitante */
  async ejecutar(solicitante, datos) {
    const {
      huespedId,
      fechaEntrada,
      fechaSalida,
      numAdultos = 1,
      numNinos = 0,
      origen = 'directa',
      estado = 'confirmada',
      notas = null,
      habitaciones,
    } = datos;
    const hotelId = solicitante.hotelId;

    if (!Array.isArray(habitaciones) || habitaciones.length === 0) {
      throw new DomainError('Selecciona al menos una habitación para la reserva.');
    }
    const ids = habitaciones.map((h) => h.habitacionId);
    if (new Set(ids).size !== ids.length) {
      throw new DomainError('No puedes repetir la misma habitación en una reserva.');
    }
    validarRangoFechas(fechaEntrada, fechaSalida);
    // Una reserva nueva no puede empezar en el pasado (solo admin/gerente, p. ej. para cargar registros atrasados).
    if (fechaEntrada < this.hoy() && !ROLES_CON_PRECIO_LIBRE.includes(solicitante.rol)) {
      throw new DomainError('La fecha de entrada no puede ser anterior a hoy.', 'FECHA_PASADA');
    }
    if (!['pendiente', 'confirmada'].includes(estado)) {
      throw new DomainError('Una reserva nueva solo puede crearse como "pendiente" o "confirmada".');
    }

    const huesped = await this.huespedRepository.buscarPorId(huespedId);
    if (!huesped) {
      throw new DomainError('El huésped titular no existe.', 'HUESPED_NO_ENCONTRADO');
    }

    const disponibles = await this.habitacionRepository.listarDisponibles(hotelId, fechaEntrada, fechaSalida);
    const idsDisponibles = new Set(disponibles.map((d) => d.habitacionId));

    const lineas = [];
    let capacidadTotal = 0;
    for (const linea of habitaciones) {
      const habitacion = await this.habitacionRepository.buscarPorId(linea.habitacionId, hotelId);
      if (!habitacion) {
        throw new DomainError(`La habitación ${linea.habitacionId} no existe en este hotel.`, 'HABITACION_NO_ENCONTRADA');
      }
      if (!habitacion.activa || !idsDisponibles.has(habitacion.id)) {
        throw new DomainError(
          `La habitación ${habitacion.numero} no está disponible del ${fechaEntrada} al ${fechaSalida}.`,
          'HABITACION_NO_DISPONIBLE'
        );
      }

      let precioNoche = habitacion.tipo.precioBase;
      const precioSolicitado = linea.precioNoche;
      if (precioSolicitado !== undefined && precioSolicitado !== null && Number(precioSolicitado) !== precioNoche) {
        if (!ROLES_CON_PRECIO_LIBRE.includes(solicitante.rol)) {
          throw new DomainError('Solo un administrador o gerente puede modificar el precio por noche.', 'SIN_PERMISO');
        }
        precioNoche = Number(precioSolicitado);
      }

      capacidadTotal += habitacion.tipo.capacidad;
      lineas.push(
        new ReservaHabitacion({
          habitacionId: habitacion.id,
          numero: habitacion.numero,
          tipo: habitacion.tipo.nombre,
          precioNoche,
        })
      );
    }

    Reserva.validarCapacidad(numAdultos, numNinos, capacidadTotal);

    const reserva = new Reserva({
      hotelId,
      huespedId,
      usuarioId: solicitante.id,
      fechaEntrada,
      fechaSalida,
      numAdultos,
      numNinos,
      estado,
      origen,
      notas,
      habitaciones: lineas,
    });

    const creada = await this.reservaRepository.crear(reserva);
    return creada.toJSON();
  }
}

/** Caso de uso: ListReservations (Read, con filtros) */
class ListReservations {
  constructor(reservaRepository) {
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(hotelId, filtros = {}) {
    const reservas = await this.reservaRepository.listar(hotelId, filtros);
    return reservas.map((r) => r.toJSON());
  }
}

/** Caso de uso: GetReservation (Read) */
class GetReservation {
  constructor(reservaRepository) {
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(id, hotelId) {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) {
      throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    }
    return reserva.toJSON();
  }
}

/**
 * Caso de uso: UpdateReservationStatus (Update — confirmar / cancelar / no_show).
 * El check-in y el check-out tienen casos de uso propios porque tocan estancias y habitaciones.
 * Al cancelar, el trigger fn_liberar_habitaciones de la BD libera las habitaciones.
 */
class UpdateReservationStatus {
  constructor(reservaRepository, { hoy = hoyNegocio } = {}) {
    this.reservaRepository = reservaRepository;
    this.hoy = hoy;
  }

  async ejecutar(id, hotelId, nuevoEstado) {
    if (!['confirmada', 'cancelada', 'no_show'].includes(nuevoEstado)) {
      throw new DomainError(
        'Desde aquí solo se puede pasar a "confirmada", "cancelada" o "no_show". Usa check-in / check-out para el resto.',
        'ESTADO_NO_PERMITIDO'
      );
    }
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) {
      throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    }
    reserva.cambiarEstado(nuevoEstado); // valida la transición en el dominio
    if (nuevoEstado === 'no_show' && reserva.fechaEntrada > this.hoy()) {
      throw new DomainError(
        `No se puede marcar no-show antes de la fecha de llegada (${reserva.fechaEntrada}). Cancela la reserva si ya no vendrá.`,
        'NO_SHOW_PREMATURO'
      );
    }
    const actualizada = await this.reservaRepository.actualizarEstado(id, hotelId, nuevoEstado);
    return actualizada.toJSON();
  }
}

/** Caso de uso: CheckInReservation — crea las estancias y marca las habitaciones como ocupadas */
class CheckInReservation {
  constructor(reservaRepository, habitacionRepository, { hoy = hoyNegocio } = {}) {
    this.reservaRepository = reservaRepository;
    this.habitacionRepository = habitacionRepository;
    this.hoy = hoy;
  }

  async ejecutar(id, hotelId, usuarioId) {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) {
      throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    }
    reserva.cambiarEstado('checkin');

    const hoy = this.hoy();
    if (hoy < reserva.fechaEntrada) {
      throw new DomainError(
        `El check-in solo puede hacerse a partir de la fecha de llegada (${reserva.fechaEntrada}).`,
        'CHECKIN_FUERA_DE_FECHA'
      );
    }
    if (hoy >= reserva.fechaSalida) {
      throw new DomainError(
        `La estancia terminó el ${reserva.fechaSalida}: ya no se puede hacer check-in. Márcala como no-show.`,
        'CHECKIN_FUERA_DE_FECHA'
      );
    }

    for (const linea of reserva.habitaciones.filter((h) => h.activa)) {
      const habitacion = await this.habitacionRepository.buscarPorId(linea.habitacionId, hotelId);
      if (!habitacion || ['ocupada', 'mantenimiento'].includes(habitacion.estado)) {
        throw new DomainError(
          `La habitación ${linea.numero} no está lista para el check-in (estado: ${habitacion ? habitacion.estado : 'inexistente'}).`,
          'HABITACION_NO_LISTA'
        );
      }
    }

    const actualizada = await this.reservaRepository.registrarCheckin(id, hotelId, usuarioId);
    return actualizada.toJSON();
  }
}

/**
 * Caso de uso: CheckOutReservation — cierra las estancias y manda las habitaciones a limpieza.
 * Si queda saldo pendiente, solo un admin/gerente puede forzar el check-out.
 */
class CheckOutReservation {
  constructor(reservaRepository, pagoRepository) {
    this.reservaRepository = reservaRepository;
    this.pagoRepository = pagoRepository;
  }

  async ejecutar(id, hotelId, solicitante, { forzar = false } = {}) {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) {
      throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    }
    reserva.cambiarEstado('checkout');

    const { saldo } = await this.pagoRepository.obtenerSaldo(id);
    if (saldo > 0.009) {
      if (!forzar) {
        throw new DomainError(`La reserva tiene un saldo pendiente de $${saldo.toFixed(2)}.`, 'SALDO_PENDIENTE');
      }
      if (!ROLES_CON_PRECIO_LIBRE.includes(solicitante.rol)) {
        throw new DomainError('Solo un administrador o gerente puede hacer check-out con saldo pendiente.', 'SIN_PERMISO');
      }
    }

    const actualizada = await this.reservaRepository.registrarCheckout(id, hotelId, solicitante.id);
    return actualizada.toJSON();
  }
}

/** Caso de uso: DeleteReservation (Delete físico — solo reservas sin actividad ni pagos) */
class DeleteReservation {
  constructor(reservaRepository) {
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(id, hotelId) {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) {
      throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    }
    if (!['pendiente', 'cancelada', 'no_show'].includes(reserva.estado)) {
      throw new DomainError(
        'Solo se pueden eliminar reservas pendientes, canceladas o no-show. Las demás se conservan como historial.',
        'RESERVA_NO_ELIMINABLE'
      );
    }
    if (reserva.totalPagado > 0) {
      throw new DomainError('La reserva tiene pagos registrados y no puede eliminarse.', 'RESERVA_NO_ELIMINABLE');
    }
    await this.reservaRepository.eliminar(id, hotelId);
    return { id };
  }
}

module.exports = {
  CreateReservation,
  ListReservations,
  GetReservation,
  UpdateReservationStatus,
  CheckInReservation,
  CheckOutReservation,
  DeleteReservation,
};
