import { ESTADOS_HABITACION } from '../../utils/estados';
import { moneda } from '../../utils/formato';
import { botonPeligro, botonSecundario, selectClase } from '../ui/Campo';

/** Tabla de habitaciones: cambio de estado operativo para todos; edición/baja para admin y gerente. */
export default function RoomList({ habitaciones, esGestion, onCambiarEstado, onEditar, onEliminar }) {
  if (habitaciones.length === 0) {
    return <p className="small text-claro">Todavía no hay habitaciones registradas.</p>;
  }

  return (
    <div className="pms-card overflow-hidden">
      <div className="table-responsive">
        <table className="table pms-tabla align-middle mb-0">
          <thead>
            <tr>
              <th>Núm.</th>
              <th>Tipo</th>
              <th>Piso</th>
              <th>Estado</th>
              <th className="text-end">Precio base</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {habitaciones.map((h) => {
              const ocupada = h.estado === 'ocupada';
              return (
                <tr key={h.id} className={h.activa ? '' : 'opacity-50'}>
                  <td className="pms-cifra" style={{ fontSize: '1.5rem' }}>{h.numero}</td>

                  <td>
                    <p className="mb-0 small fw-medium">{h.tipo}</p>
                    <p className="mb-0 text-tierra celda-detalle">
                      {h.capacidad} pers.{h.activa ? '' : ' · inactiva'}
                      {h.notas ? ` · ${h.notas}` : ''}
                    </p>
                  </td>

                  <td className="small text-tierra">{h.piso}</td>

                  <td style={{ minWidth: '10rem' }}>
                    <select
                      value={h.estado}
                      disabled={ocupada}
                      title={ocupada ? 'El check-out libera la habitación' : undefined}
                      onChange={(e) => onCambiarEstado(h.id, e.target.value)}
                      className={`${selectClase} form-select-sm`}
                    >
                      {Object.entries(ESTADOS_HABITACION).map(([valor, config]) => (
                        <option key={valor} value={valor} disabled={valor === 'ocupada' && !ocupada}>
                          {config.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="text-end small text-nowrap">{moneda(h.precioBase)}</td>

                  <td>
                    <div className="d-flex justify-content-end gap-2">
                      {esGestion && (
                        <>
                          <button onClick={() => onEditar(h)} className={botonSecundario}>
                            Editar
                          </button>
                          <button onClick={() => onEliminar(h.id)} className={botonPeligro}>
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
