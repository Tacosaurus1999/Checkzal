'use strict';

/**
 * Limita los intentos FALLIDOS de inicio de sesión por (IP + correo): tras `maxIntentos` errores (401)
 * dentro de `ventanaMs`, responde 429 hasta que pase la ventana. Un inicio correcto reinicia el contador.
 * En memoria: suficiente para una sola instancia de la API.
 */
function crearLimitadorLogin({ maxIntentos = 8, ventanaMs = 15 * 60 * 1000, ahora = Date.now } = {}) {
  const fallos = new Map(); // clave -> { n, hasta }

  return function limitarLogin(req, res, next) {
    const correo = String((req.body && req.body.email) || '').trim().toLowerCase();
    const clave = `${req.ip}|${correo}`;
    const actual = fallos.get(clave);

    if (actual && actual.hasta > ahora() && actual.n >= maxIntentos) {
      res.set('Retry-After', String(Math.ceil((actual.hasta - ahora()) / 1000)));
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
        codigo: 'DEMASIADOS_INTENTOS',
      });
    }

    res.on('finish', () => {
      if (res.statusCode === 401) {
        const previo = fallos.get(clave);
        if (!previo || previo.hasta <= ahora()) fallos.set(clave, { n: 1, hasta: ahora() + ventanaMs });
        else previo.n += 1;
        if (fallos.size > 5000) {
          for (const [k, v] of fallos) if (v.hasta <= ahora()) fallos.delete(k);
        }
      } else if (res.statusCode === 200) {
        fallos.delete(clave);
      }
    });
    return next();
  };
}

module.exports = { crearLimitadorLogin };
