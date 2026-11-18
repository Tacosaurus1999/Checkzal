import { ROLES } from '../../utils/estados';
import { botonPeligro, botonSecundario, selectClase } from '../ui/Campo';

/** Personal del hotel: cambiar rol, activar/desactivar, editar y eliminar (solo admin). */
export default function UserList({ usuarios, usuarioActualId, onActualizar, onEditar, onEliminar }) {
  if (usuarios.length === 0) {
    return <p className="small text-claro">No hay personal registrado.</p>;
  }

  return (
    <div className="pms-card overflow-hidden">
      <div className="table-responsive">
        <table className="table pms-tabla align-middle">
          <thead>
            <tr>
              <th>Usuario</th>
              <th style={{ width: '12rem' }}>Rol</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const esPropio = u.id === usuarioActualId;
              return (
                <tr key={u.id} className={u.activo ? '' : 'opacity-50'}>
                  <td>
                    <div className="fw-medium text-truncate" style={{ maxWidth: '18rem' }}>
                      {u.nombre}
                      {esPropio && <span className="ms-2 small fw-normal text-claro">(tú)</span>}
                    </div>
                    <div className="small text-tierra text-truncate" style={{ maxWidth: '18rem' }}>{u.email}</div>
                  </td>

                  <td>
                    <select
                      value={u.rol}
                      disabled={esPropio}
                      onChange={(e) => onActualizar(u.id, { rol: e.target.value })}
                      className={`${selectClase} form-select-sm`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {r.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <button
                      type="button"
                      disabled={esPropio}
                      onClick={() => onActualizar(u.id, { activo: !u.activo })}
                      className={`estado-badge ${u.activo ? 'estado-checkout' : 'estado-no_show'}`}
                      style={{ cursor: esPropio ? 'not-allowed' : 'pointer' }}
                      title={esPropio ? 'No puedes desactivar tu propia cuenta' : 'Clic para cambiar'}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>

                  <td className="text-end text-nowrap">
                    <div className="d-inline-flex gap-2">
                      <button onClick={() => onEditar(u)} className={botonSecundario}>
                        Editar
                      </button>
                      {!esPropio && (
                        <button onClick={() => onEliminar(u.id)} className={botonPeligro}>
                          Eliminar
                        </button>
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
