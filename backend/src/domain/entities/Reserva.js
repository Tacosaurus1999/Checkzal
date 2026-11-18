'use strict';

const { DomainError } = require('../errors/DomainError');

// Mismos valores que los ENUM estado_reserva y origen_reserva del esquema SQL.
const ESTADOS_RESERVA = ['pendiente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'no_show'];
const ORIGENES_RESERVA = ['directa', 'telefono', 'telegram', 'web', 'booking', 'airbnb', 'otro'];

/** Máquina de estados: qué transiciones permite cada estado. */
const TRANSICIONES = {
  pendiente: ['confirmada', 'checkin', 'cancelada', 'no_show'],
  confirmada: ['checkin', 'cancelada', 'no_show'],
  checkin: ['checkout'],
  checkout: [],
  cancelada: [],
  no_show: [],
};

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(valor, campo) {
  const valida =
    typeof valor === 'string' &&
    FECHA_REGEX.test(valor) &&
    new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
  if (!valida) {
    throw new DomainError(`${campo} debe ser una fecha válida con formato YYYY-MM-DD.`);
  }
}

function nochesEntre(entrada, salida) {
  return Math.round((Date.parse(`${salida}T00:00:00Z`) - Date.parse(`${entrada}T00:00:00Z`)) / 86400000);
}

/** Valida un rango [entrada, salida) y devuelve el número de noches. */
function validarRangoFechas(entrada, salida) {
  validarFecha(entrada, 'La fecha de entrada');
  validarFecha(salida, 'La fecha de salida');
  const noches = nochesEntre(entrada, salida);
  if (noches <= 0) {
    throw new DomainError('La fecha de salida debe ser posterior a la fecha de entrada.');
  }
  return noches;
}

class ReservaHabitacion {
  constructor({ id = null, habitacionId, numero = null, tipo = null, precioNoche, activa = true }) {
    if (!habitacionId) throw new DomainError('Cada línea de la reserva requiere una habitación.');
    if (precioNoche === undefined || precioNoche === null || Number.isNaN(Number(precioNoche)) || Number(precioNoche) < 0) {
      throw new DomainError('El precio por noche no es válido.');
    }
    this.id = id;
    this.habitacionId = habitacionId;
    this.numero = numero;
    this.tipo = tipo;
    this.precioNoche = Number(precioNoche);
    this.activa = Boolean(activa);
  }

  toJSON() {
    return {
      id: this.id,
      habitacionId: this.habitacionId,
      numero: this.numero,
      tipo: this.tipo,
      precioNoche: this.precioNoche,
      activa: this.activa,
    };
  }
}

class Reserva {
  constructor({
    id = null,
    codigo = null,
    hotelId,
    huespedId,
    usuarioId = null,
    fechaEntrada,
    fechaSalida,
    numAdultos = 1,
    numNinos = 0,
    estado = 'pendiente',
    origen = 'directa',
    total = null,
    notas = null,
    habitaciones = [],
    huespedNombre = null,
    huespedTelefono = null,
    huespedEmail = null,
    totalAPagar = null,
    totalPagado = 0,
    saldo = null,
    creadoEn = null,
    actualizadoEn = null,
  }) {
    if (!hotelId) throw new DomainError('La reserva debe pertenecer a un hotel.');
    if (!huespedId) throw new DomainError('La reserva debe tener un huésped titular.');
    this.noches = validarRangoFechas(fechaEntrada, fechaSalida);
    if (!Number.isInteger(Number(numAdultos)) || Number(numAdultos) < 1) {
      throw new DomainError('Debe haber al menos 1 adulto en la reserva.');
    }
    if (!Number.isInteger(Number(numNinos)) || Number(numNinos) < 0) {
      throw new DomainError('El número de niños no puede ser negativo.');
    }
    if (!ESTADOS_RESERVA.includes(estado)) {
      throw new DomainError(`Estado de reserva inválido: ${estado}.`);
    }
    if (!ORIGENES_RESERVA.includes(origen)) {
      throw new DomainError(`Origen de reserva inválido: ${origen}.`);
    }
    if (!Array.isArray(habitaciones) || habitaciones.length === 0) {
      throw new DomainError('La reserva debe incluir al menos una habitación.');
    }

    this.id = id;
    this.codigo = codigo;
    this.hotelId = hotelId;
    this.huespedId = huespedId;
    this.usuarioId = usuarioId;
    this.fechaEntrada = fechaEntrada;
    this.fechaSalida = fechaSalida;
    this.numAdultos = Number(numAdultos);
    this.numNinos = Number(numNinos);
    this.estado = estado;
    this.origen = origen;
    this.notas = notas || null;
    this.habitaciones = habitaciones.map((h) => (h instanceof ReservaHabitacion ? h : new ReservaHabitacion(h)));
    this.huespedNombre = huespedNombre;
    this.huespedTelefono = huespedTelefono;
    this.huespedEmail = huespedEmail;
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;

    this.total = total !== null && total !== undefined ? Number(total) : this.calcularTotal();
    this.totalAPagar = totalAPagar !== null && totalAPagar !== undefined ? Number(totalAPagar) : this.total;
    this.totalPagado = Number(totalPagado || 0);
    this.saldo = saldo !== null && saldo !== undefined ? Number(saldo) : this.totalAPagar - this.totalPagado;
  }

  /** Regla de negocio: total = suma(precio_noche de cada habitación activa) × noches. */
  calcularTotal() {
    const porNoche = this.habitaciones.filter((h) => h.activa).reduce((acc, h) => acc + h.precioNoche, 0);
    return Number((porNoche * this.noches).toFixed(2));
  }

  /** Suma de la capacidad de las habitaciones, a partir de un mapa habitacionId -> capacidad. */
  static validarCapacidad(numAdultos, numNinos, capacidadTotal) {
    if (Number(numAdultos) + Number(numNinos) > capacidadTotal) {
      throw new DomainError(
        `Los ${Number(numAdultos) + Number(numNinos)} huéspedes exceden la capacidad de las habitaciones (${capacidadTotal}).`,
        'CAPACIDAD_EXCEDIDA'
      );
    }
  }

  puedeCambiarA(nuevoEstado) {
    return (TRANSICIONES[this.estado] || []).includes(nuevoEstado);
  }

  cambiarEstado(nuevoEstado) {
    if (!ESTADOS_RESERVA.includes(nuevoEstado)) {
      throw new DomainError(`Estado de reserva inválido: ${nuevoEstado}.`);
    }
    if (!this.puedeCambiarA(nuevoEstado)) {
      throw new DomainError(
        `No se puede pasar una reserva de "${this.estado}" a "${nuevoEstado}".`,
        'TRANSICION_INVALIDA'
      );
    }
    this.estado = nuevoEstado;
  }

  toJSON() {
    return {
      id: this.id,
      codigo: this.codigo,
      hotelId: this.hotelId,
      huespedId: this.huespedId,
      huespedNombre: this.huespedNombre,
      huespedTelefono: this.huespedTelefono,
      huespedEmail: this.huespedEmail,
      usuarioId: this.usuarioId,
      fechaEntrada: this.fechaEntrada,
      fechaSalida: this.fechaSalida,
      noches: this.noches,
      numAdultos: this.numAdultos,
      numNinos: this.numNinos,
      estado: this.estado,
      origen: this.origen,
      total: this.total,
      totalAPagar: this.totalAPagar,
      totalPagado: this.totalPagado,
      saldo: this.saldo,
      notas: this.notas,
      habitaciones: this.habitaciones.map((h) => h.toJSON()),
      creadoEn: this.creadoEn,
      actualizadoEn: this.actualizadoEn,
    };
  }
}

module.exports = {
  Reserva,
  ReservaHabitacion,
  ESTADOS_RESERVA,
  ORIGENES_RESERVA,
  TRANSICIONES,
  validarRangoFechas,
  nochesEntre,
};
