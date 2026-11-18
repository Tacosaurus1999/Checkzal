'use strict';

/**
 * Cliente SMTP mínimo (sin dependencias): conexión directa con TLS (puerto 465) o STARTTLS (587),
 * autenticación LOGIN/PLAIN y envío de un mensaje MIME con imágenes incrustadas.
 * Pensado para Gmail con contraseña de aplicación, pero sirve con cualquier servidor SMTP estándar.
 */

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

class ErrorSmtp extends Error {
  constructor(mensaje, codigo = 'SMTP_ERROR') {
    super(mensaje);
    this.name = 'ErrorSmtp';
    this.codigo = codigo;
  }
}

const b64 = (dato) => Buffer.from(dato).toString('base64');
const b64Lineas = (dato) => b64(dato).replace(/(.{76})/g, '$1\r\n');
const soloCorreo = (direccion) => (String(direccion).match(/<([^>]+)>/) || [null, String(direccion).trim()])[1];

function codificarCabecera(texto) {
  return /^[\x20-\x7e]*$/.test(texto) ? texto : `=?UTF-8?B?${b64(texto)}?=`;
}

function validarCabecera(valor, campo) {
  if (/[\r\n]/.test(String(valor))) throw new ErrorSmtp(`${campo} contiene saltos de línea.`, 'SMTP_ENTRADA_INVALIDA');
  return String(valor);
}

