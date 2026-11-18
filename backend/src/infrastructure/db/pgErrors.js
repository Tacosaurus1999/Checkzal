'use strict';

const { DomainError } = require('../../domain/errors/DomainError');

/**
 * Traduce errores del driver `pg` (códigos SQLSTATE) a errores de dominio,
 * para que ni la capa de aplicación ni HTTP conozcan PostgreSQL.
 *
 *   23505 unique_violation      23503 foreign_key_violation
 *   23P01 exclusion_violation   23514 check_violation
 *
 * Siempre lanza: un DomainError si el código está mapeado, o el error original.
 *
 * @param {Error & { code?: string }} error
 * @param {Record<string, { mensaje: string, codigo: string }>} mapa
 */
function traducirErrorPg(error, mapa = {}) {
  // Se puede mapear por SQLSTATE ('23505') o, más específico, por SQLSTATE:restricción ('23505:huespedes_pkey')
  const entrada = mapa[`${error.code}:${error.constraint}`] || mapa[error.code];
  if (entrada) {
    throw new DomainError(entrada.mensaje, entrada.codigo);
  }
  throw error;
}

module.exports = { traducirErrorPg };
