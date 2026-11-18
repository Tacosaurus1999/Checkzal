'use strict';

const express = require('express');
const cors = require('cors');

const { pool } = require('../db/pgConnection');

// Repositorios (adaptadores de salida) — PostgreSQL
const { PgUsuarioRepository } = require('../repositories/PgUsuarioRepository');
const { PgHabitacionRepository } = require('../repositories/PgHabitacionRepository');
const { PgHuespedRepository } = require('../repositories/PgHuespedRepository');
const { PgReservaRepository } = require('../repositories/PgReservaRepository');
const { PgPagoRepository } = require('../repositories/PgPagoRepository');
const { PgReporteRepository } = require('../repositories/PgReporteRepository');

// Servicios de seguridad
const { BcryptCifradoService, JwtTokenService } = require('../security/BcryptCifradoService');

// Casos de uso
const {
  LoginUser,
  GetUserProfile,
  ListUsers,
  CreateUser,
  UpdateUser,
  DeleteUser,
} = require('../../application/useCases/usuarioUseCases');
const {
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
} = require('../../application/useCases/habitacionUseCases');
const {
  ListGuests,
  GetGuest,
  CreateGuest,
  UpdateGuest,
  DeleteGuest,
} = require('../../application/useCases/huespedUseCases');
const {
  CreateReservation,
  ListReservations,
  GetReservation,
  UpdateReservationStatus,
  CheckInReservation,
  CheckOutReservation,
  DeleteReservation,
} = require('../../application/useCases/reservaUseCases');
const { RegisterPayment, ListPayments } = require('../../application/useCases/pagoUseCases');
const { GetDashboardSummary, GetStatistics } = require('../../application/useCases/reporteUseCases');
const { GetReservationByCode, GetReservationQr, SendReservationEmail } = require('../../application/useCases/qrUseCases');
const { qrPng, qrSvg } = require('../qr/qrEncoder');
const { mailerDesdeEntorno } = require('../email/smtpMailer');

// Adaptadores de entrada (HTTP)
const { crearAuthController } = require('./controllers/authController');
const { crearUsuarioController } = require('./controllers/usuarioController');
const { crearHabitacionController } = require('./controllers/habitacionController');
const { crearHuespedController } = require('./controllers/huespedController');
const { crearReservaController } = require('./controllers/reservaController');
const { crearPagoController } = require('./controllers/pagoController');
const { crearDashboardController } = require('./controllers/dashboardController');
const { crearAuthMiddleware, requerirAdmin, requerirGestion } = require('./middlewares/authMiddleware');
const { crearLimitadorLogin } = require('./middlewares/limitarIntentos');
const { crearAuthRoutes } = require('./routes/authRoutes');
const { crearUsuarioRoutes } = require('./routes/usuarioRoutes');
const { crearHabitacionRoutes, crearTipoHabitacionRoutes } = require('./routes/habitacionRoutes');
const { crearHuespedRoutes } = require('./routes/huespedRoutes');
const { crearReservaRoutes } = require('./routes/reservaRoutes');
const { crearPagoRoutes } = require('./routes/pagoRoutes');
const { crearDashboardRoutes } = require('./routes/dashboardRoutes');

function obtenerSecretoJwt() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción.');
  }
  return 'clave-secreta-desarrollo';
}

