import { useEffect, useState } from 'react';
import ResumenOcupacion from '../components/dashboard/ResumenOcupacion';
import RoomGrid from '../components/dashboard/RoomGrid';
import OperacionesDia from '../components/dashboard/OperacionesDia';
import ReservationFormModal from '../components/reservations/ReservationFormModal';
import { botonPrimario } from '../components/ui/Campo';
import { useSeleccion } from '../context/SeleccionContext';
import { dashboardService } from '../services/dashboardService';
import { habitacionService } from '../services/habitacionService';
import { fechaLarga, mensajeError } from '../utils/formato';

export default function PanelPage() {
  const [habitaciones, setHabitaciones] = useState([]);
  const [resumen, setResumen] = useState({ ocupacion: null, llegadas: [], salidas: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const { version, refrescar, habitacion, seleccionarHabitacion, seleccionarReserva } = useSeleccion();

  useEffect(() => {
    let cancelado = false;
    Promise.all([habitacionService.listar(), dashboardService.resumen()])
      .then(([listaHabitaciones, datosResumen]) => {
        if (cancelado) return;
        setHabitaciones(listaHabitaciones);
        setResumen(datosResumen);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeError(err, 'No se pudo cargar el panel.'));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [version]);

  // Mantiene sincronizada la habitación seleccionada (barra inferior) tras recargar.
  useEffect(() => {
    if (!habitacion) return;
    const actualizada = habitaciones.find((h) => h.id === habitacion.id);
    if (actualizada && actualizada.estado !== habitacion.estado) seleccionarHabitacion(actualizada);
  }, [habitaciones, habitacion, seleccionarHabitacion]);

  async function manejarCreada(reserva) {
    setModalAbierto(false);
    seleccionarReserva(reserva.id);
    refrescar();
  }

  return (
    <div className="pms-pagina">
      <header className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Panel de operaciones</h1>
          <p className="pms-subtitulo pms-primera-mayus mt-1 mb-0">{fechaLarga()}</p>
        </div>
        <button onClick={() => setModalAbierto(true)} className={`${botonPrimario} px-4 py-2`}>
          <i className="bi bi-plus-lg me-1" /> Nueva reserva
        </button>
      </header>

      {error && <div className="alert alert-danger py-2 small mb-4">{error}</div>}

      {cargando ? (
        <p className="small text-claro">Cargando panel…</p>
      ) : (
        <>
          <ResumenOcupacion
            habitaciones={habitaciones}
            ocupacion={resumen.ocupacion}
            llegadas={resumen.llegadas.length}
            salidas={resumen.salidas.length}
          />

          <div className="row g-4">
            <section className="col-12 col-xl-8">
              <h2 className="h3 mb-3">Habitaciones</h2>
              <RoomGrid habitaciones={habitaciones} />
            </section>

            <div className="col-12 col-xl-4">
              <OperacionesDia llegadas={resumen.llegadas} salidas={resumen.salidas} />
            </div>
          </div>
        </>
      )}

      {modalAbierto && <ReservationFormModal onCreada={manejarCreada} onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
