import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EstadoReserva from '../components/ui/EstadoReserva';
import { botonPrimario, botonSecundario, inputClase } from '../components/ui/Campo';
import { useAuth } from '../context/AuthContext';
import { useSeleccion } from '../context/SeleccionContext';
import { reservaService } from '../services/reservaService';
import { fechaCorta, hoyISO, mensajeError, moneda } from '../utils/formato';

const CLAVE_AUTO = 'pms_escaneo_automatico';
const leerAuto = () => {
  try {
    return localStorage.getItem(CLAVE_AUTO) === '1';
  } catch {
    return false;
  }
};

const HAY_CAMARA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const CONTEXTO_SEGURO = typeof window !== 'undefined' && window.isSecureContext;

/**
 * Escanear QR: tres formas de llegar a una reserva.
 *  1) Cámara en vivo: BarcodeDetector (Chrome/Edge) o jsQR (Safari/Firefox). Requiere HTTPS o localhost.
 *  2) Cámara nativa del teléfono: el QR es una URL /escanear?c=CODIGO que abre esta pantalla.
 *  3) Escribir el código de 8 caracteres a mano.
 */
export default function EscanearPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { seleccionarReserva, refrescar } = useSeleccion();
  const [codigo, setCodigo] = useState(params.get('c') || '');
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [camara, setCamara] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const video = useRef(null);

  const { esGestion } = useAuth();
  const [aviso, setAviso] = useState(null);
  const [auto, setAuto] = useState(leerAuto);
  const autoRef = useRef(auto);
  const ultimoAuto = useRef({ codigo: null, hora: 0 }); // evita repetir la acción (StrictMode / recargas)

  function cambiarAuto(valor) {
    setAuto(valor);
    autoRef.current = valor;
    try {
      localStorage.setItem(CLAVE_AUTO, valor ? '1' : '0');
    } catch {
      /* sin almacenamiento: solo vale para esta sesión */
    }
  }

  /** Qué toca hacer con esta reserva al escanearla. */
  function accionSugerida(r) {
    const hoy = hoyISO();
    const abierta = ['pendiente', 'confirmada'].includes(r.estado);
    if (r.estado === 'checkin') return 'checkout';
    if (abierta && hoy >= r.fechaEntrada && hoy < r.fechaSalida) return 'checkin';
    if (r.estado === 'pendiente') return 'confirmar';
    return null;
  }

  const ETIQUETA = { confirmar: 'Reserva confirmada', checkin: 'Check-in realizado', checkout: 'Check-out realizado' };

  async function aplicar(r, tipo) {
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      if (tipo === 'confirmar') await reservaService.cambiarEstado(r.id, 'confirmada');
      else if (tipo === 'checkin') await reservaService.checkin(r.id);
      else {
        try {
          await reservaService.checkout(r.id);
        } catch (err) {
          const datos = err.response?.data;
          if (datos?.codigo === 'SALDO_PENDIENTE' && esGestion && confirm(`${datos.error}\n\n¿Forzar el check-out de todos modos?`)) {
            await reservaService.checkout(r.id, true);
          } else {
            throw err;
          }
        }
      }
      refrescar();
      setReserva(await reservaService.porCodigo(r.codigo));
      setAviso(`✅ ${ETIQUETA[tipo]}.`);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo completar la acción.'));
    } finally {
      setProcesando(false);
    }
  }

  const buscar = useCallback(
    async (texto, { desdeQr = false } = {}) => {
      const valor = String(texto || '').trim();
      if (!valor) return;
      setBuscando(true);
      setError(null);
      setAviso(null);
      try {
        const r = await reservaService.porCodigo(valor);
        setReserva(r);
        // Modo automático: al leer un QR se ejecuta el siguiente paso (una sola vez por lectura)
        if (desdeQr && autoRef.current) {
          const ahora = Date.now();
          if (ultimoAuto.current.codigo === r.codigo && ahora - ultimoAuto.current.hora < 15000) return;
          ultimoAuto.current = { codigo: r.codigo, hora: ahora };
          const tipo = accionSugerida(r);
          if (tipo) await aplicar(r, tipo);
        }
      } catch (err) {
        setReserva(null);
        setError(mensajeError(err, 'No se pudo buscar la reserva.'));
      } finally {
        setBuscando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [esGestion]
  );

  // Llegada desde el QR (cámara nativa): /escanear?c=CODIGO
  useEffect(() => {
    const c = params.get('c');
    if (c) {
      setCodigo(c);
      buscar(c, { desdeQr: true });
    }
  }, [params, buscar]);

  // Cámara en vivo
  useEffect(() => {
    if (!camara) return undefined;
    let activo = true;
    let flujo = null;
    let temporizador = null;

    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!activo) return flujo.getTracks().forEach((t) => t.stop());
        video.current.srcObject = flujo;
        await video.current.play();
        const alEncontrar = (texto) => {
          setCamara(false);
          setCodigo(texto);
          buscar(texto, { desdeQr: true });
        };
        const nativo = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
        const jsQR = nativo ? null : (await import('jsqr')).default;
        const lienzo = document.createElement('canvas');
        const ctx = lienzo.getContext('2d', { willReadFrequently: true });

        const leer = async () => {
          if (!activo) return;
          try {
            const v = video.current;
            if (v && v.videoWidth) {
              if (nativo) {
                const [hallado] = await nativo.detect(v);
                if (hallado?.rawValue) return alEncontrar(hallado.rawValue);
              } else {
                const escala = Math.min(1, 640 / v.videoWidth);
                lienzo.width = Math.round(v.videoWidth * escala);
                lienzo.height = Math.round(v.videoHeight * escala);
                ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
                const imagen = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
                const hallado = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'dontInvert' });
                if (hallado?.data) return alEncontrar(hallado.data);
              }
            }
          } catch {
            /* fotograma no listo: se reintenta */
          }
          temporizador = setTimeout(leer, 200);
          return undefined;
        };
        leer();
      } catch {
        setError('No se pudo abrir la cámara (permiso denegado o sin HTTPS). Escribe el código a mano.');
        setCamara(false);
      }
    })();

    return () => {
      activo = false;
      clearTimeout(temporizador);
      if (flujo) flujo.getTracks().forEach((t) => t.stop());
    };
  }, [camara, buscar]);

  function enviarFormulario(e) {
    e.preventDefault();
    setParams({}, { replace: true });
    buscar(codigo);
  }

  const hoy = hoyISO();
  const abierta = reserva && ['pendiente', 'confirmada'].includes(reserva.estado);
  const puedeCheckin = abierta && hoy >= reserva.fechaEntrada && hoy < reserva.fechaSalida;
  const puedeConfirmar = reserva && reserva.estado === 'pendiente';
  const puedeCheckout = reserva && reserva.estado === 'checkin';

  return (
    <div className="pms-pagina" style={{ maxWidth: 640 }}>
      <h1 className="pms-titulo">Escanear QR</h1>
      <p className="pms-subtitulo mb-4">Localiza una reserva con la cámara o escribiendo su código.</p>

      <form onSubmit={enviarFormulario} className="d-flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código de reserva (ej. 5A570577)"
          maxLength={200}
          className={`${inputClase} font-monospace text-uppercase`}
          style={{ letterSpacing: '0.12em' }}
          aria-label="Código de reserva"
        />
        <button type="submit" disabled={buscando || !codigo.trim()} className={`${botonPrimario} px-4`}>
          {buscando ? '…' : 'Buscar'}
        </button>
      </form>

      <div className="mt-3">
        {HAY_CAMARA && CONTEXTO_SEGURO ? (
          <button type="button" onClick={() => setCamara((c) => !c)} className={botonSecundario}>
            <i className={`bi ${camara ? 'bi-x-circle' : 'bi-camera'} me-1`} />
            {camara ? 'Cerrar cámara' : 'Escanear con la cámara'}
          </button>
        ) : (
          <div className="pms-aviso">
            La cámara solo se puede abrir en una página segura (HTTPS o localhost). Abre el sistema con
            https:// (inicia el frontend con <b>npm run dev:https</b>), o usa la app de cámara del teléfono, o escribe el código.
          </div>
        )}
      </div>

      <div className="form-check form-switch mt-3">
        <input
          id="escaneo-auto"
          type="checkbox"
          role="switch"
          className="form-check-input"
          checked={auto}
          onChange={(e) => cambiarAuto(e.target.checked)}
        />
        <label htmlFor="escaneo-auto" className="form-check-label small">
          Modo automático: al leer un QR hace solo el siguiente paso (check-in si llegó hoy, check-out si ya está
          hospedado; si está pendiente y aún no es su fecha, la confirma).
        </label>
      </div>

      {camara && (
        <div className="mt-3 rounded-3 overflow-hidden border border-hueso bg-black">
          <video
            ref={video}
            muted
            playsInline
            className="d-block mx-auto w-100"
            style={{ maxWidth: 380, aspectRatio: '1 / 1', objectFit: 'cover' }}
          />
        </div>
      )}

      {error && <div className="alert alert-danger small mt-3 mb-0">{error}</div>}

      {reserva && (
        <div className="pms-card mt-4 p-4 d-grid gap-2">
          <div className="d-flex align-items-start justify-content-between gap-3">
            <div>
              <div className="font-serif fs-3 lh-1">{reserva.huespedNombre}</div>
              <div className="small text-tierra mt-1" style={{ letterSpacing: '0.12em' }}>#{reserva.codigo}</div>
            </div>
            <EstadoReserva estado={reserva.estado} />
          </div>
          <div className="small">
            <i className="bi bi-calendar3 me-1 text-tierra" />
            {fechaCorta(reserva.fechaEntrada)} → {fechaCorta(reserva.fechaSalida)} · {reserva.noches} noche(s)
          </div>
          <div className="small text-tierra">
            <i className="bi bi-door-open me-1" />
            Habitación: {reserva.habitaciones.map((h) => `${h.numero} (${h.tipo})`).join(', ')}
          </div>
          <div className="small">
            <span className="text-tierra">Saldo: </span>
            <span className={reserva.saldo > 0.009 ? 'fw-semibold text-vino' : 'fw-semibold text-success'}>
              {moneda(reserva.saldo)}
            </span>
          </div>
          <div className="d-flex flex-wrap gap-2 pt-1">
            {puedeConfirmar && (
              <button onClick={() => aplicar(reserva, 'confirmar')} disabled={procesando} className={puedeCheckin ? botonSecundario : botonPrimario}>
                Confirmar reserva
              </button>
            )}
            {puedeCheckin && (
              <button onClick={() => aplicar(reserva, 'checkin')} disabled={procesando} className={botonPrimario}>
                Hacer check-in
              </button>
            )}
            {puedeCheckout && (
              <button onClick={() => aplicar(reserva, 'checkout')} disabled={procesando} className={botonPrimario}>
                Hacer check-out
              </button>
            )}
            <button
              onClick={() => {
                seleccionarReserva(reserva.id);
                navigate('/reservas');
              }}
              className={botonSecundario}
            >
              Ver detalle completo
            </button>
          </div>
          {aviso && <div className="alert alert-success small py-2 mb-0">{aviso}</div>}
          {abierta && !puedeCheckin && (
            <div className="small text-claro">El check-in solo está disponible desde la fecha de entrada hasta antes de la salida.</div>
          )}
        </div>
      )}
    </div>
  );
}
