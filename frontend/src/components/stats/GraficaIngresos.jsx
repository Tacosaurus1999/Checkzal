import { moneda } from '../../utils/formato';
import { etiquetaPeriodo } from '../../utils/periodos';

/** Columnas de ingresos cobrados por periodo (sin librerías externas). El periodo actual va en vino. */
export default function GraficaIngresos({ serie, granularidad, periodoActual }) {
  const maximo = Math.max(1, ...serie.map((fila) => fila.ingresos));
  const mostrarValores = serie.length <= 14;
  const ancho = { minWidth: `${serie.length * 56}px` };

  return (
    <section className="pms-card p-4 mb-4">
      <h2 className="h4 text-vino mb-1">Ingresos por periodo</h2>
      <p className="small text-tierra mb-3">Pagos recibidos (anticipos y abonos) según la fecha del pago.</p>

      <div className="overflow-x-auto">
        <div className="grafica-columnas" style={ancho}>
          {serie.map((fila) => {
            const alto = Math.round((fila.ingresos / maximo) * 100);
            const actual = fila.periodo === periodoActual;
            return (
              <div key={fila.periodo} className="grafica-columna">
                {mostrarValores && (
                  <span className="grafica-valor">{fila.ingresos > 0 ? moneda(fila.ingresos) : ''}</span>
                )}
                <div
                  title={`${etiquetaPeriodo(fila.periodo, granularidad)}: ${moneda(fila.ingresos)}`}
                  className={`grafica-barra ${actual ? 'grafica-barra-actual' : ''}`}
                  style={{ height: `${Math.max(alto, fila.ingresos > 0 ? 2 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="grafica-ejes" style={ancho}>
          {serie.map((fila) => (
            <span key={fila.periodo}>{etiquetaPeriodo(fila.periodo, granularidad)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
