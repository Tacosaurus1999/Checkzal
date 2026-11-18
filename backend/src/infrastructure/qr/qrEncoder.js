'use strict';

/**
 * Generador de códigos QR sin dependencias externas.
 * Modo byte (UTF-8), corrección de errores nivel M, versiones 1 a 7 (hasta 122 bytes).
 * Suficiente para una URL corta con el código de la reserva.
 */

// Por versión (nivel M): [bytes de datos, bytes de corrección por bloque, número de bloques]
const VERSIONES = {
  1: { datos: 16, ec: 10, bloques: 1 },
  2: { datos: 28, ec: 16, bloques: 1 },
  3: { datos: 44, ec: 26, bloques: 1 },
  4: { datos: 64, ec: 18, bloques: 2 },
  5: { datos: 86, ec: 24, bloques: 2 },
  6: { datos: 108, ec: 16, bloques: 4 },
  7: { datos: 124, ec: 18, bloques: 4 },
};
const ALINEACION = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38] };

// ---------- Campo de Galois GF(256) ----------
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function polinomioGenerador(grado) {
  let poli = [1];
  for (let i = 0; i < grado; i++) {
    const siguiente = new Array(poli.length + 1).fill(0);
    for (let j = 0; j < poli.length; j++) {
      siguiente[j] ^= poli[j];
      siguiente[j + 1] ^= poli[j] === 0 ? 0 : EXP[LOG[poli[j]] + i];
    }
    poli = siguiente;
  }
  return poli;
}

function codigosCorreccion(datos, cantidad) {
  const gen = polinomioGenerador(cantidad);
  const resto = new Array(cantidad).fill(0);
  for (const byte of datos) {
    const factor = byte ^ resto.shift();
    resto.push(0);
    if (factor !== 0) {
      for (let i = 0; i < cantidad; i++) resto[i] ^= EXP[LOG[gen[i + 1]] + LOG[factor]];
    }
  }
  return resto;
}

// ---------- Codificación de datos ----------
function aBytes(texto) {
  return Buffer.from(String(texto), 'utf8');
}

function elegirVersion(longitud) {
  for (const v of Object.keys(VERSIONES).map(Number)) {
    // 4 bits de modo + 8 de longitud + datos (+ hasta 4 de terminador) deben caber
    if (Math.ceil((4 + 8 + longitud * 8) / 8) <= VERSIONES[v].datos) return v;
  }
  throw new Error('El texto es demasiado largo para el código QR (máximo 122 bytes).');
}

