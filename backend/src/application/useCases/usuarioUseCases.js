'use strict';

const { Usuario } = require('../../domain/entities/Usuario');
const { DomainError } = require('../../domain/errors/DomainError');

/**
 * Caso de uso: LoginUser (Read + autenticación)
 * El token incluye hotelId: toda consulta posterior queda acotada a ese hotel.
 */
class LoginUser {
  constructor(usuarioRepository, cifradoService, tokenService) {
    this.usuarioRepository = usuarioRepository;
    this.cifradoService = cifradoService;
    this.tokenService = tokenService;
  }

  async ejecutar({ email, password }) {
    if (!email || !password) {
      throw new DomainError('Correo y contraseña son obligatorios.');
    }

    const usuario = await this.usuarioRepository.buscarPorEmail(email);
    if (!usuario) {
      throw new DomainError('Credenciales inválidas.', 'CREDENCIALES_INVALIDAS');
    }

    const passwordValido = await this.cifradoService.comparar(password, usuario.passwordHash);
    if (!passwordValido) {
      throw new DomainError('Credenciales inválidas.', 'CREDENCIALES_INVALIDAS');
    }

    if (!usuario.activo) {
      throw new DomainError('Tu usuario está desactivado. Contacta al administrador.', 'USUARIO_INACTIVO');
    }

    const token = this.tokenService.firmar({ id: usuario.id, rol: usuario.rol, hotelId: usuario.hotelId });

    return { usuario: usuario.toPublicJSON(), token };
  }
}

/** Caso de uso: GetUserProfile (Read del propio usuario autenticado) */
class GetUserProfile {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async ejecutar(usuarioId, hotelId) {
    const usuario = await this.usuarioRepository.buscarPorId(usuarioId, hotelId);
    if (!usuario) {
      throw new DomainError('Usuario no encontrado.', 'USUARIO_NO_ENCONTRADO');
    }
    return usuario.toPublicJSON();
  }
}

/** Caso de uso: ListUsers (Read administrativo, acotado al hotel) */
class ListUsers {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async ejecutar(hotelId) {
    const usuarios = await this.usuarioRepository.listarPorHotel(hotelId);
    return usuarios.map((u) => u.toPublicJSON());
  }
}

/**
 * Caso de uso: CreateUser (Create, uso administrativo).
 * No hay registro público: el personal lo da de alta un administrador.
 */
class CreateUser {
  constructor(usuarioRepository, cifradoService) {
    this.usuarioRepository = usuarioRepository;
    this.cifradoService = cifradoService;
  }

  async ejecutar(hotelId, { nombre, email, password, rol = 'recepcionista', telegramChatId = null }) {
    Usuario.validarEmail(email);
    Usuario.validarPasswordPlano(password);

    const existente = await this.usuarioRepository.buscarPorEmail(email);
    if (existente) {
      throw new DomainError('Ya existe un usuario con ese correo.', 'EMAIL_DUPLICADO');
    }

    const passwordHash = await this.cifradoService.hashear(password);
    const usuario = new Usuario({ hotelId, nombre, email, passwordHash, rol, telegramChatId });
    const creado = await this.usuarioRepository.crear(usuario);
    return creado.toPublicJSON();
  }
}

/** Caso de uso: UpdateUser (Update — datos, rol, estado y/o contraseña; uso administrativo) */
class UpdateUser {
  constructor(usuarioRepository, cifradoService) {
    this.usuarioRepository = usuarioRepository;
    this.cifradoService = cifradoService;
  }

  async ejecutar(id, hotelId, datos, solicitanteId) {
    const existente = await this.usuarioRepository.buscarPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Usuario no encontrado.', 'USUARIO_NO_ENCONTRADO');
    }

    const nuevoRol = datos.rol ?? existente.rol;
    const nuevoActivo = datos.activo ?? existente.activo;

    // Evita que el administrador se quite a sí mismo el acceso al panel.
    if (Number(solicitanteId) === Number(id) && (nuevoRol !== 'admin' || nuevoActivo === false)) {
      throw new DomainError(
        'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.',
        'AUTOEDICION_RESTRINGIDA'
      );
    }

    const nuevoEmail = datos.email ?? existente.email;
    if (nuevoEmail.toLowerCase() !== existente.email) {
      const duplicado = await this.usuarioRepository.buscarPorEmail(nuevoEmail);
      if (duplicado) {
        throw new DomainError('Ya existe un usuario con ese correo.', 'EMAIL_DUPLICADO');
      }
    }

    const actualizado = new Usuario({
      id: existente.id,
      hotelId: existente.hotelId,
      nombre: datos.nombre ?? existente.nombre,
      email: nuevoEmail,
      passwordHash: existente.passwordHash,
      rol: nuevoRol,
      telegramChatId: datos.telegramChatId !== undefined ? datos.telegramChatId : existente.telegramChatId,
      activo: nuevoActivo,
    });

    const guardado = await this.usuarioRepository.actualizar(actualizado);

    if (datos.password) {
      Usuario.validarPasswordPlano(datos.password);
      await this.usuarioRepository.actualizarPassword(id, await this.cifradoService.hashear(datos.password));
    }

    return guardado.toPublicJSON();
  }
}

/** Caso de uso: DeleteUser (Delete, uso administrativo) */
class DeleteUser {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async ejecutar(id, hotelId, solicitanteId) {
    if (solicitanteId && Number(solicitanteId) === Number(id)) {
      throw new DomainError('No puedes eliminar tu propia cuenta de administrador.', 'AUTOELIMINACION');
    }
    const existente = await this.usuarioRepository.buscarPorId(id, hotelId);
    if (!existente) {
      throw new DomainError('Usuario no encontrado.', 'USUARIO_NO_ENCONTRADO');
    }
    await this.usuarioRepository.eliminar(id, hotelId);
    return { id };
  }
}

module.exports = { LoginUser, GetUserProfile, ListUsers, CreateUser, UpdateUser, DeleteUser };
