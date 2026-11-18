'use strict';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio (por defecto, Ciudad de México). */
function hoyNegocio(zona = process.env.TZ_NEGOCIO || 'America/Mexico_City') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
}

module.exports = { hoyNegocio };