function armarCodewords(bytes, version) {
  const { datos: capacidad, ec, bloques } = VERSIONES[version];
  const bits = [];
  const poner = (valor, cantidad) => {
    for (let i = cantidad - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  poner(0b0100, 4); // modo byte
  poner(bytes.length, 8);
  for (const b of bytes) poner(b, 8);
  const maxBits = capacidad * 8;
  poner(0, Math.min(4, maxBits - bits.length)); // terminador
  while (bits.length % 8 !== 0) bits.push(0);
  const palabras = [];
  for (let i = 0; i < bits.length; i += 8) {
    palabras.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  for (let pad = 0xec; palabras.length < capacidad; pad ^= 0xec ^ 0x11) palabras.push(pad);

  // Bloques + corrección de errores, intercalados
  const porBloque = capacidad / bloques;
  const bloquesDatos = [];
  const bloquesEc = [];
  for (let b = 0; b < bloques; b++) {
    const parte = palabras.slice(b * porBloque, (b + 1) * porBloque);
    bloquesDatos.push(parte);
    bloquesEc.push(codigosCorreccion(parte, ec));
  }
  const salida = [];
  for (let i = 0; i < porBloque; i++) for (const bloque of bloquesDatos) salida.push(bloque[i]);
  for (let i = 0; i < ec; i++) for (const bloque of bloquesEc) salida.push(bloque[i]);
  return salida;
}

// ---------- Matriz ----------
function crearMatriz(version) {
  const n = 17 + version * 4;
  const modulos = Array.from({ length: n }, () => new Array(n).fill(false));
  const reservado = Array.from({ length: n }, () => new Array(n).fill(false));
  return { n, modulos, reservado };
}

function ponerFuncion(m, x, y, oscuro) {
  m.modulos[y][x] = oscuro;
  m.reservado[y][x] = true;
}

function dibujarPatrones(m, version) {
  const { n } = m;
  const buscador = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        ponerFuncion(m, x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  buscador(3, 3);
  buscador(n - 4, 3);
  buscador(3, n - 4);

  // Sincronización
  for (let i = 8; i < n - 8; i++) {
    ponerFuncion(m, i, 6, i % 2 === 0);
    ponerFuncion(m, 6, i, i % 2 === 0);
  }

  // Alineación
  const pos = ALINEACION[version];
  for (const cy of pos) {
    for (const cx of pos) {
      const enBuscador =
        (cx === 6 && cy === 6) || (cx === 6 && cy === pos[pos.length - 1]) || (cy === 6 && cx === pos[pos.length - 1]);
      if (enBuscador) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          ponerFuncion(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Módulo oscuro fijo y áreas reservadas para formato / versión
  ponerFuncion(m, 8, n - 8, true);
  for (let i = 0; i < 9; i++) {
    if (!m.reservado[8][i]) m.reservado[8][i] = true;
    if (!m.reservado[i][8]) m.reservado[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    m.reservado[8][n - 1 - i] = true;
    m.reservado[n - 1 - i][8] = true;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        m.reservado[i][n - 11 + j] = true;
        m.reservado[n - 11 + j][i] = true;
      }
    }
  }
}

function colocarDatos(m, palabras) {
  const { n } = m;
  const bits = [];
  for (const p of palabras) for (let i = 7; i >= 0; i--) bits.push((p >>> i) & 1);
  let k = 0;
  let subiendo = true;
  for (let derecha = n - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let paso = 0; paso < n; paso++) {
      const y = subiendo ? n - 1 - paso : paso;
      for (let c = 0; c < 2; c++) {
        const x = derecha - c;
        if (m.reservado[y][x]) continue;
        m.modulos[y][x] = k < bits.length ? bits[k] === 1 : false;
        k++;
      }
    }
    subiendo = !subiendo;
  }
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function bchFormato(datos) {
  let resto = datos << 10;
  for (let i = 14; i >= 10; i--) if ((resto >>> i) & 1) resto ^= 0x537 << (i - 10);
  return ((datos << 10) | resto) ^ 0x5412;
}

function bchVersion(version) {
  let resto = version << 12;
  for (let i = 17; i >= 12; i--) if ((resto >>> i) & 1) resto ^= 0x1f25 << (i - 12);
  return (version << 12) | resto;
}

function dibujarFormato(modulos, n, mascara) {
  const bits = bchFormato((0b00 << 3) | mascara); // nivel M = 00
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) modulos[i][8] = bit(i);
  modulos[7][8] = bit(6);
  modulos[8][8] = bit(7);
  modulos[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modulos[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) modulos[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modulos[n - 15 + i][8] = bit(i);
  modulos[n - 8][8] = true; // módulo oscuro
}

function dibujarVersion(modulos, n, version) {
  if (version < 7) return;
  const bits = bchVersion(version);
  for (let i = 0; i < 18; i++) {
    const oscuro = ((bits >>> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = (i % 3) + n - 11;
    modulos[a][b] = oscuro;
    modulos[b][a] = oscuro;
  }
}

function penalizacion(modulos) {
  const n = modulos.length;
  let puntos = 0;
  const linea = (get) => {
    for (let a = 0; a < n; a++) {
      let corrida = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) {
          corrida++;
          if (corrida === 5) puntos += 3;
          else if (corrida > 5) puntos += 1;
        } else corrida = 1;
      }
      // patrón 1:1:3:1:1 con 4 módulos claros a un lado
      for (let b = 0; b + 10 < n; b++) {
        const v = (i) => (get(a, b + i) ? 1 : 0);
        const centro = v(0) === 1 && v(1) === 0 && v(2) === 1 && v(3) === 1 && v(4) === 1 && v(5) === 0 && v(6) === 1;
        const claroIzq = v(7) + v(8) + v(9) + v(10) === 0;
        const claroDer = v(0) + v(1) + v(2) + v(3) === 0;
        const centro2 = v(4) === 1 && v(5) === 0 && v(6) === 1 && v(7) === 1 && v(8) === 1 && v(9) === 0 && v(10) === 1;
        if ((centro && claroIzq) || (centro2 && claroDer)) puntos += 40;
      }
    }
  };
  linea((y, x) => modulos[y][x]);
  linea((x, y) => modulos[y][x]);
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = modulos[y][x];
      if (c === modulos[y][x + 1] && c === modulos[y + 1][x] && c === modulos[y + 1][x + 1]) puntos += 3;
    }
  }
  let oscuros = 0;
  for (const fila of modulos) for (const c of fila) if (c) oscuros++;
  puntos += Math.floor(Math.abs((oscuros * 100) / (n * n) - 50) / 5) * 10;
  return puntos;
}

/**
 * Devuelve la matriz de módulos (true = oscuro) del QR para el texto.
 * @param {string} texto
 * @param {{ mascara?: number }} [opciones] mascara fuerza una máscara (0-7), solo para pruebas
 * @returns {boolean[][]}
 */
function generarQr(texto, { mascara } = {}) {
  const bytes = aBytes(texto);
  const version = elegirVersion(bytes.length);
  const palabras = armarCodewords(bytes, version);

  const base = crearMatriz(version);
  dibujarPatrones(base, version);
  colocarDatos(base, palabras);

  const candidatas = mascara === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [mascara];
  let mejor = null;
  for (const mk of candidatas) {
    const copia = base.modulos.map((fila) => fila.slice());
    for (let y = 0; y < base.n; y++) {
      for (let x = 0; x < base.n; x++) {
        if (!base.reservado[y][x] && MASCARAS[mk](x, y)) copia[y][x] = !copia[y][x];
      }
    }
    dibujarFormato(copia, base.n, mk);
    dibujarVersion(copia, base.n, version);
    const puntos = penalizacion(copia);
    if (!mejor || puntos < mejor.puntos) mejor = { puntos, copia };
  }
  return mejor.copia;
}

// ---------- Salidas ----------
/** SVG con zona de silencio de 4 módulos. */
function qrSvg(texto, { escala = 8 } = {}) {
  const matriz = generarQr(texto);
  const n = matriz.length;
  const total = (n + 8) * escala;
  let trazos = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matriz[y][x]) trazos += `M${(x + 4) * escala} ${(y + 4) * escala}h${escala}v${escala}h-${escala}z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${trazos}" fill="#000"/></svg>`
  );
}

let TABLA_CRC = null;
function crc32(buffer) {
  if (!TABLA_CRC) {
    TABLA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLA_CRC[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunkPng(tipo, datos) {
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(datos.length, 0);
  cabecera.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([cabecera.subarray(4), datos])), 0);
  return Buffer.concat([cabecera, datos, crc]);
}

/** PNG en escala de grises, 1 byte por píxel, con zona de silencio de 4 módulos. */
function qrPng(texto, { escala = 8 } = {}) {
  const zlib = require('zlib');
  const matriz = generarQr(texto);
  const lado = (matriz.length + 8) * escala;
  const filas = [];
  for (let py = 0; py < lado; py++) {
    const fila = Buffer.alloc(lado + 1, 255);
    fila[0] = 0; // filtro "none"
    const my = Math.floor(py / escala) - 4;
    if (my >= 0 && my < matriz.length) {
      for (let px = 0; px < lado; px++) {
        const mx = Math.floor(px / escala) - 4;
        if (mx >= 0 && mx < matriz.length && matriz[my][mx]) fila[px + 1] = 0;
      }
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 0; // escala de grises
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', ihdr),
    chunkPng('IDAT', zlib.deflateSync(Buffer.concat(filas))),
    chunkPng('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { generarQr, qrSvg, qrPng };
