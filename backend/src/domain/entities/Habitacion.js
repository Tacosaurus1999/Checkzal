'use strict';

const { DomainError } = require('../errors/DomainError');

// Mismos valores que el ENUM estado_habitacion del esquema SQL.
const ESTADOS_HABITACION = ['disponible', 'ocupada', 'limpieza', 'mantenimiento'];

class TipoHabitacion {
  constructor({ id = null, hotelId, nombre, descripcion = null, capacidad, precioBase }) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      throw new DomainError('El nombre del tipo de habitación debe tener al menos 2 caracteres.');
    }
    if (!Number.isInteger(Number(capacidad)) || Number(capacidad) <= 0) {
      throw new DomainError('La capacidad debe ser un entero mayor a 0.');
    }
    if (precioBase === undefined || precioBase === null || Number.isNaN(Number(precioBase)) || Number(precioBase) < 0) {
      throw new DomainError('El precio base debe ser un número mayor o igual a 0.');
    }

    this.id = id;
    this.hotelId = hotelId;
    this.nombre = nombre.trim();
    this.descripcion = descripcion || null;
    this.capacidad = Number(capacidad);
    this.precioBase = Number(precioBase);
  }

  toJSON() {
    return {
      id: this.id,
      hotelId: this.hotelId,
      nombre: this.nombre,
      descripcion: this.descripcion,
      capacidad: this.capacidad,
      precioBase: this.precioBase,
    };
  }
}

class Habitacion {
  /**
   * @param {Object} p
   * @param {{nombre:string,capacidad:number,precioBase:number}|null} p.tipo  datos del tipo (lectura)
   */
  constructor({
    id = null,
    hotelId,
    tipoHabitacionId,
    numero,
    piso = 1,
    estado = 'disponible',
    notas = null,
    activa = true,
    tipo = null,
  }) {
    if (!hotelId) throw new DomainError('La habitación debe pertenecer a un hotel.');
    if (!tipoHabitacionId) throw new DomainError('La habitación requiere un tipo de habitación.');
    if (!numero || String(numero).trim().length === 0 || String(numero).trim().length > 10) {
      throw new DomainError('El número de habitación es obligatorio (máximo 10 caracteres).');
    }
    if (!Number.isInteger(Number(piso))) {
      throw new DomainError('El piso debe ser un número entero.');
    }
    Habitacion.validarEstado(estado);

    this.id = id;
    this.hotelId = hotelId;
    this.tipoHabitacionId = tipoHabitacionId;
    this.numero = String(numero).trim();
    this.piso = Number(piso);
    this.estado = estado;
    this.notas = notas || null;
    this.activa = Boolean(activa);
    this.tipo = tipo;
  }

  static validarEstado(estado) {
    if (!ESTADOS_HABITACION.includes(estado)) {
      throw new DomainError(`Estado de habitación inválido: ${estado}.`);
    }
  }

  /**
   * Regla de negocio: "ocupada" solo se asigna con el check-in y se libera
   * con el check-out; no se modifica a mano para no desincronizar la estancia.
   */
  cambiarEstado(nuevoEstado) {
    Habitacion.validarEstado(nuevoEstado);
    if (nuevoEstado === this.estado) return;
    if (nuevoEstado === 'ocupada' || this.estado === 'ocupada') {
      throw new DomainError(
        'El estado "ocupada" lo gestionan el check-in y el check-out de la reserva.',
        'ESTADO_GESTIONADO_POR_ESTANCIA'
      );
    }
    this.estado = nuevoEstado;
  }

  toJSON() {
    return {
      id: this.id,
      hotelId: this.hotelId,
      tipoHabitacionId: this.tipoHabitacionId,
      numero: this.numero,
      piso: this.piso,
      estado: this.estado,
      notas: this.notas,
      activa: this.activa,
      tipo: this.tipo ? this.tipo.nombre : null,
      capacidad: this.tipo ? this.tipo.capacidad : null,
      precioBase: this.tipo ? this.tipo.precioBase : null,
    };
  }
}

module.exports = { Habitacion, TipoHabitacion, ESTADOS_HABITACION };
