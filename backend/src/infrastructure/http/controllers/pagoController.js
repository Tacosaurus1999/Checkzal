'use strict';

const { manejarError } = require('./authController');

function crearPagoController({ registerPayment, listPayments }) {
  return {
    async listar(req, res) {
      try {
        res.status(200).json(await listPayments.ejecutar(Number(req.params.reservaId), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async crear(req, res) {
      try {
        const resultado = await registerPayment.ejecutar(
          Number(req.params.reservaId),
          req.usuario.hotelId,
          req.usuario.id,
          req.body || {}
        );
        res.status(201).json(resultado);
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearPagoController };
