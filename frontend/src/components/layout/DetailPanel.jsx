import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSeleccion } from '../../context/SeleccionContext';
import { pagoService } from '../../services/pagoService';
import { reservaService } from '../../services/reservaService';
import { fechaCorta, fechaHora, hoyISO, mensajeError, moneda } from '../../utils/formato';
import { botonPeligro, botonPrimario, botonSecundario } from '../ui/Campo';
import EstadoReserva from '../ui/EstadoReserva';
import PaymentForm from '../reservations/PaymentForm';
import QrReserva from '../reservations/QrReserva';

/**
 * Panel derecho: detalle de la reserva seleccionada, acciones del ciclo de vida
 * (confirmar → check-in → check-out / cancelar / no-show) y pagos.
 */
export default function DetailPanel() {
  const { reservaId, seleccionarReserva, version, refrescar } = useSeleccion();
  const { esAdmin, esGestion } = useAuth();
  const [abierto, setAbierto] = useState(true);
  const [reserva, setReserva] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reservaId) {
      setReserva(null);
      setPagos([]);
      return undefined;
    }

    let cancelado = false;
    setCargando(true);
    Promise.all([reservaService.obtener(reservaId), pagoService.listar(reservaId)])
      .then(([datosReserva, datosPagos]) => {
        if (cancelado) return;
        setReserva(datosReserva);
        setPagos(datosPagos.pagos);
        setError(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setReserva(null);
        setError(mensajeError(err, 'No se pudo cargar la reserva.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [reservaId, version]);

  async function ejecutar(accion, confirmacion) {
    if (confirmacion && !confirm(confirmacion)) return;
    setProcesando(true);
    setError(null);
    try {
      await accion();
      refrescar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo completar la acción.'));
    } finally {
      setProcesando(false);
    }
  }

  async function hacerCheckout() {
    setProcesando(true);
    setError(null);
    try {
      await reservaService.checkout(reserva.id);
      refrescar();
    } catch (err) {
      const datos = err.response?.data;
      if (datos?.codigo === 'SALDO_PENDIENTE' && esGestion) {
        if (confirm(`${datos.error}\n\n¿Forzar el check-out de todos modos?`)) {
          try {
            await reservaService.checkout(reserva.id, true);
            refrescar();
          } catch (errForzado) {
            setError(mensajeError(errForzado, 'No se pudo hacer el check-out.'));
          }
        }
      } else {
        setError(mensajeError(err, 'No se pudo hacer el check-out.'));
      }
    } finally {
      setProcesando(false);
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta reserva de forma permanente?')) return;
    setProcesando(true);
    setError(null);
    try {
      await reservaService.eliminar(reserva.id);
      seleccionarReserva(null);
      refrescar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo eliminar la reserva.'));
    } finally {
      setProcesando(false);
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="pms-detalle-tab" aria-label="Mostrar detalle de reserva">
        <i className="bi bi-chevron-left" />
      </button>
    );
  }

  const estado = reserva?.estado;
  const puedeCobrar = reserva && reserva.saldo > 0.009 && estado !== 'cancelada';
  // Mismas reglas que la API: check-in entre la entrada (incl.) y la salida (excl.); no-show desde la entrada.
  const hoy = hoyISO();
  const abierta = reserva && ['pendiente', 'confirmada'].includes(estado);
  const puedeCheckin = abierta && hoy >= reserva.fechaEntrada && hoy < reserva.fechaSalida;
  const puedeNoShow = abierta && hoy >= reserva.fechaEntrada;
  const eliminable =
    esAdmin && reserva && ['pendiente', 'cancelada', 'no_show'].includes(estado) && reserva.totalPagado === 0;

  return (
    <aside className="pms-detalle">
      <div className="d-flex align-items-center justify-content-between px-4 pt-4">
        <h2 className="h4 text-vino mb-0">Detalle de reserva</h2>
        <button onClick={() => setAbierto(false)} className="btn btn-sm btn-link text-tierra p-0" aria-label="Ocultar detalle de reserva">
          <i className="bi bi-chevron-right" />
        </button>
      </div>

      <div className="px-4 pb-4 pt-3 d-grid gap-3">
        {!reservaId && (
          <p className="small text-claro mb-0">
            Selecciona una reserva, o una llegada/salida del día, para ver su detalle, cobrar o hacer check-in.
          </p>
        )}
        {cargando && !reserva && <p className="small text-claro mb-0">Cargando…</p>}
        {error && <div className="alert alert-danger small py-2 mb-0">{error}</div>}

        {reserva && (
          <>
            <div>
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div className="font-serif fs-3 lh-1">{reserva.huespedNombre}</div>
                  <div className="small text-tierra mt-1" style={{ letterSpacing: '0.12em' }}>#{reserva.codigo}</div>
                </div>
                <EstadoReserva estado={reserva.estado} />
              </div>
              {reserva.huespedTelefono && <div className="small text-tierra mt-1">☎ {reserva.huespedTelefono}</div>}
            </div>

            <dl className="row g-3 m-0 p-3 rounded-3 small" style={{ background: 'var(--hueso-alt)' }}>
              <div className="col-6 p-0 pe-2">
                <dt className="pms-kicker">Entrada</dt>
                <dd className="mb-0">{fechaCorta(reserva.fechaEntrada)}</dd>
              </div>
              <div className="col-6 p-0 ps-2">
                <dt className="pms-kicker">Salida</dt>
                <dd className="mb-0">{fechaCorta(reserva.fechaSalida)}</dd>
              </div>
              <div className="col-6 p-0 pe-2">
                <dt className="pms-kicker">Noches</dt>
                <dd className="mb-0">{reserva.noches}</dd>
              </div>
              <div className="col-6 p-0 ps-2">
                <dt className="pms-kicker">Huéspedes</dt>
                <dd className="mb-0">
                  {reserva.numAdultos} adulto(s){reserva.numNinos > 0 ? ` · ${reserva.numNinos} niño(s)` : ''}
                </dd>
              </div>
            </dl>

            <div>
              <p className="pms-kicker mb-1">Habitaciones</p>
              <ul className="list-unstyled mb-0 d-grid gap-1">
                {reserva.habitaciones.map((h) => (
                  <li key={h.habitacionId} className="d-flex align-items-center justify-content-between small">
                    <span>
                      <span className="font-serif fs-5">{h.numero}</span> · {h.tipo}
                    </span>
                    <span className="text-tierra">{moneda(h.precioNoche)}/noche</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pms-card p-3 small d-grid gap-1" style={{ boxShadow: 'none' }}>
              <div className="d-flex justify-content-between">
                <span className="text-tierra">Total a pagar</span>
                <span>{moneda(reserva.totalAPagar)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-tierra">Pagado</span>
                <span>{moneda(reserva.totalPagado)}</span>
              </div>
              <div className="d-flex justify-content-between border-top border-hueso pt-1 fw-semibold">
                <span>Saldo</span>
                <span className={reserva.saldo > 0.009 ? 'text-vino' : 'text-success'}>{moneda(reserva.saldo)}</span>
              </div>
            </div>

            {reserva.notas && <div className="pms-aviso">{reserva.notas}</div>}

            {/* Acciones del ciclo de vida */}
            <div className="d-flex flex-wrap gap-2">
              {estado === 'pendiente' && (
                <button
                  disabled={procesando}
                  onClick={() => ejecutar(() => reservaService.cambiarEstado(reserva.id, 'confirmada'))}
                  className={botonSecundario}
                >
                  Confirmar
                </button>
              )}
              {puedeCheckin && (
                <button
                  disabled={procesando}
                  onClick={() => ejecutar(() => reservaService.checkin(reserva.id))}
                  className={botonPrimario}
                >
                  Check-in
                </button>
              )}
              {estado === 'checkin' && (
                <button disabled={procesando} onClick={hacerCheckout} className={botonPrimario}>
                  Check-out
                </button>
              )}
              {abierta && (
                <>
                  {puedeNoShow && (
                    <button
                      disabled={procesando}
                      onClick={() =>
                        ejecutar(
                          () => reservaService.cambiarEstado(reserva.id, 'no_show'),
                          '¿Marcar como no-show? Se liberarán las habitaciones.'
                        )
                      }
                      className={botonSecundario}
                    >
                      No-show
                    </button>
                  )}
                  <button
                    disabled={procesando}
                    onClick={() =>
                      ejecutar(
                        () => reservaService.cambiarEstado(reserva.id, 'cancelada'),
                        '¿Cancelar la reserva? Se liberarán las habitaciones.'
                      )
                    }
                    className={botonPeligro}
                  >
                    Cancelar
                  </button>
                </>
              )}
              {eliminable && (
                <button disabled={procesando} onClick={eliminar} className={botonPeligro}>
                  Eliminar
                </button>
              )}
            </div>

            <QrReserva reserva={reserva} />

            {/* Pagos */}
            <div>
              <p className="pms-kicker mb-2">Pagos</p>
              {pagos.length === 0 ? (
                <p className="small text-claro mb-0">Sin pagos registrados.</p>
              ) : (
                <ul className="list-group list-group-flush pms-card mb-3" style={{ boxShadow: 'none' }}>
                  {pagos.map((p) => (
                    <li
                      key={p.id}
                      className="list-group-item d-flex align-items-center justify-content-between px-3 py-2 small"
                      style={{ background: 'transparent', borderColor: 'var(--hueso-borde)' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-medium text-capitalize">{p.metodo}</div>
                        <div className="text-claro text-truncate">
                          {fechaHora(p.fecha)}
                          {p.referencia ? ` · ${p.referencia}` : ''}
                        </div>
                      </div>
                      <span className="fw-semibold">{moneda(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {puedeCobrar && (
                <PaymentForm key={`${reserva.id}-${pagos.length}`} reservaId={reserva.id} saldo={reserva.saldo} onRegistrado={refrescar} />
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
