'use strict';

const { DomainError } = require('../errors/DomainError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class Huesped {
  constructor({
    id = null,
    nombre,
    apellidos,
    email = null,
    telefono = null,
    tipoDocumento = null,
    numeroDocumento = null,
    nacionalidad = 'Mexicana',
    fechaNacimiento = null,
    telegramChatId = null,
    notas = null,
    creadoEn = null,
  }) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      throw new DomainError('El nombre del huésped debe tener al menos 2 caracteres.');
    }
    if (!apellidos || typeof apellidos !== 'string' || apellidos.trim().length < 2) {
      throw new DomainError('Los apellidos del huésped deben tener al menos 2 caracteres.');
    }
    if (email && !EMAIL_REGEX.test(email)) {
      throw new DomainError('El correo electrónico del huésped no tiene un formato válido.');
    }
    if ((tipoDocumento && !numeroDocumento) || (!tipoDocumento && numeroDocumento)) {
      throw new DomainError('Indica el tipo y el número de documento, o ninguno de los dos.');
    }
    if (fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
      throw new DomainError('La fecha de nacimiento debe tener formato YYYY-MM-DD.');
    }

    this.id = id;
    this.nombre = nombre.trim();
    this.apellidos = apellidos.trim();
    this.email = email ? email.trim().toLowerCase() : null;
    this.telefono = telefono || null;
    this.tipoDocumento = tipoDocumento || null;
    this.numeroDocumento = numeroDocumento ? String(numeroDocumento).trim().toUpperCase() : null;
    this.nacionalidad = nacionalidad || 'Mexicana';
    this.fechaNacimiento = fechaNacimiento || null;
    this.telegramChatId = telegramChatId || null;
    this.notas = notas || null;
    this.creadoEn = creadoEn;
  }

  get nombreCompleto() {
    return `${this.nombre} ${this.apellidos}`;
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      apellidos: this.apellidos,
      nombreCompleto: this.nombreCompleto,
      email: this.email,
      telefono: this.telefono,
      tipoDocumento: this.tipoDocumento,
      numeroDocumento: this.numeroDocumento,
      nacionalidad: this.nacionalidad,
      fechaNacimiento: this.fechaNacimiento,
      telegramChatId: this.telegramChatId,
      notas: this.notas,
      creadoEn: this.creadoEn,
    };
  }
}

module.exports = { Huesped };
