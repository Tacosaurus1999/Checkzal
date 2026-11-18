import { useEffect, useState } from 'react';
import { useSeleccion } from '../../context/SeleccionContext';
import { dashboardService } from '../../services/dashboardService';
import { habitacionService } from '../../services/habitacionService';
import { ESTADOS_HABITACION } from '../../utils/estados';
import { mensajeError } from '../../utils/formato';

const ACCIONES = [
  { estado: 'disponible', etiqueta: 'Lista' },
  { estado: 'limpieza', etiqueta: 'Limpieza' },
  { estado: 'mantenimiento', etiqueta: 'Mantenimiento' },
];

/**
 * Barra inferior: habitación seleccionada (cambio rápido de estado operativo)
 * y ocupación del día por hotel (vista v_ocupacion_hoy).
 */
export default function BottomBar() {
  const { habitacion, seleccionarHabitacion, version, refrescar } = useSeleccion();
  const [ocupacion, setOcupacion] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    dashboardService
      .resumen()
      .then((datos) => {
        if (!cancelado) setOcupacion(datos.ocupacion);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [version]);

  async function cambiarEstado(estado) {
    setError(null);
    try {
      const actualizada = await habitacionService.cambiarEstado(habitacion.id, estado);
      seleccionarHabitacion(actualizada);
      refrescar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cambiar el estado.'));
    }
  }

  const config = habitacion ? ESTADOS_HABITACION[habitacion.estado] : null;
  const esOcupada = habitacion?.estado === 'ocupada';
  const porcentaje = ocupacion ? Math.min(100, ocupacion.porcentajeOcupacion) : 0;

  return (
    <footer className="pms-bottombar d-flex align-items-center justify-content-between gap-3">
      {/* Habitación seleccionada */}
      <div className="d-flex align-items-center gap-3 flex-fill" style={{ minWidth: 0 }}>
        {habitacion ? (
          <>
            <div
              className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-3 font-serif fs-4"
              style={{ width: 46, height: 46, background: 'var(--cafe)', color: 'var(--hueso)' }}
            >
              {habitacion.numero}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="small fw-medium text-truncate">
                Habitación {habitacion.numero} · {habitacion.tipo}
              </div>
              <div className="d-flex align-items-center gap-2 small text-tierra text-truncate">
                <span className={`punto ${config?.puntoResumen}`} />
                {config?.etiqueta} · Piso {habitacion.piso}
              </div>
            </div>
          </>
        ) : (
          <span className="small text-claro">Selecciona una habitación del panel</span>
        )}
      </div>

      {/* Acciones rápidas de estado */}
      <div className="d-flex flex-column align-items-center gap-1 flex-fill">
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-center">
          {ACCIONES.map((accion) => (
            <button
              key={accion.estado}
              disabled={!habitacion || esOcupada || habitacion.estado === accion.estado}
              onClick={() => cambiarEstado(accion.estado)}
              title={esOcupada ? 'El check-out libera la habitación' : `Marcar como ${accion.etiqueta.toLowerCase()}`}
              className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            >
              {accion.etiqueta}
            </button>
          ))}
        </div>
        {error ? (
          <span className="small text-danger">{error}</span>
        ) : (
          <span className="small text-claro d-none d-sm-inline">Estado operativo</span>
        )}
      </div>

      {/* Ocupación del día */}
      <div className="d-none d-md-flex align-items-center justify-content-end gap-3 flex-fill">
        {ocupacion && (
          <>
            <div className="text-end">
              <div className="pms-cifra text-vino" style={{ fontSize: '1.6rem' }}>{porcentaje}%</div>
              <div className="small text-claro">
                {ocupacion.ocupadas}/{ocupacion.totalHabitaciones} hoy
              </div>
            </div>
            <div className="progress" style={{ width: 112, height: 6 }}>
              <div className="progress-bar" style={{ width: `${porcentaje}%` }} />
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
