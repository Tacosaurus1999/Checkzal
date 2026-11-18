'use strict';

const { Router } = require('express');

function crearHabitacionRoutes(habitacionController, autenticar, requerirGestion) {
  const router = Router();

  // Cualquier usuario autenticado del hotel
  router.get('/', autenticar, habitacionController.listar);
  router.patch('/:id/estado', autenticar, habitacionController.cambiarEstado); // limpieza ↔ disponible, etc.

  // Administración (admin / gerente)
  router.post('/', autenticar, requerirGestion, habitacionController.crear);
  router.put('/:id', autenticar, requerirGestion, habitacionController.actualizar);
  router.delete('/:id', autenticar, requerirGestion, habitacionController.eliminar);

  return router;
}

function crearTipoHabitacionRoutes(habitacionController, autenticar, requerirGestion) {
  const router = Router();

  router.get('/', autenticar, habitacionController.listarTipos);
  router.post('/', autenticar, requerirGestion, habitacionController.crearTipo);
  router.put('/:id', autenticar, requerirGestion, habitacionController.actualizarTipo);
  router.delete('/:id', autenticar, requerirGestion, habitacionController.eliminarTipo);

  return router;
}

module.exports = { crearHabitacionRoutes, crearTipoHabitacionRoutes };
