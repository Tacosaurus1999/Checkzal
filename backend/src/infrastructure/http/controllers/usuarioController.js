'use strict';

const { manejarError } = require('./authController');

/** CRUD administrativo de usuarios (personal del hotel). */
function crearUsuarioController({ listUsers, createUser, updateUser, deleteUser }) {
  return {
    async listar(req, res) {
      try {
        res.status(200).json(await listUsers.ejecutar(req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async crear(req, res) {
      try {
        const usuario = await createUser.ejecutar(req.usuario.hotelId, req.body || {});
        res.status(201).json(usuario);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async actualizar(req, res) {
      try {
        const usuario = await updateUser.ejecutar(
          Number(req.params.id),
          req.usuario.hotelId,
          req.body || {},
          req.usuario.id
        );
        res.status(200).json(usuario);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async eliminar(req, res) {
      try {
        const resultado = await deleteUser.ejecutar(Number(req.params.id), req.usuario.hotelId, req.usuario.id);
        res.status(200).json(resultado);
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearUsuarioController };
