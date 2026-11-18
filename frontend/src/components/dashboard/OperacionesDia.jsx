import { useSeleccion } from '../../context/SeleccionContext';

/**
 * Panel de operaciones del día: llegadas y salidas (vista v_movimientos_hoy).
 * Al seleccionar un movimiento se abre la reserva en el panel de detalle.
 */
export default function OperacionesDia({ llegadas, salidas }) {
  const { reservaId, seleccionarReserva } = useSeleccion();

  const grupos = [
    { titulo: 'Llegadas', lista: llegadas, vacio: 'Sin llegadas hoy' },
    { titulo: 'Salidas', lista: salidas, vacio: 'Sin salidas hoy' },
  ];

  return (
    <section className="d-flex flex-column gap-3">
      <h3 className="h3 mb-0">Operaciones del día</h3>

      {grupos.map(({ titulo, lista, vacio }) => (
        <div key={titulo} className="pms-card">
          <div className="d-flex align-items-center justify-content-between border-bottom border-hueso px-3 py-2">
            <span className="pms-kicker text-tierra">{titulo}</span>
            <span className="badge rounded-pill text-bg-primary">{lista.length}</span>
          </div>
          <ul className="list-group list-group-flush">
            {lista.length === 0 && <li className="list-group-item small text-claro">{vacio}</li>}
            {lista.map((m) => (
              <li key={`${m.codigo}-${m.habitacion}-${m.movimiento}`} className="list-group-item p-0 border-hueso">
                <button
                  type="button"
                  onClick={() => seleccionarReserva(m.reservaId)}
                  className={`operacion-fila ${reservaId === m.reservaId ? 'activa' : ''}`}
                >
                  <div className="min-w-0 text-truncate">
                    <p className="mb-0 small fw-medium text-truncate">{m.huesped}</p>
                    <p className="mb-0 text-tierra operacion-codigo">#{m.codigo}</p>
                  </div>
                  <span className="pms-cifra text-vino flex-shrink-0 operacion-hab">Hab. {m.habitacion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
