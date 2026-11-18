'use strict';

const { Huesped } = require('../../domain/entities/Huesped');
const { DomainError } = require('../../domain/errors/DomainError');

/** Caso de uso: ListGuests (Read, con búsqueda opcional por nombre/correo/teléfono/documento) */
class ListGuests {
  constructor(huespedRepository) {
    this.huespedRepository = huespedRepository;
  }

  async ejecutar({ q = '', limite = 100 } = {}) {
    const huespedes = await this.huespedRepository.listar({ q: q.trim(), limite });
    return huespedes.map((h) => h.toJSON());
  }
}

/** Caso de uso: GetGuest (Read) */
class GetGuest {
  constructor(huespedRepository) {
    this.huespedRepository = huespedRepository;
  }

  async ejecutar(id) {
    const huesped = await this.huespedRepository.buscarPorId(id);
    if (!huesped) {
      throw new DomainError('Huésped no encontrado.', 'HUESPED_NO_ENCONTRADO');
    }
    return huesped.toJSON();
  }
}

/** Caso de uso: CreateGuest (Create) */
class CreateGuest {
  constructor(huespedRepository) {
    this.huespedRepository = huespedRepository;
  }

  async ejecutar(datos) {
    const huesped = new Huesped(datos);
    const creado = await this.huespedRepository.crear(huesped);
    return creado.toJSON();
  }
}

/** Caso de uso: UpdateGuest (Update) */
class UpdateGuest {
  constructor(huespedRepository) {
    this.huespedRepository = huespedRepository;
  }

  async ejecutar(id, datos) {
    const existente = await this.huespedRepository.buscarPorId(id);
    if (!existente) {
      throw new DomainError('Huésped no encontrado.', 'HUESPED_NO_ENCONTRADO');
    }
    const base = existente.toJSON();
    // Registros antiguos con tipo de documento pero sin número: no bloquean la edición, se limpian.
    if (base.tipoDocumento && !base.numeroDocumento && datos.tipoDocumento === undefined) base.tipoDocumento = null;
    const actualizado = new Huesped({ ...base, ...datos, id });
    const guardado = await this.huespedRepository.actualizar(actualizado);
    return guardado.toJSON();
  }
}

/** Caso de uso: DeleteGuest (Delete) */
class DeleteGuest {
  constructor(huespedRepository) {
    this.huespedRepository = huespedRepository;
  }

  async ejecutar(id) {
    const existente = await this.huespedRepository.buscarPorId(id);
    if (!existente) {
      throw new DomainError('Huésped no encontrado.', 'HUESPED_NO_ENCONTRADO');
    }
    await this.huespedRepository.eliminar(id);
    return { id };
  }
}

module.exports = { ListGuests, GetGuest, CreateGuest, UpdateGuest, DeleteGuest };
