'use strict';

/**
 * Alta inicial para producción (sin los datos de ejemplo de schema.sql):
 * crea el hotel (si no existe uno con ese nombre) y su primer usuario administrador.
 *
 *   npm run admin:crear -- "Hotel Casa Jaguar" "San Cristóbal de las Casas" "Ana Morales" ana@hotel.mx 'Clave12345'
 */
require('dotenv').config();

const { pool } = require('../src/infrastructure/db/pgConnection');
const { PgUsuarioRepository } = require('../src/infrastructure/repositories/PgUsuarioRepository');
const { BcryptCifradoService } = require('../src/infrastructure/security/BcryptCifradoService');
const { Usuario } = require('../src/domain/entities/Usuario');

async function main() {
  const [hotelNombre, ciudad, nombre, email, password] = process.argv.slice(2);
  if (!hotelNombre || !ciudad || !nombre || !email || !password) {
    console.error('Uso: npm run admin:crear -- "<hotel>" "<ciudad>" "<nombre>" <correo> <contraseña>');
    process.exit(1);
  }

  Usuario.validarEmail(email);
  Usuario.validarPasswordPlano(password);

  const repo = new PgUsuarioRepository(pool);
  if (await repo.buscarPorEmail(email)) {
    console.error(`Ya existe un usuario con el correo ${email}. Usa "npm run usuario:password" para cambiar su contraseña.`);
    process.exit(1);
  }

  const existente = await pool.query('SELECT id FROM hoteles WHERE nombre = $1 LIMIT 1', [hotelNombre]);
  const hotelId = existente.rows[0]
    ? existente.rows[0].id
    : (await pool.query('INSERT INTO hoteles (nombre, ciudad) VALUES ($1, $2) RETURNING id', [hotelNombre, ciudad]))
        .rows[0].id;

  const passwordHash = await new BcryptCifradoService().hashear(password);
  const admin = await repo.crear(new Usuario({ hotelId, nombre, email, passwordHash, rol: 'admin' }));

  console.log(`✅ Administrador ${admin.email} creado en "${admin.hotelNombre}" (hotel_id=${hotelId}).`);
}

main()
  .catch((error) => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
