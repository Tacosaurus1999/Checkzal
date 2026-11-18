'use strict';

const { manejarError } = require('./authController');

/** Habitaciones, tipos de habitación y consulta de disponibilidad. */
function crearHabitacionController({
  listRooms,
  createRoom,
  updateRoom,
  changeRoomStatus,
  deleteRoom,
  checkAvailability,
  listRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
}) {
  return {
    // ----- Habitaciones -----
    async listar(req, res) {
      try {
        res.status(200).json(await listRooms.ejecutar(req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async crear(req, res) {
      try {
        res.status(201).json(await createRoom.ejecutar(req.usuario.hotelId, req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async actualizar(req, res) {
      try {
        res
          .status(200)
          .json(await updateRoom.ejecutar(Number(req.params.id), req.usuario.hotelId, req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async cambiarEstado(req, res) {
      try {
        const habitacion = await changeRoomStatus.ejecutar(
          Number(req.params.id),
          req.usuario.hotelId,
          (req.body || {}).estado
        );
        res.status(200).json(habitacion);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async eliminar(req, res) {
      try {
        res.status(200).json(await deleteRoom.ejecutar(Number(req.params.id), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    /** GET /api/disponibilidad?entrada=YYYY-MM-DD&salida=YYYY-MM-DD */
    async disponibilidad(req, res) {
      try {
        const { entrada, salida } = req.query;
        res.status(200).json(await checkAvailability.ejecutar(req.usuario.hotelId, entrada, salida));
      } catch (error) {
        manejarError(error, res);
      }
    },

    // ----- Tipos de habitación -----
    async listarTipos(req, res) {
      try {
        res.status(200).json(await listRoomTypes.ejecutar(req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async crearTipo(req, res) {
      try {
        res.status(201).json(await createRoomType.ejecutar(req.usuario.hotelId, req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async actualizarTipo(req, res) {
      try {
        res
          .status(200)
          .json(await updateRoomType.ejecutar(Number(req.params.id), req.usuario.hotelId, req.body || {}));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async eliminarTipo(req, res) {
      try {
        res.status(200).json(await deleteRoomType.ejecutar(Number(req.params.id), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearHabitacionController };
