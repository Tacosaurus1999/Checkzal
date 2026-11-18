'use strict';

/**
 * Establece (o restablece) la contraseña de un usuario existente.
 * El seed de schema.sql trae hashes de ejemplo que no sirven para iniciar sesión.
 *
 *   npm run usuario:password -- ana@casajaguar.mx MiClave123
 */
require('dotenv').config();

const { pool } = require('../src/infrastructure/db/pgConnection');
const { PgUsuarioRepository } = require('../src/infrastructure/repositories/PgUsuarioRepository');
const { BcryptCifradoService } = require('../src/infrastructure/security/BcryptCifradoService');
const { Usuario } = require('../src/domain/entities/Usuario');

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: npm run usuario:password -- <correo> <nueva_contraseña>');
    process.exit(1);
  }

  Usuario.validarPasswordPlano(password);

  const repo = new PgUsuarioRepository(pool);
  const usuario = await repo.buscarPorEmail(email);
  if (!usuario) {
    console.error(`No existe un usuario con el correo ${email}.`);
    process.exit(1);
  }

  await repo.actualizarPassword(usuario.id, await new BcryptCifradoService().hashear(password));
  console.log(`✅ Contraseña actualizada para ${usuario.email} (${usuario.rol}, ${usuario.hotelNombre}).`);
}

main()
  .catch((error) => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
