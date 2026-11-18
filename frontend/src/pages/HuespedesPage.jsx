import { useEffect, useState } from 'react';
import GuestList from '../components/guests/GuestList';
import GuestFormModal from '../components/guests/GuestFormModal';
import { botonPrimario, inputClase } from '../components/ui/Campo';
import { useAuth } from '../context/AuthContext';
import { huespedService } from '../services/huespedService';
import { mensajeError } from '../utils/formato';

export default function HuespedesPage() {
  const [huespedes, setHuespedes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [huespedEditar, setHuespedEditar] = useState(null);
  const { esGestion } = useAuth();

  useEffect(() => {
    const temporizador = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    huespedService
      .listar(q)
      .then((datos) => {
        if (cancelado) return;
        setHuespedes(datos);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeError(err, 'No se pudieron cargar los huéspedes.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [q, recarga]);

  async function manejarGuardar(datos) {
    if (huespedEditar) await huespedService.actualizar(huespedEditar.id, datos);
    else await huespedService.crear(datos);
    setModalAbierto(false);
    setHuespedEditar(null);
    setRecarga((n) => n + 1);
  }

  async function manejarEliminar(id) {
    if (!confirm('¿Eliminar este huésped? Solo es posible si no tiene reservas.')) return;
    try {
      await huespedService.eliminar(id);
      setRecarga((n) => n + 1);
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar el huésped.'));
    }
  }

  return (
    <div className="pms-pagina">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Huéspedes</h1>
          <p className="pms-subtitulo mb-0">{huespedes.length} huésped(es) en la vista actual</p>
        </div>
        <button
          onClick={() => {
            setHuespedEditar(null);
            setModalAbierto(true);
          }}
          className={`${botonPrimario} px-4 py-2`}
        >
          <i className="bi bi-plus-lg me-1" />
          Nuevo huésped
        </button>
      </div>

      <div className="input-group mb-4" style={{ maxWidth: '28rem' }}>
        <span className="input-group-text bg-white border-end-0 text-claro">
          <i className="bi bi-search" />
        </span>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono, correo o documento…"
          className={`${inputClase} border-start-0`}
        />
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert">{error}</div>
      ) : cargando ? (
        <p className="small text-claro">Cargando huéspedes…</p>
      ) : (
        <GuestList
          huespedes={huespedes}
          esGestion={esGestion}
          onEditar={(h) => {
            setHuespedEditar(h);
            setModalAbierto(true);
          }}
          onEliminar={manejarEliminar}
        />
      )}

      {modalAbierto && (
        <GuestFormModal
          huespedInicial={huespedEditar}
          onGuardar={manejarGuardar}
          onCerrar={() => {
            setModalAbierto(false);
            setHuespedEditar(null);
          }}
        />
      )}
    </div>
  );
}
