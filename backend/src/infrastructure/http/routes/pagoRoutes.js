'use strict';

const { Router } = require('express');

/** Se monta en /api/reservas/:reservaId/pagos */
function crearPagoRoutes(pagoController, autenticar) {
  const router = Router({ mergeParams: true });

  router.get('/', autenticar, pagoController.listar);
  router.post('/', autenticar, pagoController.crear);

  return router;
}

module.exports = { crearPagoRoutes };
