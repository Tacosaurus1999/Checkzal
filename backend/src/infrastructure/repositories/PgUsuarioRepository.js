'use strict';

const { UsuarioRepositoryPort } = require('../../application/ports/repositories');
const { Usuario } = require('../../domain/entities/Usuario');
const { traducirErrorPg } = require('../db/pgErrors');

const SELECT_USUARIO = `
  SELECT u.*, h.nombre AS hotel_nombre
    FROM usuarios u
    JOIN hoteles h ON h.id = u.hotel_id`;

function filaAUsuario(fila) {
  if (!fila) return null;
  return new Usuario({
    id: fila.id,
    hotelId: fila.hotel_id,
    hotelNombre: fila.hotel_nombre,
    nombre: fila.nombre,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    telegramChatId: fila.telegram_chat_id,
    activo: fila.activo,
    creadoEn: fila.creado_en,
  });
}

const ERR_EMAIL = { '23505': { mensaje: 'Ya existe un usuario con ese correo.', codigo: 'EMAIL_DUPLICADO' } };

class PgUsuarioRepository extends UsuarioRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async buscarPorEmail(email) {
    const { rows } = await this.pool.query(`${SELECT_USUARIO} WHERE u.email = $1 LIMIT 1`, [
      email.trim().toLowerCase(),
    ]);
    return filaAUsuario(rows[0]);
  }

  async buscarPorId(id, hotelId) {
    const { rows } = await this.pool.query(`${SELECT_USUARIO} WHERE u.id = $1 AND u.hotel_id = $2 LIMIT 1`, [
      id,
      hotelId,
    ]);
    return filaAUsuario(rows[0]);
  }

  async listarPorHotel(hotelId) {
    const { rows } = await this.pool.query(`${SELECT_USUARIO} WHERE u.hotel_id = $1 ORDER BY u.id ASC`, [hotelId]);
    return rows.map(filaAUsuario);
  }

  async crear(usuario) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO usuarios (hotel_id, nombre, email, password_hash, rol, telegram_chat_id, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          usuario.hotelId,
          usuario.nombre,
          usuario.email,
          usuario.passwordHash,
          usuario.rol,
          usuario.telegramChatId,
          usuario.activo,
        ]
      );
      return this.buscarPorId(rows[0].id, usuario.hotelId);
    } catch (error) {
      return traducirErrorPg(error, ERR_EMAIL);
    }
  }

  async actualizar(usuario) {
    try {
      await this.pool.query(
        `UPDATE usuarios
            SET nombre = $1, email = $2, rol = $3, telegram_chat_id = $4, activo = $5
          WHERE id = $6 AND hotel_id = $7`,
        [
          usuario.nombre,
          usuario.email,
          usuario.rol,
          usuario.telegramChatId,
          usuario.activo,
          usuario.id,
          usuario.hotelId,
        ]
      );
      return this.buscarPorId(usuario.id, usuario.hotelId);
    } catch (error) {
      return traducirErrorPg(error, ERR_EMAIL);
    }
  }

  async actualizarPassword(id, passwordHash) {
    await this.pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  }

  async eliminar(id, hotelId) {
    try {
      await this.pool.query('DELETE FROM usuarios WHERE id = $1 AND hotel_id = $2', [id, hotelId]);
    } catch (error) {
      traducirErrorPg(error, {
        '23503': {
          mensaje: 'El usuario tiene reservas o pagos registrados y no puede eliminarse. Desactívalo en su lugar.',
          codigo: 'USUARIO_CON_REGISTROS',
        },
      });
    }
  }
}

module.exports = { PgUsuarioRepository };
