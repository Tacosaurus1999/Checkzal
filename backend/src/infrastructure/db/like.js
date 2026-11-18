'use strict';

/** Escapa % _ y la barra invertida para que un texto del usuario se busque literalmente dentro de un ILIKE '%...%'. */
function escaparLike(texto) {
  return String(texto).replace(/[\\%_]/g, '\\$&');
}

module.exports = { escaparLike };
