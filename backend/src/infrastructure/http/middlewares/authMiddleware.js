'use strict';

/**
 * Valida el JWT y, si se entrega `usuarioRepository`, comprueba que la cuenta siga activa y toma el rol
 * ACTUAL de la base (una cuenta desactivada o degradada deja de funcionar sin esperar a que caduque el token).
 * El resultado se guarda `ttlMs` en memoria para no consultar la BD en cada petición.
 */
function crearAuthMiddleware(tokenService, { usuarioRepository = null, ttlMs = 30000, ahora = Date.now } = {}) {
  const cache = new Map(); // id -> { valor, hasta }

  async function cuentaVigente(payload) {
    if (!usuarioRepository) return payload;
    const guardado = cache.get(payload.id);
    if (guardado && guardado.hasta > ahora()) return guardado.valor;

    const usuario = await usuarioRepository.buscarPorId(payload.id, payload.hotelId);
    const valor = usuario && usuario.activo ? { ...payload, rol: usuario.rol } : null;
    if (cache.size >= 1000) cache.clear();
    cache.set(payload.id, { valor, hasta: ahora() + ttlMs });
    return valor;
  }

  return async function autenticar(req, res, next) {
    const cabecera = req.headers.authorization;
    if (!cabecera || !cabecera.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado.' });
    }

    let payload;
    try {
      payload = tokenService.verificar(cabecera.split(' ')[1]);
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    try {
      const usuario = await cuentaVigente(payload);
      if (!usuario) return res.status(401).json({ error: 'Tu cuenta ya no está activa.' });
      req.usuario = usuario; // { id, rol, hotelId }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Exige que el usuario autenticado tenga alguno de los roles indicados. */
function requerirRol(...rolesPermitidos) {
  return function (req, res, next) {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

const requerirAdmin = requerirRol('admin');
const requerirGestion = requerirRol('admin', 'gerente');

module.exports = { crearAuthMiddleware, requerirRol, requerirAdmin, requerirGestion };
