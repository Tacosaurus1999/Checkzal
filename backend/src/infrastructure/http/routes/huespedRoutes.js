'use strict';

const { Router } = require('express');

function crearHuespedRoutes(huespedController, autenticar, requerirGestion) {
  const router = Router();

  router.get('/', autenticar, huespedController.listar);
  router.get('/:id', autenticar, huespedController.obtener);
  router.post('/', autenticar, huespedController.crear);
  router.put('/:id', autenticar, huespedController.actualizar);
  router.delete('/:id', autenticar, requerirGestion, huespedController.eliminar);

  return router;
}

module.exports = { crearHuespedRoutes };
