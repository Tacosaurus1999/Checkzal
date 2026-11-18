'use strict';

const { DomainError } = require('../../../domain/errors/DomainError');

/** Traducción código de dominio -> código HTTP (por defecto 400). */
const CODIGOS_HTTP = {
  CREDENCIALES_INVALIDAS: 401,
  USUARIO_INACTIVO: 403,
  SIN_PERMISO: 403,

  USUARIO_NO_ENCONTRADO: 404,
  HABITACION_NO_ENCONTRADA: 404,
  TIPO_NO_ENCONTRADO: 404,
  HUESPED_NO_ENCONTRADO: 404,
  RESERVA_NO_ENCONTRADA: 404,

  EMAIL_DUPLICADO: 409,
  HABITACION_DUPLICADA: 409,
  TIPO_DUPLICADO: 409,
  DOCUMENTO_DUPLICADO: 409,
  AUTOELIMINACION: 409,
  AUTOEDICION_RESTRINGIDA: 409,
  USUARIO_CON_REGISTROS: 409,
  HABITACION_CON_RESERVAS: 409,
  HUESPED_CON_RESERVAS: 409,
  TIPO_EN_USO: 409,
  ESTADO_GESTIONADO_POR_ESTANCIA: 409,

  // Reservas
  SOBREVENTA: 409,
  HABITACION_NO_DISPONIBLE: 409,
  HABITACION_NO_LISTA: 409,
  CAPACIDAD_EXCEDIDA: 409,
  TRANSICION_INVALIDA: 409,
  RESERVA_NO_ELIMINABLE: 409,
  RESERVA_CERRADA: 409,
  SALDO_PENDIENTE: 409,
  PAGO_EXCEDE_SALDO: 409,
  FECHA_PASADA: 409,
  NO_SHOW_PREMATURO: 409,
  CHECKIN_FUERA_DE_FECHA: 409,
  DEMASIADOS_INTENTOS: 429,
  SECUENCIA_DESFASADA: 500,
  CODIGO_INVALIDO: 400,
  HUESPED_SIN_CORREO: 409,
  CORREO_NO_CONFIGURADO: 503,
  CORREO_FALLIDO: 502,
};

function crearAuthController({ loginUser, getUserProfile }) {
  return {
    async login(req, res) {
      try {
        const resultado = await loginUser.ejecutar(req.body || {});
        res.status(200).json(resultado);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async perfil(req, res) {
      try {
        const usuario = await getUserProfile.ejecutar(req.usuario.id, req.usuario.hotelId);
        res.status(200).json(usuario);
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

function manejarError(error, res) {
  if (error instanceof DomainError) {
    const codigoHttp = CODIGOS_HTTP[error.codigo] || 400;
    return res.status(codigoHttp).json({ error: error.message, codigo: error.codigo });
  }
  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = { crearAuthController, manejarError, CODIGOS_HTTP };
