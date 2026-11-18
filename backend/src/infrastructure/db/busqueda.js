'use strict';

const { escaparLike } = require('./like');

/**
 * Búsqueda de texto tolerante: sin distinguir mayúsculas ni acentos ("lopez" encuentra "López", "ñ" ≈ "n")
 * y con varias palabras en cualquier orden ("maria lopez" = "lopez maria"). Solo usa funciones nativas
 * de PostgreSQL (sin extensiones). Los índices de database/indices_opcionales.sql usan EXACTAMENTE esta
 * expresión, así que cualquier cambio aquí debe reflejarse allá.
 */
const NORMALIZAR = (expresion) => `translate(lower(${expresion}), 'áéíóúüñ', 'aeiouun')`;

/** Texto buscable de un huésped: nombre, apellidos, correo, teléfono y documento. */
const TEXTO_HUESPED = `${NORMALIZAR(
  "nombre || ' ' || apellidos || ' ' || coalesce(email, '') || ' ' || coalesce(telefono, '') || ' ' || coalesce(numero_documento, '')"
)}`;

const MAX_TERMINOS = 5;

/** Divide la búsqueda en palabras, sin acentos y en minúsculas (máx. 5). */
function terminosBusqueda(q) {
  return String(q || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (incluye ñ -> n, ü -> u)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMINOS);
}

const patronLike = (termino) => `%${escaparLike(termino)}%`;

module.exports = { NORMALIZAR, TEXTO_HUESPED, terminosBusqueda, patronLike };