/** Composition root: ensambla TODAS las capas (única parte que conoce las implementaciones). */
function crearApp() {
  // --- Adaptadores de infraestructura (PostgreSQL) ---
  const usuarioRepository = new PgUsuarioRepository(pool);
  const habitacionRepository = new PgHabitacionRepository(pool);
  const huespedRepository = new PgHuespedRepository(pool);
  const reservaRepository = new PgReservaRepository(pool);
  const pagoRepository = new PgPagoRepository(pool);
  const reporteRepository = new PgReporteRepository(pool);

  const cifradoService = new BcryptCifradoService();
  const tokenService = new JwtTokenService(obtenerSecretoJwt());

  // --- Casos de uso: Usuarios ---
  const loginUser = new LoginUser(usuarioRepository, cifradoService, tokenService);
  const getUserProfile = new GetUserProfile(usuarioRepository);
  const listUsers = new ListUsers(usuarioRepository);
  const createUser = new CreateUser(usuarioRepository, cifradoService);
  const updateUser = new UpdateUser(usuarioRepository, cifradoService);
  const deleteUser = new DeleteUser(usuarioRepository);

  // --- Casos de uso: Habitaciones y tipos ---
  const listRooms = new ListRooms(habitacionRepository);
  const createRoom = new CreateRoom(habitacionRepository);
  const updateRoom = new UpdateRoom(habitacionRepository);
  const changeRoomStatus = new ChangeRoomStatus(habitacionRepository);
  const deleteRoom = new DeleteRoom(habitacionRepository);
  const checkAvailability = new CheckAvailability(habitacionRepository);
  const listRoomTypes = new ListRoomTypes(habitacionRepository);
  const createRoomType = new CreateRoomType(habitacionRepository);
  const updateRoomType = new UpdateRoomType(habitacionRepository);
  const deleteRoomType = new DeleteRoomType(habitacionRepository);

  // --- Casos de uso: Huéspedes ---
  const listGuests = new ListGuests(huespedRepository);
  const getGuest = new GetGuest(huespedRepository);
  const createGuest = new CreateGuest(huespedRepository);
  const updateGuest = new UpdateGuest(huespedRepository);
  const deleteGuest = new DeleteGuest(huespedRepository);

  // --- Casos de uso: Reservas ---
  const createReservation = new CreateReservation(reservaRepository, habitacionRepository, huespedRepository);
  const listReservations = new ListReservations(reservaRepository);
  const getReservation = new GetReservation(reservaRepository);
  const updateReservationStatus = new UpdateReservationStatus(reservaRepository);
  const checkInReservation = new CheckInReservation(reservaRepository, habitacionRepository);
  const checkOutReservation = new CheckOutReservation(reservaRepository, pagoRepository);
  const deleteReservation = new DeleteReservation(reservaRepository);

  // --- Casos de uso: QR de la reserva y correo ---
  const mailer = mailerDesdeEntorno();
  const urlPublica = () => process.env.URL_PUBLICA || 'http://localhost:5173';
  const nombreHotel = async (hotelId) => {
    const { rows } = await pool.query('SELECT nombre FROM hoteles WHERE id = $1', [hotelId]);
    return rows[0] ? rows[0].nombre : null;
  };
  const getReservationByCode = new GetReservationByCode(reservaRepository);
  const getReservationQr = new GetReservationQr(reservaRepository, { generadorPng: qrPng, generadorSvg: qrSvg, urlPublica });
  const sendReservationEmail = new SendReservationEmail(reservaRepository, { mailer, generadorPng: qrPng, urlPublica, nombreHotel });
  const enviarQrAutomatico = mailer.configurado && process.env.ENVIAR_QR_AUTOMATICO !== 'false';

  // --- Casos de uso: Pagos y reportes ---
  const registerPayment = new RegisterPayment(pagoRepository, reservaRepository);
  const listPayments = new ListPayments(pagoRepository, reservaRepository);
  const getDashboardSummary = new GetDashboardSummary(reporteRepository);
  const getStatistics = new GetStatistics(reporteRepository);

  // --- Controladores ---
  const authController = crearAuthController({ loginUser, getUserProfile });
  const usuarioController = crearUsuarioController({ listUsers, createUser, updateUser, deleteUser });
  const habitacionController = crearHabitacionController({
    listRooms,
    createRoom,
    updateRoom,
    changeRoomStatus,
    deleteRoom,
    checkAvailability,
    listRoomTypes,
    createRoomType,
    updateRoomType,
    deleteRoomType,
  });
  const huespedController = crearHuespedController({ listGuests, getGuest, createGuest, updateGuest, deleteGuest });
  const reservaController = crearReservaController({
    createReservation,
    listReservations,
    getReservation,
    updateReservationStatus,
    checkInReservation,
    checkOutReservation,
    deleteReservation,
    getReservationByCode,
    getReservationQr,
    sendReservationEmail,
    enviarQrAutomatico,
  });
  const pagoController = crearPagoController({ registerPayment, listPayments });
  const dashboardController = crearDashboardController({ getDashboardSummary, getStatistics });

  const autenticar = crearAuthMiddleware(tokenService, { usuarioRepository });
  const limitarLogin = crearLimitadorLogin();

  // --- App Express ---
  const app = express();
  app.set('trust proxy', 'loopback'); // detrás de Nginx en la misma máquina: req.ip = IP real del cliente
  app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', crearAuthRoutes(authController, autenticar, limitarLogin));
  app.use('/api/usuarios', crearUsuarioRoutes(usuarioController, autenticar, requerirAdmin));
  app.use('/api/tipos-habitacion', crearTipoHabitacionRoutes(habitacionController, autenticar, requerirGestion));
  app.use('/api/habitaciones', crearHabitacionRoutes(habitacionController, autenticar, requerirGestion));
  app.get('/api/disponibilidad', autenticar, habitacionController.disponibilidad);
  app.use('/api/huespedes', crearHuespedRoutes(huespedController, autenticar, requerirGestion));
  app.use('/api/reservas/:reservaId/pagos', crearPagoRoutes(pagoController, autenticar));
  app.use('/api/reservas', crearReservaRoutes(reservaController, autenticar, requerirAdmin));
  app.use('/api/dashboard', crearDashboardRoutes(dashboardController, autenticar, requerirAdmin));

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  // Manejador final: siempre JSON (JSON mal formado, cuerpo demasiado grande, errores inesperados).
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error && error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
    }
    if (error && error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'La petición es demasiado grande.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}

module.exports = { crearApp };
