import { moneda } from '../../utils/formato';
import { etiquetaPeriodo } from '../../utils/periodos';

const SEGMENTOS = [
  { campo: 'llegaron', clase: 'seg-llegaron', etiqueta: 'Llegaron' },
  { campo: 'porLlegar', clase: 'seg-porllegar', etiqueta: 'Por llegar' },
  { campo: 'noShow', clase: 'seg-noshow', etiqueta: 'No se presentaron' },
  { campo: 'canceladas', clase: 'seg-canceladas', etiqueta: 'Canceladas' },
];

function BarraDesenlace({ fila }) {
  if (!fila.reservas) return <span className="text-claro">—</span>;
  return (
    <div className="barra-desenlace">
      {SEGMENTOS.map((s) => (
        <div
          key={s.campo}
          title={`${s.etiqueta}: ${fila[s.campo]}`}
          className={s.clase}
          style={{ width: `${(fila[s.campo] / fila.reservas) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Detalle numérico por periodo + fila de totales. */
export default function TablaPeriodos({ serie, totales, granularidad, periodoActual }) {
  const num = 'text-end tabular';
  return (
    <section className="pms-card">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-4 pt-4">
        <h2 className="h4 text-vino mb-0">Detalle por periodo</h2>
        <ul className="list-unstyled d-flex flex-wrap gap-3 mb-0 small text-tierra">
          {SEGMENTOS.map((s) => (
            <li key={s.campo} className="d-flex align-items-center gap-1">
              <span className={`punto ${s.clase}`} />
              {s.etiqueta}
            </li>
          ))}
        </ul>
      </div>

      <div className="table-responsive p-2">
        <table className="table pms-tabla">
          <thead>
            <tr>
              <th>Periodo</th>
              <th className="text-end">Reservas</th>
              <th className="text-end">Huéspedes</th>
              <th className="text-end">Personas</th>
              <th className="text-end">Llegaron</th>
              <th className="text-end">Canceladas</th>
              <th className="text-end">No show</th>
              <th>Desenlace</th>
              <th className="text-end">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((fila) => (
              <tr key={fila.periodo} className={fila.periodo === periodoActual ? 'fila-activa' : ''}>
                <td className="fw-medium">{etiquetaPeriodo(fila.periodo, granularidad)}</td>
                <td className={num}>{fila.reservas}</td>
                <td className={num}>{fila.huespedes}</td>
                <td className={num}>{fila.personas}</td>
                <td className={num}>{fila.llegaron}</td>
                <td className={num}>{fila.canceladas}</td>
                <td className={num}>{fila.noShow}</td>
                <td><BarraDesenlace fila={fila} /></td>
                <td className={num}>{moneda(fila.ingresos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-semibold text-vino">
              <td>Total</td>
              <td className={num}>{totales.reservas}</td>
              <td className={num}>—</td>
              <td className={num}>{totales.personas}</td>
              <td className={num}>{totales.llegaron}</td>
              <td className={num}>{totales.canceladas}</td>
              <td className={num}>{totales.noShow}</td>
              <td />
              <td className={num}>{moneda(totales.ingresos)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
