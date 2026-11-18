'use strict';

const { DomainError } = require('../../domain/errors/DomainError');

const CODIGO_REGEX = /^[0-9a-f]{8}$/i;

/** Texto que lleva el QR: URL de la pantalla "Escanear" del PMS con el código de la reserva. */
function contenidoQr(codigo, urlPublica) {
  const base = String(urlPublica || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/escanear?c=${encodeURIComponent(String(codigo).toUpperCase())}`;
}

/** Acepta un código suelto ("5A570577"), o el contenido completo del QR (URL con ?c=...). */
function extraerCodigo(texto) {
  const crudo = String(texto || '').trim();
  if (CODIGO_REGEX.test(crudo)) return crudo.toUpperCase();
  const coincidencia = crudo.match(/[?&]c=([0-9a-f]{8})(?![0-9a-f])/i);
  return coincidencia ? coincidencia[1].toUpperCase() : null;
}

/** Caso de uso: GetReservationByCode — localiza una reserva del hotel por su código (QR o manual). */
class GetReservationByCode {
  constructor(reservaRepository) {
    this.reservaRepository = reservaRepository;
  }

  async ejecutar(hotelId, texto) {
    const codigo = extraerCodigo(texto);
    if (!codigo) throw new DomainError('El código debe tener 8 caracteres (letras A-F y números).', 'CODIGO_INVALIDO');
    const [reserva] = await this.reservaRepository.listar(hotelId, { q: codigo });
    if (!reserva || reserva.codigo.toUpperCase() !== codigo) {
      throw new DomainError('No hay ninguna reserva con ese código en este hotel.', 'RESERVA_NO_ENCONTRADA');
    }
    return reserva.toJSON();
  }
}

/** Caso de uso: GetReservationQr — genera el QR (PNG o SVG) de una reserva. */
class GetReservationQr {
  constructor(reservaRepository, { generadorPng, generadorSvg, urlPublica }) {
    this.reservaRepository = reservaRepository;
    this.generadorPng = generadorPng;
    this.generadorSvg = generadorSvg;
    this.urlPublica = urlPublica;
  }

  async ejecutar(id, hotelId, formato = 'png') {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    const contenido = contenidoQr(reserva.codigo, this.urlPublica());
    return {
      codigo: reserva.codigo,
      contenido,
      tipo: formato === 'svg' ? 'image/svg+xml' : 'image/png',
      datos: formato === 'svg' ? this.generadorSvg(contenido) : this.generadorPng(contenido, { escala: 8 }),
    };
  }
}

const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const moneda = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
const fecha = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Arma el correo (texto + HTML) con la reserva y el QR incrustado (cid:qr-reserva). */
function armarCorreoReserva({ reserva, hotelNombre, contenido }) {
  const habitaciones = reserva.habitaciones.map((h) => `${h.numero} (${h.tipo})`).join(', ') || 'Por asignar';
  const asunto = `Tu reserva ${reserva.codigo} - ${hotelNombre}`;
  const texto = [
    `Hola ${reserva.huespedNombre},`,
    '',
    `Estos son los datos de tu reserva en ${hotelNombre}:`,
    `Código: ${reserva.codigo}`,
    `Entrada: ${fecha(reserva.fechaEntrada)}`,
    `Salida: ${fecha(reserva.fechaSalida)}`,
    `Habitación: ${habitaciones}`,
    `Total: ${moneda(reserva.totalAPagar)}`,
    `Saldo pendiente: ${moneda(reserva.saldo)}`,
    '',
    'Presenta el código QR adjunto (o este código) en recepción para agilizar tu check-in.',
    contenido,
  ].join('\n');

  const fila = (etiqueta, valor) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#7a6a5d">${escapar(etiqueta)}</td><td style="padding:4px 0;color:#2d2118"><b>${escapar(valor)}</b></td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px">
  <div style="background:#2d2118;color:#f6f1e9;padding:18px 24px;border-radius:12px 12px 0 0;font-size:20px">${escapar(hotelNombre)}</div>
  <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e6dccf;border-top:0">
    <p style="margin:0 0 12px;color:#2d2118">Hola ${escapar(reserva.huespedNombre)}, estos son los datos de tu reserva:</p>
    <table style="font-size:14px;border-collapse:collapse">
      ${fila('Código', reserva.codigo)}
      ${fila('Entrada', fecha(reserva.fechaEntrada))}
      ${fila('Salida', fecha(reserva.fechaSalida))}
      ${fila('Habitación', habitaciones)}
      ${fila('Total', moneda(reserva.totalAPagar))}
      ${fila('Saldo pendiente', moneda(reserva.saldo))}
    </table>
    <div style="text-align:center;margin:24px 0 8px">
      <img src="cid:qr-reserva" width="220" height="220" alt="Código QR de tu reserva" style="border:1px solid #e6dccf;border-radius:8px">
      <p style="margin:8px 0 0;font-size:13px;color:#7a6a5d">Presenta este código QR en recepción para agilizar tu check-in.</p>
      <p style="margin:4px 0 0;font-size:18px;letter-spacing:3px;color:#6b1f2a"><b>${escapar(reserva.codigo)}</b></p>
    </div>
  </div>
  <p style="text-align:center;margin:12px 0 0;font-size:11px;color:#9a8b7d">Enviado con Checkzal</p>
</div></body></html>`;
  return { asunto, texto, html };
}

/** Caso de uso: SendReservationEmail — envía al huésped el resumen de su reserva con el QR. */
class SendReservationEmail {
  constructor(reservaRepository, { mailer, generadorPng, urlPublica, nombreHotel }) {
    this.reservaRepository = reservaRepository;
    this.mailer = mailer;
    this.generadorPng = generadorPng;
    this.urlPublica = urlPublica;
    this.nombreHotel = nombreHotel;
  }

  async ejecutar(id, hotelId) {
    const reserva = await this.reservaRepository.buscarPorId(id, hotelId);
    if (!reserva) throw new DomainError('Reserva no encontrada.', 'RESERVA_NO_ENCONTRADA');
    if (!reserva.huespedEmail) {
      throw new DomainError('El huésped no tiene correo registrado.', 'HUESPED_SIN_CORREO');
    }
    if (!this.mailer.configurado) {
      throw new DomainError('El envío de correo no está configurado en el servidor (variables SMTP_*).', 'CORREO_NO_CONFIGURADO');
    }
    const contenido = contenidoQr(reserva.codigo, this.urlPublica());
    const hotelNombre = (await this.nombreHotel(hotelId)) || 'Hotel';
    const { asunto, texto, html } = armarCorreoReserva({ reserva, hotelNombre, contenido });
    try {
      await this.mailer.enviar({
        para: reserva.huespedEmail,
        asunto,
        texto,
        html,
        imagenes: [
          { cid: 'qr-reserva', nombre: `reserva-${reserva.codigo}.png`, tipo: 'image/png', contenido: this.generadorPng(contenido, { escala: 8 }) },
        ],
      });
    } catch (error) {
      if (error && error.name === 'ErrorSmtp') throw new DomainError(`No se pudo enviar el correo: ${error.message}`, 'CORREO_FALLIDO');
      throw error;
    }
    return { enviado: true, para: reserva.huespedEmail };
  }
}

module.exports = {
  contenidoQr,
  extraerCodigo,
  armarCorreoReserva,
  GetReservationByCode,
  GetReservationQr,
  SendReservationEmail,
};
