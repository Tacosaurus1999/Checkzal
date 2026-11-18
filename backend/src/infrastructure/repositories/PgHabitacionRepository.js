'use strict';

const { HabitacionRepositoryPort } = require('../../application/ports/repositories');
const { Habitacion, TipoHabitacion } = require('../../domain/entities/Habitacion');
const { traducirErrorPg } = require('../db/pgErrors');

const SELECT_HABITACION = `
  SELECT h.*,
         t.nombre      AS tipo_nombre,
         t.capacidad   AS tipo_capacidad,
         t.precio_base AS tipo_precio_base
    FROM habitaciones h
    JOIN tipos_habitacion t ON t.id = h.tipo_habitacion_id`;

function filaAHabitacion(fila) {
  if (!fila) return null;
  return new Habitacion({
    id: fila.id,
    hotelId: fila.hotel_id,
    tipoHabitacionId: fila.tipo_habitacion_id,
    numero: fila.numero,
    piso: fila.piso,
    estado: fila.estado,
    notas: fila.notas,
    activa: fila.activa,
    tipo: {
      nombre: fila.tipo_nombre,
      capacidad: Number(fila.tipo_capacidad),
      precioBase: Number(fila.tipo_precio_base),
    },
  });
}

function filaATipo(fila) {
  if (!fila) return null;
  return new TipoHabitacion({
    id: fila.id,
    hotelId: fila.hotel_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    capacidad: fila.capacidad,
    precioBase: fila.precio_base,
  });
}

const ERR_HABITACION = {
  '23505': { mensaje: 'Ya existe una habitación con ese número en este hotel.', codigo: 'HABITACION_DUPLICADA' },
  '23503': { mensaje: 'El tipo de habitación indicado no existe.', codigo: 'TIPO_NO_ENCONTRADO' },
};
const ERR_TIPO = {
  '23505': { mensaje: 'Ya existe un tipo de habitación con ese nombre.', codigo: 'TIPO_DUPLICADO' },
};

class PgHabitacionRepository extends HabitacionRepositoryPort {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    super();
    this.pool = pool;
  }

  // ----------------------------- Habitaciones -----------------------------

  async listar(hotelId) {
    const { rows } = await this.pool.query(
      `${SELECT_HABITACION} WHERE h.hotel_id = $1 ORDER BY h.piso, length(h.numero), h.numero`,
      [hotelId]
    );
    return rows.map(filaAHabitacion);
  }

  async buscarPorId(id, hotelId) {
    const { rows } = await this.pool.query(`${SELECT_HABITACION} WHERE h.id = $1 AND h.hotel_id = $2 LIMIT 1`, [
      id,
      hotelId,
    ]);
    return filaAHabitacion(rows[0]);
  }

  async crear(habitacion) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO habitaciones (hotel_id, tipo_habitacion_id, numero, piso, estado, notas, activa)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          habitacion.hotelId,
          habitacion.tipoHabitacionId,
          habitacion.numero,
          habitacion.piso,
          habitacion.estado,
          habitacion.notas,
          habitacion.activa,
        ]
      );
      return this.buscarPorId(rows[0].id, habitacion.hotelId);
    } catch (error) {
      return traducirErrorPg(error, ERR_HABITACION);
    }
  }

  async actualizar(habitacion) {
    try {
      await this.pool.query(
        `UPDATE habitaciones
            SET tipo_habitacion_id = $1, numero = $2, piso = $3, notas = $4, activa = $5
          WHERE id = $6 AND hotel_id = $7`,
        [
          habitacion.tipoHabitacionId,
          habitacion.numero,
          habitacion.piso,
          habitacion.notas,
          habitacion.activa,
          habitacion.id,
          habitacion.hotelId,
        ]
      );
      return this.buscarPorId(habitacion.id, habitacion.hotelId);
    } catch (error) {
      return traducirErrorPg(error, ERR_HABITACION);
    }
  }

  async actualizarEstado(id, hotelId, estado) {
    await this.pool.query('UPDATE habitaciones SET estado = $1 WHERE id = $2 AND hotel_id = $3', [
      estado,
      id,
      hotelId,
    ]);
    return this.buscarPorId(id, hotelId);
  }

  async eliminar(id, hotelId) {
    try {
      await this.pool.query('DELETE FROM habitaciones WHERE id = $1 AND hotel_id = $2', [id, hotelId]);
    } catch (error) {
      traducirErrorPg(error, {
        '23503': {
          mensaje: 'La habitación tiene reservas asociadas y no puede eliminarse. Márcala como inactiva en su lugar.',
          codigo: 'HABITACION_CON_RESERVAS',
        },
      });
    }
  }

  /** Consume la función SQL habitaciones_disponibles(hotel, entrada, salida). */
  async listarDisponibles(hotelId, entrada, salida) {
    const { rows } = await this.pool.query('SELECT * FROM habitaciones_disponibles($1, $2::date, $3::date)', [
      hotelId,
      entrada,
      salida,
    ]);
    return rows.map((fila) => ({
      habitacionId: fila.habitacion_id,
      numero: fila.numero,
      tipo: fila.tipo,
      capacidad: Number(fila.capacidad),
      precioBase: Number(fila.precio_base),
    }));
  }

  // --------------------------- Tipos de habitación ---------------------------

  async listarTipos(hotelId) {
    const { rows } = await this.pool.query('SELECT * FROM tipos_habitacion WHERE hotel_id = $1 ORDER BY precio_base', [
      hotelId,
    ]);
    return rows.map(filaATipo);
  }

  async buscarTipoPorId(id, hotelId) {
    const { rows } = await this.pool.query('SELECT * FROM tipos_habitacion WHERE id = $1 AND hotel_id = $2 LIMIT 1', [
      id,
      hotelId,
    ]);
    return filaATipo(rows[0]);
  }

  async crearTipo(tipo) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO tipos_habitacion (hotel_id, nombre, descripcion, capacidad, precio_base)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tipo.hotelId, tipo.nombre, tipo.descripcion, tipo.capacidad, tipo.precioBase]
      );
      return filaATipo(rows[0]);
    } catch (error) {
      return traducirErrorPg(error, ERR_TIPO);
    }
  }

  async actualizarTipo(tipo) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE tipos_habitacion
            SET nombre = $1, descripcion = $2, capacidad = $3, precio_base = $4
          WHERE id = $5 AND hotel_id = $6
          RETURNING *`,
        [tipo.nombre, tipo.descripcion, tipo.capacidad, tipo.precioBase, tipo.id, tipo.hotelId]
      );
      return filaATipo(rows[0]);
    } catch (error) {
      return traducirErrorPg(error, ERR_TIPO);
    }
  }

  async eliminarTipo(id, hotelId) {
    try {
      await this.pool.query('DELETE FROM tipos_habitacion WHERE id = $1 AND hotel_id = $2', [id, hotelId]);
    } catch (error) {
      traducirErrorPg(error, {
        '23503': {
          mensaje: 'Hay habitaciones de este tipo; reasígnalas o elimínalas primero.',
          codigo: 'TIPO_EN_USO',
        },
      });
    }
  }
}

module.exports = { PgHabitacionRepository };
