import { ESTADOS_HABITACION } from '../../utils/estados';

/** Tarjetas de resumen: ocupación del día (v_ocupacion_hoy) y conteo por estado_habitacion. */
export default function ResumenOcupacion({ habitaciones, ocupacion, llegadas, salidas }) {
  const activas = habitaciones.filter((h) => h.activa);
  const conteo = (estado) => activas.filter((h) => h.estado === estado).length;
  const porcentaje = ocupacion ? Math.min(100, ocupacion.porcentajeOcupacion) : 0;

  return (
    <section className="row g-3 mb-4">
      <div className="col-12">
        <div className="resumen-ocupacion h-100 p-3">
          <p className="mb-1 resumen-ocupacion-kicker">Ocupación de hoy</p>
          <div className="d-flex align-items-end gap-3">
            <span className="pms-cifra resumen-ocupacion-cifra">{porcentaje}%</span>
            <span className="pb-1 small resumen-ocupacion-suave">
              {ocupacion ? `${ocupacion.ocupadas} de ${ocupacion.totalHabitaciones} habitaciones` : '—'}
            </span>
          </div>
          <div className="resumen-ocupacion-barra mt-3">
            <div className="resumen-ocupacion-relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="mt-3 mb-0 small resumen-ocupacion-suave">
            {llegadas} llegada(s) · {salidas} salida(s)
          </p>
        </div>
      </div>

      {Object.entries(ESTADOS_HABITACION).map(([estado, config]) => (
        <div key={estado} className="col-6 col-md-3">
          <div className="pms-card h-100 p-3">
            <div className="pms-kicker d-flex align-items-center gap-2">
              <span className={`punto ${config.puntoResumen}`} />
              {config.etiqueta}
            </div>
            <p className="pms-cifra mt-2 mb-0 text-dark">{conteo(estado)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
