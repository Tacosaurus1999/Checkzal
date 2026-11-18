'use strict';

const { manejarError } = require('./authController');

function crearHuespedController({ listGuests, getGuest, createGuest, updateGuest, deleteGuest }) {
  return {
    async listar(req, res) {
      try {
        const { q, limite } = req.query;
        res.status(200).json(await listGuests.ejecutar({ q: q || '', limite }));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async obtener(req, res) {
      try {
        res.status(200).json(await getGuest.ejecutar(Number(req.params.id)));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async crear(req, res) {
      try {
        res.status(201).json(await createGuest.ejecutar(req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async actualizar(req, res) {
      try {
        res.status(200).json(await updateGuest.ejecutar(Number(req.params.id), req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async eliminar(req, res) {
      try {
        res.status(200).json(await deleteGuest.ejecutar(Number(req.params.id)));
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearHuespedController };
