'use strict';

const { HuespedRepositoryPort } = require('../../application/ports/repositories');
const { Huesped } = require('../../domain/entities/Huesped');
const { TEXTO_HUESPED, terminosBusqueda, patronLike } = require('../db/busqueda');
const { traducirErrorPg } = require('../db/pgErrors');

function filaAHuesped(fila) {
  if (!fila) return null;
  return new Huesped({
    id: fila.id,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    email: fila.email,
    telefono: fila.telefono,
    tipoDocumento: fila.tipo_documento,
    numeroDocumento: fila.numero_documento,
    nacionalidad: fila.nacionalidad,
    fechaNacimiento: fila.fecha_nacimiento,
    telegramChatId: fila.telegram_chat_id,
    notas: fila.notas,
    creadoEn: fila.creado_en,
  });
}

const ERR_DOCUMENTO = {
  '23505:huespedes_pkey': {
    mensaje:
      'No se pudo asignar el identificador del huésped: la secuencia de la base de datos está desfasada. Ejecuta database/reparar_secuencias.sql.',
    codigo: 'SECUENCIA_DESFASADA',
  },
  '23505': {
    mensaje: 'Ya existe un huésped registrado con ese documento.',
    codigo: 'DOCUMENTO_DUPLICADO',
  },
};

class PgHuespedRepository extends HuespedRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listar({ q = '', limite = 100 } = {}) {
    const valores = [];
    const condiciones = terminosBusqueda(q).map((termino) => {
      valores.push(patronLike(termino));
      return `${TEXTO_HUESPED} LIKE $${valores.length}`;
    });
    valores.push(Math.min(Number(limite) || 100, 500));

    const { rows } = await this.pool.query(
      `SELECT * FROM huespedes
        ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
        ORDER BY apellidos, nombre
        LIMIT $${valores.length}`,
      valores
    );
    return rows.map(filaAHuesped);
  }

  async buscarPorId(id) {
    const { rows } = await this.pool.query('SELECT * FROM huespedes WHERE id = $1 LIMIT 1', [id]);
    return filaAHuesped(rows[0]);
  }

  async crear(huesped) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO huespedes
           (nombre, apellidos, email, telefono, tipo_documento, numero_documento,
            nacionalidad, fecha_nacimiento, telegram_chat_id, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          huesped.nombre,
          huesped.apellidos,
          huesped.email,
          huesped.telefono,
          huesped.tipoDocumento,
          huesped.numeroDocumento,
          huesped.nacionalidad,
          huesped.fechaNacimiento,
          huesped.telegramChatId,
          huesped.notas,
        ]
      );
      return filaAHuesped(rows[0]);
    } catch (error) {
      return traducirErrorPg(error, ERR_DOCUMENTO);
    }
  }

  async actualizar(huesped) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE huespedes
            SET nombre = $1, apellidos = $2, email = $3, telefono = $4,
                tipo_documento = $5, numero_documento = $6, nacionalidad = $7,
                fecha_nacimiento = $8, telegram_chat_id = $9, notas = $10
          WHERE id = $11
          RETURNING *`,
        [
          huesped.nombre,
          huesped.apellidos,
          huesped.email,
          huesped.telefono,
          huesped.tipoDocumento,
          huesped.numeroDocumento,
          huesped.nacionalidad,
          huesped.fechaNacimiento,
          huesped.telegramChatId,
          huesped.notas,
          huesped.id,
        ]
      );
      return filaAHuesped(rows[0]);
    } catch (error) {
      return traducirErrorPg(error, ERR_DOCUMENTO);
    }
  }

  async eliminar(id) {
    try {
      await this.pool.query('DELETE FROM huespedes WHERE id = $1', [id]);
    } catch (error) {
      traducirErrorPg(error, {
        '23503': {
          mensaje: 'El huésped tiene reservas registradas y no puede eliminarse.',
          codigo: 'HUESPED_CON_RESERVAS',
        },
      });
    }
  }
}

module.exports = { PgHuespedRepository };
