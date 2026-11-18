import { botonPeligro, botonSecundario } from '../ui/Campo';
import { fechaCorta } from '../../utils/formato';

/** Directorio de huéspedes en formato tabla. */
export default function GuestList({ huespedes, esGestion, onEditar, onEliminar }) {
  if (huespedes.length === 0) {
    return <p className="small text-claro">No se encontraron huéspedes.</p>;
  }

  return (
    <div className="pms-card overflow-hidden">
      <div className="table-responsive">
        <table className="table pms-tabla align-middle">
          <thead>
            <tr>
              <th>Huésped</th>
              <th>Contacto</th>
              <th>Documento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {huespedes.map((h) => (
              <tr key={h.id}>
                <td>
                  <div className="fw-medium text-truncate" style={{ maxWidth: '18rem' }}>{h.nombreCompleto}</div>
                  <div className="small text-tierra text-truncate" style={{ maxWidth: '18rem' }}>
                    {h.nacionalidad}
                    {h.fechaNacimiento ? ` · nac. ${fechaCorta(h.fechaNacimiento)}` : ''}
                  </div>
                </td>
                <td className="small">
                  <div className="text-truncate" style={{ maxWidth: '14rem' }}>{h.telefono || '—'}</div>
                  <div className="text-tierra text-truncate" style={{ maxWidth: '14rem' }}>{h.email || ''}</div>
                </td>
                <td className="small text-tierra">
                  {h.tipoDocumento ? `${h.tipoDocumento} · ${h.numeroDocumento}` : '—'}
                </td>
                <td className="text-end text-nowrap">
                  <div className="d-inline-flex gap-2">
                    <button onClick={() => onEditar(h)} className={botonSecundario}>
                      Editar
                    </button>
                    {esGestion && (
                      <button onClick={() => onEliminar(h.id)} className={botonPeligro}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
