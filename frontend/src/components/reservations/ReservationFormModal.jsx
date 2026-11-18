import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { habitacionService } from '../../services/habitacionService';
import { huespedService } from '../../services/huespedService';
import { reservaService } from '../../services/reservaService';
import { ORIGENES_RESERVA } from '../../utils/estados';
import { hoyISO, mensajeError, moneda, nochesEntre, sumarDias } from '../../utils/formato';
import Modal from '../ui/Modal';
import Campo, { botonPrimario, botonSecundario, inputClase, selectClase } from '../ui/Campo';

const HUESPED_NUEVO = { nombre: '', apellidos: '', telefono: '', email: '' };

/**
 * Alta de reserva en un solo paso:
 *   1. Fechas -> disponibilidad real (función SQL habitaciones_disponibles)
 *   2. Habitaciones (admin/gerente pueden ajustar el precio por noche)
 *   3. Huésped existente o nuevo
 * Si otra persona toma el cuarto antes, el backend responde 409 (SOBREVENTA) y se avisa aquí.
 */
export default function ReservationFormModal({ onCreada, onCerrar }) {
  const { esGestion } = useAuth();

  const [entrada, setEntrada] = useState(hoyISO());
  const [salida, setSalida] = useState(sumarDias(hoyISO(), 1));
  const [disponibles, setDisponibles] = useState([]);
  const [cargandoDisp, setCargandoDisp] = useState(false);
  const [seleccion, setSeleccion] = useState({}); // habitacionId -> precioNoche (texto)

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [huesped, setHuesped] = useState(null);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoHuesped, setNuevoHuesped] = useState(HUESPED_NUEVO);

  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [origen, setOrigen] = useState('directa');
  const [estado, setEstado] = useState('confirmada');
  const [notas, setNotas] = useState('');

  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const noches = nochesEntre(entrada, salida);
  const rangoValido = noches > 0;

  // Disponibilidad al cambiar fechas
  useEffect(() => {
    if (!rangoValido) {
      setDisponibles([]);
      return undefined;
    }
    let cancelado = false;
    setCargandoDisp(true);
    habitacionService
      .disponibilidad(entrada, salida)
      .then((datos) => {
        if (cancelado) return;
        setDisponibles(datos.disponibles);
        // Descarta selecciones que ya no estén disponibles en el nuevo rango
        setSeleccion((actual) => {
          const ids = new Set(datos.disponibles.map((d) => d.habitacionId));
          return Object.fromEntries(Object.entries(actual).filter(([id]) => ids.has(Number(id))));
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeError(err, 'No se pudo consultar la disponibilidad.'));
      })
      .finally(() => {
        if (!cancelado) setCargandoDisp(false);
      });
    return () => {
      cancelado = true;
    };
  }, [entrada, salida, rangoValido]);

  // Búsqueda de huéspedes (con pequeño retardo)
  useEffect(() => {
    if (modoNuevo || huesped || busqueda.trim().length < 2) {
      setResultados([]);
      return undefined;
    }
    const temporizador = setTimeout(() => {
      huespedService
        .listar(busqueda.trim())
        .then((datos) => setResultados(datos.slice(0, 6)))
        .catch(() => setResultados([]));
    }, 250);
    return () => clearTimeout(temporizador);
  }, [busqueda, huesped, modoNuevo]);

  function alternarHabitacion(h) {
    setSeleccion((actual) => {
      const copia = { ...actual };
      if (copia[h.habitacionId] !== undefined) delete copia[h.habitacionId];
      else copia[h.habitacionId] = String(h.precioBase);
      return copia;
    });
  }

  const elegidas = useMemo(
    () => disponibles.filter((d) => seleccion[d.habitacionId] !== undefined),
    [disponibles, seleccion]
  );
  const capacidad = elegidas.reduce((acc, h) => acc + h.capacidad, 0);
  const total = elegidas.reduce((acc, h) => acc + Number(seleccion[h.habitacionId] || 0) * noches, 0);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!rangoValido) return setError('La salida debe ser posterior a la entrada.');
    if (elegidas.length === 0) return setError('Selecciona al menos una habitación.');
    if (!modoNuevo && !huesped) return setError('Selecciona un huésped o registra uno nuevo.');
    if (Number(adultos) + Number(ninos) > capacidad) {
      return setError(`Las habitaciones elegidas solo tienen capacidad para ${capacidad} persona(s).`);
    }

    setGuardando(true);
    try {
      let huespedId = huesped?.id;
      if (modoNuevo) {
        const creado = await huespedService.crear({
          nombre: nuevoHuesped.nombre,
          apellidos: nuevoHuesped.apellidos,
          telefono: nuevoHuesped.telefono || null,
          email: nuevoHuesped.email || null,
        });
        huespedId = creado.id;
      }

      const reserva = await reservaService.crear({
        huespedId,
        fechaEntrada: entrada,
        fechaSalida: salida,
        numAdultos: Number(adultos),
        numNinos: Number(ninos),
        origen,
        estado,
        notas: notas.trim() || null,
        habitaciones: elegidas.map((h) => {
          const linea = { habitacionId: h.habitacionId };
          // Solo se envía el precio si fue modificado (los recepcionistas usan el precio base)
          if (esGestion && Number(seleccion[h.habitacionId]) !== h.precioBase) {
            linea.precioNoche = Number(seleccion[h.habitacionId]);
          }
          return linea;
        }),
      });
      await onCreada(reserva);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear la reserva.'));
      // Ante una sobreventa o conflicto, se refresca la disponibilidad mostrada
      if (err.response?.status === 409 && rangoValido) {
        habitacionService
          .disponibilidad(entrada, salida)
          .then((datos) => setDisponibles(datos.disponibles))
          .catch(() => {});
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nueva reserva" ancho="max-w-2xl" onCerrar={onCerrar}>
      <form onSubmit={manejarSubmit} className="d-flex flex-column gap-4">
        {/* 1. Fechas */}
        <section className="d-flex flex-column gap-2">
          <h4 className="pms-kicker mb-0">1 · Fechas</h4>
          <div className="row g-3">
            <Campo etiqueta="Entrada" className="col-6">
              <input
                required
                type="date"
                value={entrada}
                onChange={(e) => {
                  setEntrada(e.target.value);
                  if (e.target.value >= salida) setSalida(sumarDias(e.target.value, 1));
                }}
                className={inputClase}
              />
            </Campo>
            <Campo etiqueta="Salida" className="col-6">
              <input
                required
                type="date"
                min={sumarDias(entrada, 1)}
                value={salida}
                onChange={(e) => setSalida(e.target.value)}
                className={inputClase}
              />
            </Campo>
          </div>
          <p className="small text-tierra mb-0">{rangoValido ? `${noches} noche(s)` : 'Rango de fechas inválido'}</p>
        </section>

        {/* 2. Habitaciones */}
        <section className="d-flex flex-column gap-2">
          <h4 className="pms-kicker mb-0">2 · Habitaciones disponibles</h4>
          {cargandoDisp ? (
            <p className="small text-claro mb-0">Consultando disponibilidad…</p>
          ) : disponibles.length === 0 ? (
            <p className="small text-claro mb-0">No hay habitaciones disponibles en esas fechas.</p>
          ) : (
            <ul className="list-unstyled row g-2 mb-0">
              {disponibles.map((h) => {
                const elegida = seleccion[h.habitacionId] !== undefined;
                return (
                  <li key={h.habitacionId} className="col-12 col-sm-6">
                    <div className={`opcion-habitacion h-100 ${elegida ? 'elegida' : ''}`}>
                      <label className="d-flex align-items-start gap-2" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={elegida}
                          onChange={() => alternarHabitacion(h)}
                          className="form-check-input mt-1 flex-shrink-0"
                        />
                        <div className="flex-grow-1 min-w-0">
                          <p className="small mb-0">
                            <span className="font-serif fs-5">{h.numero}</span> · {h.tipo}
                          </p>
                          <p className="mb-0 text-tierra celda-detalle">
                            {h.capacidad} pers. · {moneda(h.precioBase)} base
                          </p>
                        </div>
                      </label>
                      {elegida && esGestion && (
                        <div className="mt-2 ps-4">
                          <Campo etiqueta="Precio por noche">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={seleccion[h.habitacionId]}
                              onChange={(e) => setSeleccion((a) => ({ ...a, [h.habitacionId]: e.target.value }))}
                              className={inputClase}
                            />
                          </Campo>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {elegidas.length > 0 && (
            <p className="small mb-0">
              Total estimado: <span className="fw-semibold text-vino">{moneda(total)}</span>{' '}
              <span className="text-tierra celda-detalle">· capacidad {capacidad} pers.</span>
            </p>
          )}
        </section>

        {/* 3. Huésped */}
        <section className="d-flex flex-column gap-2">
          <div className="d-flex align-items-center justify-content-between">
            <h4 className="pms-kicker mb-0">3 · Huésped titular</h4>
            <button
              type="button"
              onClick={() => {
                setModoNuevo((v) => !v);
                setHuesped(null);
                setBusqueda('');
              }}
              className="btn btn-link btn-sm p-0 text-vino fw-medium"
            >
              {modoNuevo ? 'Buscar existente' : '+ Registrar nuevo'}
            </button>
          </div>

          {modoNuevo ? (
            <div className="row g-3">
              <Campo etiqueta="Nombre" className="col-6">
                <input
                  required
                  value={nuevoHuesped.nombre}
                  onChange={(e) => setNuevoHuesped((a) => ({ ...a, nombre: e.target.value }))}
                  className={inputClase}
                />
              </Campo>
              <Campo etiqueta="Apellidos" className="col-6">
                <input
                  required
                  value={nuevoHuesped.apellidos}
                  onChange={(e) => setNuevoHuesped((a) => ({ ...a, apellidos: e.target.value }))}
                  className={inputClase}
                />
              </Campo>
              <Campo etiqueta="Teléfono" className="col-6">
                <input
                  value={nuevoHuesped.telefono}
                  onChange={(e) => setNuevoHuesped((a) => ({ ...a, telefono: e.target.value }))}
                  className={inputClase}
                />
              </Campo>
              <Campo etiqueta="Correo" className="col-6">
                <input
                  type="email"
                  value={nuevoHuesped.email}
                  onChange={(e) => setNuevoHuesped((a) => ({ ...a, email: e.target.value }))}
                  className={inputClase}
                />
              </Campo>
            </div>
          ) : huesped ? (
            <div className="opcion-habitacion elegida d-flex align-items-center justify-content-between">
              <div>
                <p className="small fw-medium mb-0">{huesped.nombreCompleto}</p>
                <p className="mb-0 text-tierra celda-detalle">{huesped.telefono || huesped.email || 'Sin contacto'}</p>
              </div>
              <button type="button" onClick={() => setHuesped(null)} className="btn btn-link btn-sm p-0 text-tierra">
                Cambiar
              </button>
            </div>
          ) : (
            <div>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={inputClase}
                placeholder="Buscar por nombre, teléfono, correo o documento…"
              />
              {resultados.length > 0 && (
                <ul className="list-group mt-2">
                  {resultados.map((h) => (
                    <li key={h.id} className="list-group-item list-group-item-action p-0 border-hueso">
                      <button
                        type="button"
                        onClick={() => setHuesped(h)}
                        className="resultado-huesped"
                      >
                        <span>{h.nombreCompleto}</span>
                        <span className="text-tierra celda-detalle">{h.telefono || h.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* 4. Detalles */}
        <section className="d-flex flex-column gap-2">
          <h4 className="pms-kicker mb-0">4 · Detalles</h4>
          <div className="row g-3">
            <Campo etiqueta="Adultos" className="col-6 col-sm-3">
              <input type="number" min="1" value={adultos} onChange={(e) => setAdultos(e.target.value)} className={inputClase} />
            </Campo>
            <Campo etiqueta="Niños" className="col-6 col-sm-3">
              <input type="number" min="0" value={ninos} onChange={(e) => setNinos(e.target.value)} className={inputClase} />
            </Campo>
            <Campo etiqueta="Origen" className="col-6 col-sm-3">
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={selectClase}>
                {ORIGENES_RESERVA.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Estado inicial" className="col-6 col-sm-3">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={selectClase}>
                <option value="confirmada">Confirmada</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Notas">
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={inputClase}
              placeholder="Hora de llegada, peticiones especiales…"
            />
          </Campo>
        </section>

        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={botonPrimario}>
            {guardando ? 'Reservando…' : 'Crear reserva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
