import { useEffect, useState } from 'react';
import ReservationList from '../components/reservations/ReservationList';
import ReservationFormModal from '../components/reservations/ReservationFormModal';
import { botonPrimario, inputClase, selectClase } from '../components/ui/Campo';
import { useSeleccion } from '../context/SeleccionContext';
import { reservaService } from '../services/reservaService';
import { ESTADOS_RESERVA } from '../utils/estados';
import { mensajeError } from '../utils/formato';

export default function ReservasPage() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const { version, refrescar, seleccionarReserva } = useSeleccion();

  // Retardo para no consultar en cada tecla
  useEffect(() => {
    const temporizador = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    reservaService
      .listar({ estado, q })
      .then((datos) => {
        if (cancelado) return;
        setReservas(datos);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeError(err, 'No se pudieron cargar las reservas.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [estado, q, version]);

  function manejarCreada(reserva) {
    setModalAbierto(false);
    seleccionarReserva(reserva.id);
    refrescar();
  }

  return (
    <div className="pms-pagina">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Reservas</h1>
          <p className="pms-subtitulo mb-0">{reservas.length} reserva(s) en la vista actual</p>
        </div>
        <button onClick={() => setModalAbierto(true)} className={`${botonPrimario} px-4 py-2`}>
          <i className="bi bi-plus-lg me-1" /> Nueva reserva
        </button>
      </div>

      <div className="d-flex flex-wrap gap-3 mb-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código o huésped…"
          className={`${inputClase} filtro-busqueda`}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${selectClase} filtro-estado`}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_RESERVA).map(([valor, config]) => (
            <option key={valor} value={valor}>
              {config.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small">{error}</div>
      ) : cargando ? (
        <p className="small text-claro">Cargando reservas…</p>
      ) : (
        <ReservationList reservas={reservas} />
      )}

      {modalAbierto && <ReservationFormModal onCreada={manejarCreada} onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
