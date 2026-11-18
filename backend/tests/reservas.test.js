'use strict';

/**
 * Pruebas sin red ni base de datos:
 *  1. Las reglas de dominio (fechas, total, máquina de estados).
 *  2. Los casos de uso solo dependen de PUERTOS (se prueban con repositorios en memoria).
 * Ejecutar: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { Reserva, ReservaHabitacion, validarRangoFechas } = require('../src/domain/entities/Reserva');
const { Habitacion } = require('../src/domain/entities/Habitacion');
const { Pago } = require('../src/domain/entities/Pago');
const { DomainError } = require('../src/domain/errors/DomainError');
const {
  CreateReservation,
  CheckOutReservation,
  UpdateReservationStatus,
  CheckInReservation,
} = require('../src/application/useCases/reservaUseCases');
const { RegisterPayment } = require('../src/application/useCases/pagoUseCases');

// ------------------------------- Dominio -------------------------------

test('validarRangoFechas calcula noches y rechaza rangos inválidos', () => {
  assert.equal(validarRangoFechas('2026-12-20', '2026-12-23'), 3);
  assert.throws(() => validarRangoFechas('2026-12-23', '2026-12-23'), DomainError);
  assert.throws(() => validarRangoFechas('2026-12-24', '2026-12-23'), DomainError);
  assert.throws(() => validarRangoFechas('2026-02-30', '2026-03-02'), DomainError);
  assert.throws(() => validarRangoFechas('20-12-2026', '2026-12-23'), DomainError);
});

test('Reserva.calcularTotal = suma(precio_noche) × noches', () => {
  const reserva = new Reserva({
    hotelId: 1,
    huespedId: 1,
    fechaEntrada: '2026-12-20',
    fechaSalida: '2026-12-23',
    habitaciones: [
      { habitacionId: 1, precioNoche: 850 },
      { habitacionId: 2, precioNoche: 1800 },
    ],
  });
  assert.equal(reserva.noches, 3);
  assert.equal(reserva.calcularTotal(), 7950);
  assert.equal(reserva.total, 7950);
});

test('Reserva exige al menos una habitación y un adulto', () => {
  const base = { hotelId: 1, huespedId: 1, fechaEntrada: '2026-12-20', fechaSalida: '2026-12-21' };
  assert.throws(() => new Reserva({ ...base, habitaciones: [] }), DomainError);
  assert.throws(
    () => new Reserva({ ...base, numAdultos: 0, habitaciones: [{ habitacionId: 1, precioNoche: 1 }] }),
    DomainError
  );
});

test('máquina de estados de la reserva', () => {
  const nueva = (estado) =>
    new Reserva({
      hotelId: 1,
      huespedId: 1,
      fechaEntrada: '2026-12-20',
      fechaSalida: '2026-12-21',
      estado,
      habitaciones: [{ habitacionId: 1, precioNoche: 100 }],
    });

  const r = nueva('confirmada');
  r.cambiarEstado('checkin');
  r.cambiarEstado('checkout');
  assert.equal(r.estado, 'checkout');

  assert.throws(() => nueva('checkout').cambiarEstado('checkin'), { codigo: 'TRANSICION_INVALIDA' });
  assert.throws(() => nueva('cancelada').cambiarEstado('confirmada'), { codigo: 'TRANSICION_INVALIDA' });
  assert.throws(() => nueva('checkin').cambiarEstado('cancelada'), { codigo: 'TRANSICION_INVALIDA' });
  assert.throws(() => nueva('confirmada').cambiarEstado('checkout'), { codigo: 'TRANSICION_INVALIDA' });
});

test('Habitacion: "ocupada" solo la gestiona la estancia', () => {
  const h = new Habitacion({ hotelId: 1, tipoHabitacionId: 1, numero: '101' });
  h.cambiarEstado('limpieza');
  assert.equal(h.estado, 'limpieza');
  assert.throws(() => h.cambiarEstado('ocupada'), { codigo: 'ESTADO_GESTIONADO_POR_ESTANCIA' });
});

test('Pago valida monto y método', () => {
  assert.throws(() => new Pago({ reservaId: 1, monto: 0, metodo: 'efectivo' }), DomainError);
  assert.throws(() => new Pago({ reservaId: 1, monto: 10, metodo: 'bitcoin' }), DomainError);
  assert.equal(new Pago({ reservaId: 1, monto: '10.456', metodo: 'tarjeta' }).monto, 10.46);
});

// --------------------------- Casos de uso (fakes) ---------------------------

function crearEscenario({ disponibles = [1, 2], habitaciones } = {}) {
  const catalogo = habitaciones || {
    1: new Habitacion({ id: 1, hotelId: 1, tipoHabitacionId: 1, numero: '101', tipo: { nombre: 'Sencilla', capacidad: 2, precioBase: 850 } }),
    2: new Habitacion({ id: 2, hotelId: 1, tipoHabitacionId: 2, numero: '201', tipo: { nombre: 'Suite', capacidad: 4, precioBase: 1800 } }),
  };
  const creadas = [];
  const reservaRepo = {
    crear: async (r) => {
      creadas.push(r);
      r.id = 10;
      return r;
    },
  };
  const habitacionRepo = {
    listarDisponibles: async () => disponibles.map((id) => ({ habitacionId: id })),
    buscarPorId: async (id) => catalogo[id] || null,
  };
  const huespedRepo = { buscarPorId: async (id) => (id === 1 ? { id: 1 } : null) };
  return { creadas, caso: new CreateReservation(reservaRepo, habitacionRepo, huespedRepo, { hoy: () => '2026-11-01' }) };
}

const SOLICITANTE = { id: 1, rol: 'recepcionista', hotelId: 1 };
const DATOS = {
  huespedId: 1,
  fechaEntrada: '2026-12-20',
  fechaSalida: '2026-12-23',
  numAdultos: 2,
  habitaciones: [{ habitacionId: 1 }],
};

test('CreateReservation usa el precio base y calcula el total', async () => {
  const { caso, creadas } = crearEscenario();
  const reserva = await caso.ejecutar(SOLICITANTE, DATOS);
  assert.equal(reserva.total, 2550);
  assert.equal(creadas[0].habitaciones[0].precioNoche, 850);
});

test('CreateReservation rechaza habitaciones no disponibles', async () => {
  const { caso } = crearEscenario({ disponibles: [2] });
  await assert.rejects(() => caso.ejecutar(SOLICITANTE, DATOS), { codigo: 'HABITACION_NO_DISPONIBLE' });
});

test('CreateReservation rechaza huésped inexistente y exceso de capacidad', async () => {
  const { caso } = crearEscenario();
  await assert.rejects(() => caso.ejecutar(SOLICITANTE, { ...DATOS, huespedId: 99 }), {
    codigo: 'HUESPED_NO_ENCONTRADO',
  });
  await assert.rejects(() => caso.ejecutar(SOLICITANTE, { ...DATOS, numAdultos: 3 }), {
    codigo: 'CAPACIDAD_EXCEDIDA',
  });
});

test('CreateReservation: solo admin/gerente modifican el precio por noche', async () => {
  const { caso } = crearEscenario();
  const conPrecio = { ...DATOS, habitaciones: [{ habitacionId: 1, precioNoche: 500 }] };
  await assert.rejects(() => caso.ejecutar(SOLICITANTE, conPrecio), { codigo: 'SIN_PERMISO' });
  const reserva = await caso.ejecutar({ ...SOLICITANTE, rol: 'gerente' }, conPrecio);
  assert.equal(reserva.total, 1500);
});

test('CreateReservation rechaza habitaciones repetidas', async () => {
  const { caso } = crearEscenario();
  await assert.rejects(
    () => caso.ejecutar(SOLICITANTE, { ...DATOS, habitaciones: [{ habitacionId: 1 }, { habitacionId: 1 }] }),
    DomainError
  );
});

function reservaEnCheckin() {
  return new Reserva({
    id: 5,
    hotelId: 1,
    huespedId: 1,
    fechaEntrada: '2026-12-20',
    fechaSalida: '2026-12-21',
    estado: 'checkin',
    habitaciones: [{ habitacionId: 1, precioNoche: 100 }],
  });
}

test('CheckOutReservation bloquea saldo pendiente salvo admin/gerente con forzar', async () => {
  let checkouts = 0;
  const reservaRepo = {
    buscarPorId: async () => reservaEnCheckin(),
    registrarCheckout: async () => {
      checkouts += 1;
      return reservaEnCheckin();
    },
  };
  const pagoRepo = { obtenerSaldo: async () => ({ totalAPagar: 100, totalPagado: 0, saldo: 100 }) };
  const caso = new CheckOutReservation(reservaRepo, pagoRepo);

  await assert.rejects(() => caso.ejecutar(5, 1, SOLICITANTE), { codigo: 'SALDO_PENDIENTE' });
  await assert.rejects(() => caso.ejecutar(5, 1, SOLICITANTE, { forzar: true }), { codigo: 'SIN_PERMISO' });
  assert.equal(checkouts, 0);

  await caso.ejecutar(5, 1, { ...SOLICITANTE, rol: 'admin' }, { forzar: true });
  assert.equal(checkouts, 1);
});

test('UpdateReservationStatus valida la transición y los estados permitidos', async () => {
  const reservaRepo = {
    buscarPorId: async () => reservaEnCheckin(),
    actualizarEstado: async () => reservaEnCheckin(),
  };
  const caso = new UpdateReservationStatus(reservaRepo);
  await assert.rejects(() => caso.ejecutar(5, 1, 'cancelada'), { codigo: 'TRANSICION_INVALIDA' });
  await assert.rejects(() => caso.ejecutar(5, 1, 'checkin'), { codigo: 'ESTADO_NO_PERMITIDO' });
});

test('RegisterPayment rechaza pagos mayores al saldo o en reservas canceladas', async () => {
  const creados = [];
  const pagoRepo = {
    obtenerSaldo: async () => ({ totalAPagar: 1000, totalPagado: 400, saldo: 600 }),
    crear: async (p) => {
      creados.push(p);
      return p;
    },
  };
  const reservaConEstado = (estado) => ({ buscarPorId: async () => ({ id: 1, estado }) });

  const caso = new RegisterPayment(pagoRepo, reservaConEstado('confirmada'));
  await assert.rejects(() => caso.ejecutar(1, 1, 1, { monto: 601, metodo: 'efectivo' }), {
    codigo: 'PAGO_EXCEDE_SALDO',
  });
  await caso.ejecutar(1, 1, 1, { monto: 600, metodo: 'efectivo' });
  assert.equal(creados.length, 1);

  const cancelada = new RegisterPayment(pagoRepo, reservaConEstado('cancelada'));
  await assert.rejects(() => cancelada.ejecutar(1, 1, 1, { monto: 10, metodo: 'efectivo' }), {
    codigo: 'RESERVA_CERRADA',
  });
});

// ------------------------------- Estadísticas (solo admin) -------------------------------

const { GetStatistics, inicioPeriodo, sumarPeriodos } = require('../src/application/useCases/reporteUseCases');

test('inicioPeriodo / sumarPeriodos: lunes, día 1 y 1 de enero', () => {
  assert.equal(inicioPeriodo('week', '2026-11-04'), '2026-11-02'); // miércoles → lunes
  assert.equal(inicioPeriodo('month', '2026-11-04'), '2026-11-01');
  assert.equal(inicioPeriodo('year', '2026-11-04'), '2026-01-01');
  assert.equal(sumarPeriodos('month', '2026-11-01', 2), '2027-01-01');
  assert.equal(sumarPeriodos('week', '2026-11-02', -1), '2026-10-26');
});

test('GetStatistics: ventana por defecto, totales y tasas', async () => {
  let recibido;
  const repo = {
    async estadisticas(hotelId, filtros) {
      recibido = { hotelId, ...filtros };
      return [
        { periodo: '2026-10-01', reservas: 10, huespedes: 9, personas: 22, llegaron: 6, canceladas: 2, noShow: 0, porLlegar: 2, reservado: 8000, ingresos: 5000 },
        { periodo: '2026-11-01', reservas: 4, huespedes: 4, personas: 8, llegaron: 2, canceladas: 1, noShow: 1, porLlegar: 0, reservado: 3000, ingresos: 2500 },
      ];
    },
  };
  const uc = new GetStatistics(repo, { hoy: () => '2026-11-04' });
  const r = await uc.ejecutar(7, { granularidad: 'mes' });

  assert.equal(recibido.hotelId, 7);
  assert.equal(recibido.unidad, 'month');
  assert.equal(recibido.desde, '2025-12-01');
  assert.equal(recibido.hasta, '2027-01-31'); // incluye 2 meses hacia adelante
  assert.equal(r.totales.reservas, 14);
  assert.equal(r.totales.ingresos, 7500);
  assert.equal(r.totales.llegaron, 8);
  assert.equal(r.totales.tasaLlegada, 66.7); // 8 / (8 + 3 + 1)
  assert.equal(r.totales.tasaCancelacion, 25); // 3 / 12
});

test('GetStatistics rechaza granularidad, fechas y rangos inválidos', async () => {
  const uc = new GetStatistics({ estadisticas: async () => [] }, { hoy: () => '2026-11-04' });
  await assert.rejects(uc.ejecutar(1, { granularidad: 'dia' }), DomainError);
  await assert.rejects(uc.ejecutar(1, { granularidad: 'mes', desde: '2026-13-01' }), DomainError);
  await assert.rejects(uc.ejecutar(1, { granularidad: 'mes', desde: '2026-05-01', hasta: '2026-01-01' }), DomainError);
  await assert.rejects(uc.ejecutar(1, { granularidad: 'semana', desde: '2000-01-01', hasta: '2026-01-01' }), DomainError);
});

// ------------------------- Correcciones: reglas de fechas -------------------------

test('CreateReservation rechaza entradas en el pasado (salvo admin/gerente)', async () => {
  const { caso } = crearEscenario(); // "hoy" = 2026-11-01
  const pasada = { ...DATOS, fechaEntrada: '2026-10-30', fechaSalida: '2026-11-02' };
  await assert.rejects(() => caso.ejecutar(SOLICITANTE, pasada), { codigo: 'FECHA_PASADA' });
  // Hoy mismo sí se permite
  await caso.ejecutar(SOLICITANTE, { ...DATOS, fechaEntrada: '2026-11-01', fechaSalida: '2026-11-02' });
  // Un gerente puede registrar reservas atrasadas
  await caso.ejecutar({ ...SOLICITANTE, rol: 'gerente' }, pasada);
});

function reservaDe(estado, entrada, salida) {
  return new Reserva({ id: 5, hotelId: 1, huespedId: 1, fechaEntrada: entrada, fechaSalida: salida, estado,
    habitaciones: [{ habitacionId: 1, precioNoche: 100 }] });
}

test('No-show no puede marcarse antes de la fecha de llegada', async () => {
  const repo = {
    buscarPorId: async () => reservaDe('confirmada', '2026-12-20', '2026-12-23'),
    actualizarEstado: async () => reservaDe('no_show', '2026-12-20', '2026-12-23'),
  };
  await assert.rejects(() => new UpdateReservationStatus(repo, { hoy: () => '2026-11-01' }).ejecutar(5, 1, 'no_show'),
    { codigo: 'NO_SHOW_PREMATURO' });
  const ok = await new UpdateReservationStatus(repo, { hoy: () => '2026-12-20' }).ejecutar(5, 1, 'no_show');
  assert.equal(ok.estado, 'no_show');
  // cancelar sí se puede en cualquier momento
  await new UpdateReservationStatus(repo, { hoy: () => '2026-11-01' }).ejecutar(5, 1, 'cancelada');
});

test('Check-in solo entre la fecha de llegada y la de salida', async () => {
  const repo = {
    buscarPorId: async () => reservaDe('confirmada', '2026-12-20', '2026-12-23'),
    registrarCheckin: async () => reservaDe('checkin', '2026-12-20', '2026-12-23'),
  };
  const habitaciones = { buscarPorId: async () => ({ id: 1, estado: 'disponible' }) };
  const con = (hoy) => new CheckInReservation(repo, habitaciones, { hoy: () => hoy });
  await assert.rejects(() => con('2026-12-19').ejecutar(5, 1, 1), { codigo: 'CHECKIN_FUERA_DE_FECHA' });
  await assert.rejects(() => con('2026-12-23').ejecutar(5, 1, 1), { codigo: 'CHECKIN_FUERA_DE_FECHA' });
  assert.equal((await con('2026-12-20').ejecutar(5, 1, 1)).estado, 'checkin');
  assert.equal((await con('2026-12-22').ejecutar(5, 1, 1)).estado, 'checkin');
});

// ------------------------- Correcciones: seguridad de la API -------------------------

const { crearAuthMiddleware } = require('../src/infrastructure/http/middlewares/authMiddleware');
const { crearLimitadorLogin } = require('../src/infrastructure/http/middlewares/limitarIntentos');
const { escaparLike } = require('../src/infrastructure/db/like');

function respuestaFalsa() {
  const res = { cabeceras: {}, handlers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  res.set = (k, v) => { res.cabeceras[k] = v; return res; };
  res.on = (ev, fn) => { res.handlers[ev] = fn; };
  return res;
}
const tokens = { verificar: (t) => { if (t !== 'bueno') throw new Error('mal'); return { id: 7, rol: 'recepcionista', hotelId: 1 }; } };
const pedir = async (mw, token = 'bueno') => {
  const req = { headers: { authorization: `Bearer ${token}` } }; const res = respuestaFalsa(); let siguio = false;
  await mw(req, res, () => { siguio = true; });
  return { req, res, siguio };
};

test('autenticar: cuenta desactivada o inexistente pierde el acceso aunque el token sea válido', async () => {
  let usuario = { id: 7, activo: true, rol: 'recepcionista' };
  let consultas = 0;
  let reloj = 0;
  const repo = { buscarPorId: async () => { consultas += 1; return usuario; } };
  const mw = crearAuthMiddleware(tokens, { usuarioRepository: repo, ttlMs: 1000, ahora: () => reloj });

  assert.equal((await pedir(mw)).siguio, true);
  await pedir(mw);
  assert.equal(consultas, 1, 'la segunda petición sale de la caché');

  usuario = { id: 7, activo: false, rol: 'recepcionista' };
  reloj = 2000; // caduca la caché
  const r = await pedir(mw);
  assert.equal(r.siguio, false);
  assert.equal(r.res.statusCode, 401);

  usuario = null; reloj = 4000;
  assert.equal((await pedir(mw)).res.statusCode, 401);
});

test('autenticar: usa el rol actual de la base y rechaza tokens inválidos', async () => {
  const repo = { buscarPorId: async () => ({ id: 7, activo: true, rol: 'gerente' }) };
  const mw = crearAuthMiddleware(tokens, { usuarioRepository: repo });
  const { req, siguio } = await pedir(mw);
  assert.equal(siguio, true);
  assert.equal(req.usuario.rol, 'gerente');
  assert.equal((await pedir(mw, 'falso')).res.statusCode, 401);
  const sinCabecera = respuestaFalsa();
  await mw({ headers: {} }, sinCabecera, () => {});
  assert.equal(sinCabecera.statusCode, 401);
});

test('limitarLogin: bloquea tras 3 fallos y se reinicia con un acierto', () => {
  let reloj = 0;
  const limitar = crearLimitadorLogin({ maxIntentos: 3, ventanaMs: 1000, ahora: () => reloj });
  const intento = (estado, correo = 'a@b.co') => {
    const req = { ip: '1.1.1.1', body: { email: correo } }; const res = respuestaFalsa(); let paso = false;
    limitar(req, res, () => { paso = true; });
    if (paso) { res.statusCode = estado; res.handlers.finish(); }
    return { paso, res };
  };
  intento(401); intento(401); intento(401);
  const bloqueado = intento(401);
  assert.equal(bloqueado.paso, false);
  assert.equal(bloqueado.res.statusCode, 429);
  assert.ok(Number(bloqueado.res.cabeceras['Retry-After']) > 0);
  assert.equal(intento(401, 'otro@b.co').paso, true, 'otro correo no está bloqueado');
  reloj = 1500; // pasa la ventana
  assert.equal(intento(200).paso, true);
  intento(401);
  assert.equal(intento(200).paso, true);
});

test('escaparLike neutraliza % _ y \\', () => {
  assert.equal(escaparLike('50%_off\\x'), '50\\%\\_off\\\\x');
});

// ------------------------- Búsqueda y huéspedes -------------------------

const { terminosBusqueda } = require('../src/infrastructure/db/busqueda');
const { traducirErrorPg } = require('../src/infrastructure/db/pgErrors');
const { PgHuespedRepository } = require('../src/infrastructure/repositories/PgHuespedRepository');
const { PgReservaRepository } = require('../src/infrastructure/repositories/PgReservaRepository');
const { UpdateGuest } = require('../src/application/useCases/huespedUseCases');
const { Huesped } = require('../src/domain/entities/Huesped');

test('terminosBusqueda: sin acentos, minúsculas, máx. 5 palabras', () => {
  assert.deepEqual(terminosBusqueda('  María  LÓPEZ  Peña '), ['maria', 'lopez', 'pena']);
  assert.deepEqual(terminosBusqueda(''), []);
  assert.equal(terminosBusqueda('a b c d e f g').length, 5);
});

function poolEspia() {
  const llamadas = [];
  return { llamadas, query: async (texto, valores) => { llamadas.push({ texto, valores }); return { rows: [] }; } };
}

test('Huéspedes: cada palabra es una condición AND con comodines escapados', async () => {
  const pool = poolEspia();
  await new PgHuespedRepository(pool).listar({ q: 'Lopez 50%', limite: 20 });
  const { texto, valores } = pool.llamadas[0];
  assert.deepEqual(valores, ['%lopez%', '%50\\%%', 20]);
  assert.equal((texto.match(/ LIKE \$/g) || []).length, 2);
  assert.match(texto, /LIMIT \$3/);
  await new PgHuespedRepository(pool).listar({ q: '' });
  assert.doesNotMatch(pool.llamadas[1].texto, /WHERE/);
});

test('Reservas: un código completo usa igualdad exacta; texto libre busca por palabras', async () => {
  const pool = poolEspia();
  const repo = new PgReservaRepository(pool);
  await repo.listar(1, { q: '5a570577' });
  assert.deepEqual(pool.llamadas[0].valores, [1, '5A570577']);
  assert.match(pool.llamadas[0].texto, /r\.codigo = \$2/);
  await repo.listar(1, { q: 'maría lópez' });
  assert.deepEqual(pool.llamadas[1].valores, [1, '%maria%', '%lopez%']);
  assert.match(pool.llamadas[1].texto, /r\.huesped_id IN \(SELECT id FROM huespedes/);
});

test('traducirErrorPg distingue la restricción violada', () => {
  const mapa = { '23505': { mensaje: 'doc', codigo: 'DOCUMENTO_DUPLICADO' }, '23505:huespedes_pkey': { mensaje: 'seq', codigo: 'SECUENCIA_DESFASADA' } };
  assert.throws(() => traducirErrorPg({ code: '23505', constraint: 'huespedes_pkey' }, mapa), { codigo: 'SECUENCIA_DESFASADA' });
  assert.throws(() => traducirErrorPg({ code: '23505', constraint: 'otra' }, mapa), { codigo: 'DOCUMENTO_DUPLICADO' });
});

test('UpdateGuest: un huésped con tipo de documento sin número (dato antiguo) sí se puede editar', async () => {
  let guardado;
  const existente = new Huesped({ id: 3, nombre: 'Ana', apellidos: 'Gómez' });
  existente.tipoDocumento = 'INE'; // estado heredado de datos de prueba antiguos
  const repo = { buscarPorId: async () => existente, actualizar: async (h) => { guardado = h; return h; } };
  const r = await new UpdateGuest(repo).ejecutar(3, { telefono: '9611112233' });
  assert.equal(r.telefono, '9611112233');
  assert.equal(guardado.tipoDocumento, null);
});
