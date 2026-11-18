import { useCallback, useEffect, useState } from 'react';
import RoomList from '../components/rooms/RoomList';
import RoomFormModal from '../components/rooms/RoomFormModal';
import RoomTypeManager from '../components/rooms/RoomTypeManager';
import { botonPrimario } from '../components/ui/Campo';
import { useAuth } from '../context/AuthContext';
import { useSeleccion } from '../context/SeleccionContext';
import { habitacionService } from '../services/habitacionService';
import { mensajeError } from '../utils/formato';

export default function HabitacionesPage() {
  const [habitaciones, setHabitaciones] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [habitacionEditar, setHabitacionEditar] = useState(null);
  const { esGestion } = useAuth();
  const { version, refrescar } = useSeleccion();

  const cargar = useCallback(async () => {
    try {
      const [listaHabitaciones, listaTipos] = await Promise.all([
        habitacionService.listar(),
        habitacionService.listarTipos(),
      ]);
      setHabitaciones(listaHabitaciones);
      setTipos(listaTipos);
      setError(null);
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar las habitaciones.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  async function manejarGuardar(datos) {
    if (habitacionEditar) await habitacionService.actualizar(habitacionEditar.id, datos);
    else await habitacionService.crear(datos);
    setModalAbierto(false);
    setHabitacionEditar(null);
    refrescar();
  }

  async function manejarCambiarEstado(id, estado) {
    try {
      await habitacionService.cambiarEstado(id, estado);
      refrescar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo cambiar el estado.'));
    }
  }

  async function manejarEliminar(id) {
    if (!confirm('¿Eliminar esta habitación? Si tiene reservas asociadas, márcala como inactiva en su lugar.')) return;
    try {
      await habitacionService.eliminar(id);
      refrescar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar la habitación.'));
    }
  }

  return (
    <div className="pms-pagina">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Habitaciones</h1>
          <p className="pms-subtitulo mb-0">{habitaciones.length} habitaciones registradas</p>
        </div>
        {esGestion && (
          <button
            onClick={() => {
              setHabitacionEditar(null);
              setModalAbierto(true);
            }}
            className={`${botonPrimario} px-4 py-2`}
          >
            <i className="bi bi-plus-lg me-1" /> Nueva habitación
          </button>
        )}
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small">{error}</div>
      ) : cargando ? (
        <p className="small text-claro">Cargando habitaciones…</p>
      ) : (
        <>
          <RoomList
            habitaciones={habitaciones}
            esGestion={esGestion}
            onCambiarEstado={manejarCambiarEstado}
            onEditar={(h) => {
              setHabitacionEditar(h);
              setModalAbierto(true);
            }}
            onEliminar={manejarEliminar}
          />
          <RoomTypeManager tipos={tipos} esGestion={esGestion} onCambio={cargar} />
        </>
      )}

      {modalAbierto && (
        <RoomFormModal
          habitacionInicial={habitacionEditar}
          tipos={tipos}
          onGuardar={manejarGuardar}
          onCerrar={() => {
            setModalAbierto(false);
            setHabitacionEditar(null);
          }}
        />
      )}
    </div>
  );
}
