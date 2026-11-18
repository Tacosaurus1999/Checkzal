'use strict';

/**
 * Error de negocio: se lanza cuando se viola una regla del dominio
 * (sobreventa, transición de estado inválida, saldo pendiente, etc).
 * Los adaptadores HTTP lo traducen a un código de estado apropiado (400/403/404/409).
 */
class DomainError extends Error {
  constructor(mensaje, codigo = 'DOMAIN_ERROR') {
    super(mensaje);
    this.name = 'DomainError';
    this.codigo = codigo;
  }
}

module.exports = { DomainError };
