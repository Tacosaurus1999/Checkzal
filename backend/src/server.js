'use strict';

require('dotenv').config();

const { crearApp } = require('./infrastructure/http/app');
const { pool } = require('./infrastructure/db/pgConnection');

const PUERTO = process.env.PORT || 4000;

const app = crearApp();

const servidor = app.listen(PUERTO, () => {
  console.log(`✅ API de Checkzal escuchando en http://localhost:${PUERTO}`);
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PUERTO} ya está en uso (¿hay otro "npm run dev" abierto?).`);
    console.error(`   Libéralo con:  fuser -k ${PUERTO}/tcp   o cambia PORT en backend/.env`);
  } else {
    console.error('❌ No se pudo iniciar el servidor:', error);
  }
  process.exit(1);
});

// Apagado ordenado (systemd envía SIGTERM; Ctrl+C envía SIGINT): termina peticiones y cierra el pool.
function apagar(senal) {
  console.log(`\n${senal} recibido: cerrando…`);
  const forzar = setTimeout(() => process.exit(1), 10000);
  forzar.unref();
  servidor.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
process.on('unhandledRejection', (motivo) => console.error('Promesa rechazada sin manejar:', motivo));
