'use strict';

const { Habitacion, TipoHabitacion } = require('../../domain/entities/Habitacion');
const { validarRangoFechas } = require('../../domain/entities/Reserva');
const { DomainError } = require('../../domain/errors/DomainError');

// ---------------------------------------------------------------------
// Habitaciones
// ---------------------------------------------------------------------

/** Caso de uso: ListRooms (Read — grid del Dashboard y módulo de habitaciones) */
class ListRooms {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(hotelId) {
    const habitaciones = await this.habitacionRepository.listar(hotelId);
    return habitaciones.map((h) => h.toJSON());
  }
}

/** Caso de uso: CreateRoom (Create) */
class CreateRoom {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(hotelId, { tipoHabitacionId, numero, piso, notas, activa }) {
    const tipo = await this.habitacionRepository.buscarTipoPorId(tipoHabitacionId, hotelId);
    if (!tipo) {
      throw new DomainError('El tipo de habitación no existe en este hotel.', 'TIPO_NO_ENCONTRADO');
    }
    const habitacion = new Habitacion({ hotelId, tipoHabitacionId, numero, piso, notas, activa });
    const creada = await this.habitacionRepository.crear(habitacion);
    return creada.toJSON();
  }
}

/** Caso de uso: UpdateRoom (Update — datos generales, no el estado operativo) */
class UpdateRoom {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(id, hotelId, datos) {
    const existente = await this.habitacionRepository.buscarPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Habitación no encontrada.', 'HABITACION_NO_ENCONTRADA');
    }

    const tipoHabitacionId = datos.tipoHabitacionId ?? existente.tipoHabitacionId;
    if (tipoHabitacionId !== existente.tipoHabitacionId) {
      const tipo = await this.habitacionRepository.buscarTipoPorId(tipoHabitacionId, hotelId);
      if (!tipo) {
        throw new DomainError('El tipo de habitación no existe en este hotel.', 'TIPO_NO_ENCONTRADO');
      }
    }

    const actualizada = new Habitacion({
      id: existente.id,
      hotelId,
      tipoHabitacionId,
      numero: datos.numero ?? existente.numero,
      piso: datos.piso ?? existente.piso,
      estado: existente.estado,
      notas: datos.notas !== undefined ? datos.notas : existente.notas,
      activa: datos.activa ?? existente.activa,
    });

    const guardada = await this.habitacionRepository.actualizar(actualizada);
    return guardada.toJSON();
  }
}

/** Caso de uso: ChangeRoomStatus (Update del estado operativo: limpieza, mantenimiento…) */
class ChangeRoomStatus {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(id, hotelId, nuevoEstado) {
    const habitacion = await this.habitacionRepository.buscarPorId(id, hotelId);
    if (!habitacion) {
      throw new DomainError('Habitación no encontrada.', 'HABITACION_NO_ENCONTRADA');
    }
    habitacion.cambiarEstado(nuevoEstado); // valida la regla en el dominio
    const actualizada = await this.habitacionRepository.actualizarEstado(id, hotelId, nuevoEstado);
    return actualizada.toJSON();
  }
}

/** Caso de uso: DeleteRoom (Delete) */
class DeleteRoom {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(id, hotelId) {
    const existente = await this.habitacionRepository.buscarPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Habitación no encontrada.', 'HABITACION_NO_ENCONTRADA');
    }
    await this.habitacionRepository.eliminar(id, hotelId);
    return { id };
  }
}

/** Caso de uso: CheckAvailability (consume la función SQL habitaciones_disponibles) */
class CheckAvailability {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(hotelId, entrada, salida) {
    const noches = validarRangoFechas(entrada, salida);
    const disponibles = await this.habitacionRepository.listarDisponibles(hotelId, entrada, salida);
    return { entrada, salida, noches, disponibles };
  }
}

// ---------------------------------------------------------------------
// Tipos de habitación
// ---------------------------------------------------------------------

class ListRoomTypes {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(hotelId) {
    const tipos = await this.habitacionRepository.listarTipos(hotelId);
    return tipos.map((t) => t.toJSON());
  }
}

class CreateRoomType {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(hotelId, { nombre, descripcion, capacidad, precioBase }) {
    const tipo = new TipoHabitacion({ hotelId, nombre, descripcion, capacidad, precioBase });
    const creado = await this.habitacionRepository.crearTipo(tipo);
    return creado.toJSON();
  }
}

class UpdateRoomType {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(id, hotelId, datos) {
    const existente = await this.habitacionRepository.buscarTipoPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Tipo de habitación no encontrado.', 'TIPO_NO_ENCONTRADO');
    }
    const actualizado = new TipoHabitacion({
      id,
      hotelId,
      nombre: datos.nombre ?? existente.nombre,
      descripcion: datos.descripcion !== undefined ? datos.descripcion : existente.descripcion,
      capacidad: datos.capacidad ?? existente.capacidad,
      precioBase: datos.precioBase ?? existente.precioBase,
    });
    const guardado = await this.habitacionRepository.actualizarTipo(actualizado);
    return guardado.toJSON();
  }
}

class DeleteRoomType {
  constructor(habitacionRepository) {
    this.habitacionRepository = habitacionRepository;
  }

  async ejecutar(id, hotelId) {
    const existente = await this.habitacionRepository.buscarTipoPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Tipo de habitación no encontrado.', 'TIPO_NO_ENCONTRADO');
    }
    await this.habitacionRepository.eliminarTipo(id, hotelId);
    return { id };
  }
}

module.exports = {
  ListRooms,
  CreateRoom,
  UpdateRoom,
  ChangeRoomStatus,
  DeleteRoom,
  CheckAvailability,
  ListRoomTypes,
  CreateRoomType,
  UpdateRoomType,
  DeleteRoomType,
};
