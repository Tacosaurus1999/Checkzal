import { useSeleccion } from '../../context/SeleccionContext';
import { fechaCorta, moneda } from '../../utils/formato';
import EstadoReserva from '../ui/EstadoReserva';

/**
 * Listado de reservas en formato "tracklist": código, huésped y habitaciones,
 * fechas, estado y saldo. Al seleccionar una fila se abre el DetailPanel.
 */
export default function ReservationList({ reservas }) {
  const { reservaId, seleccionarReserva } = useSeleccion();

  if (reservas.length === 0) {
    return <p className="small text-claro">No hay reservas que coincidan con los filtros.</p>;
  }

  return (
    <div className="pms-card overflow-hidden">
      <div className="table-responsive">
        <table className="table pms-tabla align-middle mb-0">
          <thead>
            <tr>
              <th>Código</th>
              <th>Huésped</th>
              <th>Estancia</th>
              <th>Estado</th>
              <th className="text-end">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr
                key={r.id}
                onClick={() => seleccionarReserva(r.id)}
                className={`fila-click ${reservaId === r.id ? 'fila-activa' : ''}`}
              >
                <td className="small fw-semibold text-tierra text-nowrap" style={{ letterSpacing: '0.1em' }}>
                  #{r.codigo}
                </td>

                <td>
                  <p className="mb-0 small fw-medium">{r.huespedNombre}</p>
                  <p className="mb-0 text-tierra celda-detalle">
                    Hab. {r.habitaciones.map((h) => h.numero).join(', ')} · {r.numAdultos + r.numNinos} pers. ·{' '}
                    {r.origen}
                  </p>
                </td>

                <td className="small text-nowrap">
                  <div>{fechaCorta(r.fechaEntrada)}</div>
                  <div className="text-claro">
                    → {fechaCorta(r.fechaSalida)} · {r.noches}n
                  </div>
                </td>

                <td>
                  <EstadoReserva estado={r.estado} />
                </td>

                <td className="text-end text-nowrap">
                  <div
                    className={`small fw-semibold ${
                      r.saldo > 0.009 && r.estado !== 'cancelada' ? 'text-vino' : 'text-tierra'
                    }`}
                  >
                    {r.estado === 'cancelada' ? '—' : moneda(r.saldo)}
                  </div>
                  <div className="text-claro celda-detalle">de {moneda(r.totalAPagar)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
