'use strict';

const { Router } = require('express');

function crearReservaRoutes(reservaController, autenticar, requerirAdmin) {
  const router = Router();

  router.get('/', autenticar, reservaController.listar);
  router.get('/por-codigo', autenticar, reservaController.porCodigo); // antes de /:id
  router.get('/:id', autenticar, reservaController.obtener);
  router.get('/:id/qr', autenticar, reservaController.qr);
  router.post('/:id/enviar-correo', autenticar, reservaController.enviarCorreo);
  router.post('/', autenticar, reservaController.crear);

  router.patch('/:id/estado', autenticar, reservaController.actualizarEstado); // confirmar / cancelar / no_show
  router.post('/:id/checkin', autenticar, reservaController.checkin);
  router.post('/:id/checkout', autenticar, reservaController.checkout);

  router.delete('/:id', autenticar, requerirAdmin, reservaController.eliminar);

  return router;
}

module.exports = { crearReservaRoutes };
