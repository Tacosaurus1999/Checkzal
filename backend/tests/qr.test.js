'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');

const { qrPng, qrSvg, generarQr } = require('../src/infrastructure/qr/qrEncoder');
const { crearMailer, armarMensaje } = require('../src/infrastructure/email/smtpMailer');
const {
  contenidoQr,
  extraerCodigo,
  GetReservationByCode,
  GetReservationQr,
  SendReservationEmail,
} = require('../src/application/useCases/qrUseCases');

const reservaFalsa = (extra = {}) => ({
  id: 7,
  codigo: '5a570577',
  huespedNombre: 'María Pérez',
  huespedEmail: 'maria@example.com',
  fechaEntrada: '2026-12-01',
  fechaSalida: '2026-12-03',
  habitaciones: [{ numero: '101', tipo: 'Suite' }],
  totalAPagar: 2400,
  saldo: 2400,
  toJSON() { return { id: 7, codigo: this.codigo }; },
  ...extra,
});

test('contenidoQr / extraerCodigo: ida y vuelta, con URL o código suelto', () => {
  const url = contenidoQr('5a570577', 'http://192.168.1.10:5173/');
  assert.equal(url, 'http://192.168.1.10:5173/escanear?c=5A570577');
  assert.equal(extraerCodigo(url), '5A570577');
  assert.equal(extraerCodigo(' 5a570577 '), '5A570577');
  assert.equal(extraerCodigo('hola'), null);
  assert.equal(extraerCodigo('http://x/escanear?c=5A5705779'), null);
});

test('QR: PNG válido y SVG; texto demasiado largo se rechaza', () => {
  const png = qrPng('http://localhost:5173/escanear?c=5A570577');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(qrSvg('abc'), /^<svg/);
  assert.ok(generarQr('abc'));
  assert.throws(() => generarQr('x'.repeat(500)));
});

test('GetReservationByCode: encuentra por código o por URL del QR; rechaza inválidos y ajenos', async () => {
  const repo = { listar: async (_h, { q }) => (q === '5A570577' ? [reservaFalsa()] : []) };
  const uc = new GetReservationByCode(repo);
  assert.equal((await uc.ejecutar(1, '5a570577')).codigo, '5a570577');
  assert.equal((await uc.ejecutar(1, 'http://h/escanear?c=5A570577')).id, 7);
  await assert.rejects(uc.ejecutar(1, 'zzz'), { codigo: 'CODIGO_INVALIDO' });
  await assert.rejects(uc.ejecutar(1, 'AAAAAAAA'), { codigo: 'RESERVA_NO_ENCONTRADA' });
});

test('GetReservationQr: respeta el hotel y el formato', async () => {
  const repo = { buscarPorId: async (id, h) => (id === 7 && h === 1 ? reservaFalsa() : null) };
  const uc = new GetReservationQr(repo, { generadorPng: () => Buffer.from('png'), generadorSvg: () => '<svg/>', urlPublica: () => 'http://h' });
  assert.equal((await uc.ejecutar(7, 1)).tipo, 'image/png');
  assert.equal((await uc.ejecutar(7, 1, 'svg')).tipo, 'image/svg+xml');
  await assert.rejects(uc.ejecutar(7, 2), { codigo: 'RESERVA_NO_ENCONTRADA' });
});

