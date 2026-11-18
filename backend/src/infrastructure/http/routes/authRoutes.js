'use strict';

const { Router } = require('express');

function crearAuthRoutes(authController, autenticar, limitarLogin = (_req, _res, next) => next()) {
  const router = Router();

  router.post('/login', limitarLogin, authController.login);
  router.get('/perfil', autenticar, authController.perfil);

  return router;
}

module.exports = { crearAuthRoutes };
