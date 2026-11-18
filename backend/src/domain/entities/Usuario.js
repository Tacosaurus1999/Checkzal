'use strict';

const { DomainError } = require('../errors/DomainError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
// Mismos valores que el ENUM rol_usuario del esquema SQL.
const ROLES_VALIDOS = ['admin', 'recepcionista', 'gerente'];

/**
 * Entidad pura de Usuario (personal del hotel). No conoce PostgreSQL,
 * Express ni bcrypt: solo las reglas que definen un usuario válido.
 */
class Usuario {
  constructor({
    id = null,
    hotelId,
    nombre,
    email,
    passwordHash = null,
    rol = 'recepcionista',
    telegramChatId = null,
    activo = true,
    hotelNombre = null,
    creadoEn = null,
  }) {
    Usuario.validarEmail(email);
    Usuario.validarNombre(nombre);
    Usuario.validarRol(rol);
    if (!hotelId) throw new DomainError('El usuario debe pertenecer a un hotel.');

    this.id = id;
    this.hotelId = hotelId;
    this.nombre = nombre.trim();
    this.email = email.trim().toLowerCase();
    this.passwordHash = passwordHash;
    this.rol = rol;
    this.telegramChatId = telegramChatId;
    this.activo = Boolean(activo);
    this.hotelNombre = hotelNombre;
    this.creadoEn = creadoEn;
  }

  static validarEmail(email) {
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      throw new DomainError('El correo electrónico no tiene un formato válido.');
    }
  }

  static validarNombre(nombre) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      throw new DomainError('El nombre debe tener al menos 2 caracteres.');
    }
  }

  static validarRol(rol) {
    if (!ROLES_VALIDOS.includes(rol)) {
      throw new DomainError(`Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}.`);
    }
  }

  static validarPasswordPlano(passwordPlano) {
    if (!passwordPlano || typeof passwordPlano !== 'string') {
      throw new DomainError('La contraseña es obligatoria.');
    }
    if (passwordPlano.length < PASSWORD_MIN_LENGTH) {
      throw new DomainError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    }
    if (!/[0-9]/.test(passwordPlano) || !/[A-Za-z]/.test(passwordPlano)) {
      throw new DomainError('La contraseña debe combinar letras y números.');
    }
  }

  esAdmin() {
    return this.rol === 'admin';
  }

  toPublicJSON() {
    return {
      id: this.id,
      hotelId: this.hotelId,
      hotelNombre: this.hotelNombre,
      nombre: this.nombre,
      email: this.email,
      rol: this.rol,
      telegramChatId: this.telegramChatId,
      activo: this.activo,
      creadoEn: this.creadoEn,
    };
  }
}

module.exports = { Usuario, ROLES_VALIDOS, PASSWORD_MIN_LENGTH };