test('SendReservationEmail: valida correo/SMTP y envía el QR incrustado', async () => {
  const enviados = [];
  const mailer = { configurado: true, enviar: async (m) => enviados.push(m) };
  const crear = (reserva, m = mailer) =>
    new SendReservationEmail({ buscarPorId: async () => reserva }, {
      mailer: m, generadorPng: () => Buffer.from('png'), urlPublica: () => 'http://h', nombreHotel: async () => 'Casa Jaguar',
    });

  const r = await crear(reservaFalsa()).ejecutar(7, 1);
  assert.deepEqual(r, { enviado: true, para: 'maria@example.com' });
  assert.match(enviados[0].asunto, /5a570577 - Casa Jaguar/);
  assert.match(enviados[0].html, /cid:qr-reserva/);
  assert.equal(enviados[0].imagenes[0].cid, 'qr-reserva');

  await assert.rejects(crear(reservaFalsa({ huespedEmail: null })).ejecutar(7, 1), { codigo: 'HUESPED_SIN_CORREO' });
  await assert.rejects(crear(reservaFalsa(), { configurado: false }).ejecutar(7, 1), { codigo: 'CORREO_NO_CONFIGURADO' });
  const roto = { configurado: true, enviar: async () => { const e = new Error('fallo'); e.name = 'ErrorSmtp'; throw e; } };
  await assert.rejects(crear(reservaFalsa(), roto).ejecutar(7, 1), { codigo: 'CORREO_FALLIDO' });
});

test('El HTML del correo escapa datos del huésped', async () => {
  const mailer = { configurado: true, enviar: async (m) => { mailer.ultimo = m; } };
  const uc = new SendReservationEmail({ buscarPorId: async () => reservaFalsa({ huespedNombre: '<script>x</script>' }) }, {
    mailer, generadorPng: () => Buffer.from('p'), urlPublica: () => 'http://h', nombreHotel: async () => 'H',
  });
  await uc.ejecutar(7, 1);
  assert.doesNotMatch(mailer.ultimo.html, /<script>/);
});

test('smtpMailer: rechaza saltos de línea (inyección de cabeceras) y arma MIME con imagen cid', () => {
  assert.throws(() => armarMensaje({ de: 'a@b.c', para: 'x@y.z\r\nBcc: z@z.z', asunto: 'a', texto: 't', html: 'h' }), { name: 'ErrorSmtp' });
  const msg = armarMensaje({
    de: 'a@b.c', para: 'x@y.z', asunto: 'Reserva ñ', texto: 't', html: '<b>h</b>',
    imagenes: [{ cid: 'qr-reserva', nombre: 'q.png', tipo: 'image/png', contenido: Buffer.from('abc') }],
  });
  assert.match(msg, /Subject: =\?UTF-8\?B\?/);
  assert.match(msg, /Content-ID: <qr-reserva>/);
});

test('smtpMailer: conversación SMTP completa contra un servidor falso', async () => {
  const comandos = [];
  let datos = '';
  const servidor = net.createServer((socket) => {
    socket.write('220 listo\r\n');
    let enData = false;
    let buf = '';
    socket.on('data', (t) => {
      buf += t.toString();
      if (enData) {
        if (buf.endsWith('\r\n.\r\n')) { datos = buf; enData = false; buf = ''; socket.write('250 ok\r\n'); }
        return;
      }
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const linea = buf.slice(0, i); buf = buf.slice(i + 2); comandos.push(linea);
        if (linea.startsWith('EHLO')) socket.write('250-hola\r\n250 AUTH PLAIN\r\n');
        else if (linea.startsWith('AUTH PLAIN')) socket.write('235 ok\r\n');
        else if (linea === 'DATA') { socket.write('354 sigue\r\n'); enData = true; break; }
        else if (linea === 'QUIT') { socket.write('221 adios\r\n'); socket.end(); }
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  try {
    const mailer = crearMailer({ host: '127.0.0.1', port: servidor.address().port, secure: false, user: 'u@x.mx', pass: 'p', from: 'Hotel <u@x.mx>' });
    await mailer.enviar({ para: 'c@x.mx', asunto: 'Hola', texto: 'línea\n.punto', html: '<p>x</p>', imagenes: [{ cid: 'qr', nombre: 'q.png', tipo: 'image/png', contenido: Buffer.from('abc') }] });
    assert.ok(comandos.some((c) => c === 'MAIL FROM:<u@x.mx>'));
    assert.ok(comandos.some((c) => c === 'RCPT TO:<c@x.mx>'));
    assert.match(datos, /To: c@x.mx/);
  } finally {
    servidor.close();
  }
  assert.equal(crearMailer({}).configurado, false);
});