/** Arma el mensaje MIME (texto + HTML + imágenes incrustadas con cid). */
function armarMensaje({ de, para, asunto, texto, html, imagenes = [] }) {
  const frontera = `=_${crypto.randomBytes(12).toString('hex')}`;
  const fronteraAlt = `=_${crypto.randomBytes(12).toString('hex')}`;
  const dominio = (soloCorreo(de).split('@')[1] || 'localhost').replace(/[^\w.-]/g, '');
  const cabeceras = [
    `From: ${validarCabecera(de, 'El remitente')}`,
    `To: ${validarCabecera(para, 'El destinatario')}`,
    `Subject: ${codificarCabecera(validarCabecera(asunto, 'El asunto'))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${dominio}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${frontera}"`,
  ];
  const partes = [
    `--${frontera}`,
    `Content-Type: multipart/alternative; boundary="${fronteraAlt}"`,
    '',
    `--${fronteraAlt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Lineas(texto),
    `--${fronteraAlt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Lineas(html),
    `--${fronteraAlt}--`,
  ];
  for (const img of imagenes) {
    partes.push(
      `--${frontera}`,
      `Content-Type: ${img.tipo}; name="${img.nombre}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.nombre}"`,
      '',
      b64Lineas(img.contenido)
    );
  }
  partes.push(`--${frontera}--`);
  return `${cabeceras.join('\r\n')}\r\n\r\n${partes.join('\r\n')}\r\n`;
}

/** Lector de respuestas SMTP (multilínea "250-..." / "250 ..."). */
function crearLector(socket) {
  let buffer = '';
  let espera = null;
  let error = null;

  const intentar = () => {
    if (!espera) return;
    const lineas = buffer.split('\r\n');
    for (let i = 0; i < lineas.length - 1; i++) {
      if (/^\d{3} /.test(lineas[i]) || /^\d{3}$/.test(lineas[i])) {
        const respuesta = lineas.slice(0, i + 1);
        buffer = lineas.slice(i + 1).join('\r\n');
        const { resolver } = espera;
        espera = null;
        resolver({ codigo: Number(respuesta[respuesta.length - 1].slice(0, 3)), texto: respuesta.join('\n') });
        return;
      }
    }
  };
  const alDatos = (trozo) => {
    buffer += trozo.toString('utf8');
    intentar();
  };
  const fallar = (e) => {
    error = e;
    if (espera) {
      const { rechazar } = espera;
      espera = null;
      rechazar(e);
    }
  };
  socket.on('data', alDatos);
  socket.on('error', fallar);
  socket.on('close', () => fallar(new ErrorSmtp('El servidor SMTP cerró la conexión.', 'SMTP_CONEXION')));

  return {
    leer() {
      return new Promise((resolver, rechazar) => {
        if (error) return rechazar(error);
        espera = { resolver, rechazar };
        intentar();
        return undefined;
      });
    },
    /** Deja de escuchar (antes de pasar a TLS). */
    soltar() {
      socket.off('data', alDatos);
    },
  };
}

function conectar({ host, port, seguro, rechazarNoConfiable, timeoutMs }) {
  return new Promise((resolver, rechazar) => {
    const opciones = { host, port, servername: host, rejectUnauthorized: rechazarNoConfiable };
    const socket = seguro ? tls.connect(opciones) : net.connect({ host, port });
    const temporizador = setTimeout(() => {
      socket.destroy();
      rechazar(new ErrorSmtp(`Tiempo agotado conectando a ${host}:${port}.`, 'SMTP_TIMEOUT'));
    }, timeoutMs);
    socket.once(seguro ? 'secureConnect' : 'connect', () => {
      clearTimeout(temporizador);
      socket.setTimeout(timeoutMs, () => socket.destroy(new ErrorSmtp('El servidor SMTP no responde.', 'SMTP_TIMEOUT')));
      resolver(socket);
    });
    socket.once('error', (e) => {
      clearTimeout(temporizador);
      rechazar(new ErrorSmtp(`No se pudo conectar a ${host}:${port} (${e.message}).`, 'SMTP_CONEXION'));
    });
  });
}

/**
 * @param {{host:string, port?:number, secure?:boolean, user?:string, pass?:string, from:string,
 *          rejectUnauthorized?:boolean, timeoutMs?:number}} config
 * @returns {{ configurado: boolean, enviar: Function }}
 */
function crearMailer(config) {
  const configurado = Boolean(config && config.host && config.from);
  const port = Number((config && config.port) || 465);
  const seguro = config && config.secure !== undefined ? Boolean(config.secure) : port === 465;
  const rechazarNoConfiable = !config || config.rejectUnauthorized !== false;
  const timeoutMs = (config && config.timeoutMs) || 15000;

  async function enviar({ para, asunto, texto, html, imagenes = [] }) {
    if (!configurado) throw new ErrorSmtp('El correo (SMTP) no está configurado en el servidor.', 'SMTP_NO_CONFIGURADO');
    const mensaje = armarMensaje({ de: config.from, para, asunto, texto, html, imagenes });

    let socket = await conectar({ host: config.host, port, seguro, rechazarNoConfiable, timeoutMs });
    let lector = crearLector(socket);
    const comando = async (linea, esperados) => {
      if (linea !== null) socket.write(`${linea}\r\n`);
      const r = await lector.leer();
      if (!esperados.includes(r.codigo)) {
        throw new ErrorSmtp(`SMTP respondió ${r.codigo}: ${r.texto.split('\n').pop().slice(4)}`, 'SMTP_RECHAZADO');
      }
      return r;
    };

    try {
      await comando(null, [220]);
      let ehlo = await comando('EHLO pms-hotel', [250]);

      if (!seguro && /STARTTLS/i.test(ehlo.texto)) {
        await comando('STARTTLS', [220]);
        lector.soltar();
        socket = tls.connect({ socket, servername: config.host, rejectUnauthorized: rechazarNoConfiable });
        await new Promise((ok, fallo) => {
          socket.once('secureConnect', ok);
          socket.once('error', fallo);
        });
        lector = crearLector(socket);
        ehlo = await comando('EHLO pms-hotel', [250]);
      }

      if (config.user) {
        if (/AUTH[^\n]*LOGIN/i.test(ehlo.texto) || !/AUTH[^\n]*PLAIN/i.test(ehlo.texto)) {
          await comando('AUTH LOGIN', [334]);
          await comando(b64(config.user), [334]);
          await comando(b64(config.pass || ''), [235]);
        } else {
          await comando(`AUTH PLAIN ${b64(`\0${config.user}\0${config.pass || ''}`)}`, [235]);
        }
      }

      await comando(`MAIL FROM:<${soloCorreo(config.from)}>`, [250]);
      await comando(`RCPT TO:<${soloCorreo(para)}>`, [250, 251]);
      await comando('DATA', [354]);
      const cuerpo = mensaje.replace(/^\./gm, '..');
      await comando(`${cuerpo}\r\n.`, [250]);
      await comando('QUIT', [221]).catch(() => {});
    } finally {
      socket.destroy();
    }
  }

  return { configurado, enviar };
}

function mailerDesdeEntorno(env = process.env) {
  return crearMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : undefined,
    secure: env.SMTP_SECURE === undefined || env.SMTP_SECURE === '' ? undefined : env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM || env.SMTP_USER,
  });
}

module.exports = { crearMailer, mailerDesdeEntorno, armarMensaje, ErrorSmtp };
