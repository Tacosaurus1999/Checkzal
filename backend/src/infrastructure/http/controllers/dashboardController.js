'use strict';

const { manejarError } = require('./authController');

function crearDashboardController({ getDashboardSummary, getStatistics }) {
  return {
    async resumen(req, res) {
      try {
        res.status(200).json(await getDashboardSummary.ejecutar(req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async estadisticas(req, res) {
      try {
        const { granularidad, desde, hasta } = req.query;
        res.status(200).json(await getStatistics.ejecutar(req.usuario.hotelId, { granularidad, desde, hasta }));
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearDashboardController };
