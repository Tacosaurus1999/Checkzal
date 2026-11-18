'use strict';

const { Router } = require('express');

function crearDashboardRoutes(dashboardController, autenticar, requerirAdmin) {
  const router = Router();

  router.get('/resumen', autenticar, dashboardController.resumen);
  // Estadísticas de negocio: solo administrador.
  router.get('/estadisticas', autenticar, requerirAdmin, dashboardController.estadisticas);

  return router;
}

module.exports = { crearDashboardRoutes };
