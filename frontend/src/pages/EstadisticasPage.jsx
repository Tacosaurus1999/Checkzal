import { useEffect, useState } from 'react';
import Campo, { inputClase, botonSecundario } from '../components/ui/Campo';
import ResumenEstadisticas from '../components/stats/ResumenEstadisticas';
import GraficaIngresos from '../components/stats/GraficaIngresos';
import TablaPeriodos from '../components/stats/TablaPeriodos';
import { dashboardService } from '../services/dashboardService';
import { GRANULARIDADES } from '../utils/periodos';
import { mensajeError } from '../utils/formato';

/** SOLO administrador — ruta /estadisticas */
export default function EstadisticasPage() {
  const [granularidad, setGranularidad] = useState('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    dashboardService
      .estadisticas({ granularidad, desde, hasta })
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((err) => vigente && setError(mensajeError(err, 'No se pudieron cargar las estadísticas.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [granularidad, desde, hasta]);

  function cambiarGranularidad(valor) {
    setGranularidad(valor);
    setDesde(''); // vuelve a la ventana por defecto de esa granularidad
    setHasta('');
  }

  return (
    <div className="pms-pagina">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Estadísticas</h1>
          <p className="pms-subtitulo mb-0">
            Reservas, llegadas, cancelaciones e ingresos del hotel. Solo visible para administradores.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-end gap-3">
          <div className="btn-group" role="group" aria-label="Periodo">
            {GRANULARIDADES.map((g) => (
              <button
                key={g.valor}
                type="button"
                onClick={() => cambiarGranularidad(g.valor)}
                className={`btn btn-sm px-3 ${granularidad === g.valor ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                {g.etiqueta}
              </button>
            ))}
          </div>
          <Campo etiqueta="Desde">
            <input type="date" className={inputClase} value={desde || datos?.desde || ''} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta">
            <input type="date" className={inputClase} value={hasta || datos?.hasta || ''} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
          {(desde || hasta) && (
            <button className={botonSecundario} onClick={() => { setDesde(''); setHasta(''); }}>
              Restablecer
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert">{error}</div>
      ) : !datos ? (
        <p className="small text-claro">{cargando ? 'Cargando estadísticas…' : 'Sin datos.'}</p>
      ) : (
        <div className={cargando ? 'opacity-50' : ''} style={{ transition: 'opacity 0.15s' }}>
          <ResumenEstadisticas totales={datos.totales} />
          <GraficaIngresos serie={datos.serie} granularidad={datos.granularidad} periodoActual={datos.periodoActual} />
          <TablaPeriodos
            serie={datos.serie}
            totales={datos.totales}
            granularidad={datos.granularidad}
            periodoActual={datos.periodoActual}
          />
          <p className="mt-3 small text-claro">
            Las reservas se agrupan por su fecha de entrada. «Llegaron» incluye check-in y check-out; las tasas se calculan
            sobre las reservas con desenlace conocido (llegaron, canceladas y no show). Los ingresos son pagos recibidos,
            agrupados por la fecha del pago.
          </p>
        </div>
      )}
    </div>
  );
}
