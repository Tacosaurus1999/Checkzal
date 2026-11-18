'use strict';

const { manejarError } = require('./authController');

function crearReservaController({
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
  enviarQrAutomatico = false,
}) {
  return {
    /** POST /api/reservas — transacción reserva + reserva_habitaciones (409 si hay sobreventa) */
    async crear(req, res) {
      try {
        const reserva = await createReservation.ejecutar(req.usuario, req.body || {});
        // Correo con el QR: automático (best-effort, nunca hace fallar la reserva). ?sinCorreo=1 lo omite.
        const omitir = ['1', 'true'].includes(String(req.query.sinCorreo || ''));
        let correo = { enviado: false, motivo: 'omitido' };
        if (enviarQrAutomatico && !omitir) {
          try {
            correo = await sendReservationEmail.ejecutar(reserva.id, req.usuario.hotelId);
          } catch (e) {
            correo = { enviado: false, motivo: e.codigo || 'ERROR', detalle: e.message };
          }
        }
        res.status(201).json({ ...reserva, correo });
      } catch (error) {
        manejarError(error, res);
      }
    },

    async listar(req, res) {
      try {
        const { estado, desde, hasta, q } = req.query;
        res.status(200).json(await listReservations.ejecutar(req.usuario.hotelId, { estado, desde, hasta, q }));
      } catch (error) {
        manejarError(error, res);
      }
    },

    /** GET /api/reservas/por-codigo?c=5A570577 — acepta el código suelto o el texto completo del QR */
    async porCodigo(req, res) {
      try {
        res.status(200).json(await getReservationByCode.ejecutar(req.usuario.hotelId, req.query.c));
      } catch (error) {
        manejarError(error, res);
      }
    },

    /** GET /api/reservas/:id/qr?formato=png|svg — imagen del QR (PNG por defecto) */
    async qr(req, res) {
      try {
        const formato = req.query.formato === 'svg' ? 'svg' : 'png';
        const qr = await getReservationQr.ejecutar(Number(req.params.id), req.usuario.hotelId, formato);
        res.set('Content-Type', qr.tipo);
        res.set('Cache-Control', 'private, max-age=300');
        if (req.query.descargar) res.set('Content-Disposition', `attachment; filename="reserva-${qr.codigo}.${formato}"`);
        res.status(200).send(qr.datos);
      } catch (error) {
        manejarError(error, res);
      }
    },

    /** POST /api/reservas/:id/enviar-correo — envío manual del resumen + QR al correo del huésped */
    async enviarCorreo(req, res) {
      try {
        res.status(200).json(await sendReservationEmail.ejecutar(Number(req.params.id), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async obtener(req, res) {
      try {
        res.status(200).json(await getReservation.ejecutar(Number(req.params.id), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },

    async actualizarEstado(req, res) {
      try {
        const reserva = await updateReservationStatus.ejecutar(
          Number(req.params.id),
          req.usuario.hotelId,
          (req.body || {}).estado
        );
        res.status(200).json(reserva);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async checkin(req, res) {
      try {
        const reserva = await checkInReservation.ejecutar(Number(req.params.id), req.usuario.hotelId, req.usuario.id);
        res.status(200).json(reserva);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async checkout(req, res) {
      try {
        const reserva = await checkOutReservation.ejecutar(
          Number(req.params.id),
          req.usuario.hotelId,
          req.usuario,
          { forzar: Boolean((req.body || {}).forzar) }
        );
        res.status(200).json(reserva);
      } catch (error) {
        manejarError(error, res);
      }
    },

    async eliminar(req, res) {
      try {
        res.status(200).json(await deleteReservation.ejecutar(Number(req.params.id), req.usuario.hotelId));
      } catch (error) {
        manejarError(error, res);
      }
    },
  };
}

module.exports = { crearReservaController };
