'use strict';

const { Pool, types } = require('pg');

// DATE (OID 1082) se devuelve como texto 'YYYY-MM-DD' en lugar de un Date de JS:
// evita desfases por zona horaria en fechas de entrada/salida.
types.setTypeParser(1082, (valor) => valor);

/**
 * Pool de conexiones PostgreSQL, único para toda la aplicación.
 * Se configura vía variables de entorno (ver .env.example).
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotel_pms',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // falla rápido si PostgreSQL no responde
  statement_timeout: 15000, // ninguna consulta debe tardar más de 15 s
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = { pool };
