import { useSeleccion } from '../../context/SeleccionContext';
import { ESTADOS_HABITACION } from '../../utils/estados';
import { moneda } from '../../utils/formato';

/**
 * Grid de habitaciones: cada tarjeta se colorea según el ENUM estado_habitacion
 * (disponible, ocupada, limpieza, mantenimiento). Al hacer clic se selecciona
 * para cambiar su estado operativo desde la barra inferior.
 */
export default function RoomGrid({ habitaciones }) {
  const { habitacion: seleccionada, seleccionarHabitacion } = useSeleccion();
  const activas = habitaciones.filter((h) => h.activa);

  if (activas.length === 0) {
    return <p className="small text-claro">Aún no hay habitaciones activas registradas.</p>;
  }

  const pisos = [...new Set(activas.map((h) => h.piso))].sort((a, b) => a - b);

  return (
    <div className="d-flex flex-column gap-4">
      {pisos.map((piso) => (
        <div key={piso}>
          <p className="pms-kicker mb-2">Piso {piso}</p>
          <div className="row g-3">
            {activas
              .filter((h) => h.piso === piso)
              .map((h) => {
                const config = ESTADOS_HABITACION[h.estado];
                const esSeleccionada = seleccionada?.id === h.id;
                return (
                  <div key={h.id} className="col-6 col-sm-4 col-lg-3">
                    <button
                      type="button"
                      onClick={() => seleccionarHabitacion(h)}
                      aria-pressed={esSeleccionada}
                      className={`hab ${config.tarjeta} ${esSeleccionada ? 'activa' : ''}`}
                    >
                      <div className="d-flex align-items-start justify-content-between">
                        <span className="pms-cifra">{h.numero}</span>
                        <span className={`punto mt-1 ${config.punto}`} />
                      </div>
                      <p className="mt-3 mb-0 small fw-medium">{h.tipo}</p>
                      <p className="mb-0 small opacity-75">{h.capacidad} pers.</p>
                      <p className="mt-3 mb-0 hab-estado">{config.etiqueta}</p>
                      <p className="mb-0 small opacity-75">{moneda(h.precioBase)} / noche</p>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
