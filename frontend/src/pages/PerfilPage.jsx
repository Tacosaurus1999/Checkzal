import { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { etiquetaRol } from '../utils/estados';
import { fechaHora, mensajeError } from '../utils/formato';

/** Perfil real vía GET /api/auth/perfil */
export default function PerfilPage() {
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    authService
      .obtenerPerfil()
      .then(setPerfil)
      .catch((err) => setError(mensajeError(err, 'No se pudo cargar el perfil.')));
  }, []);

  const filas = perfil
    ? [
        ['Nombre', perfil.nombre],
        ['Correo', perfil.email],
        ['Rol', etiquetaRol(perfil.rol)],
        ['Hotel', perfil.hotelNombre],
        ['Miembro desde', fechaHora(perfil.creadoEn)],
      ]
    : [];

  return (
    <div className="pms-pagina">
      <h1 className="pms-titulo mb-4">Perfil</h1>

      {error && <div className="alert alert-danger small">{error}</div>}
      {!perfil && !error && <p className="small text-claro">Cargando perfil…</p>}

      {perfil && (
        <div className="pms-card" style={{ maxWidth: 520 }}>
          <ul className="list-group list-group-flush rounded-3">
            {filas.map(([etiqueta, valor]) => (
              <li
                key={etiqueta}
                className="list-group-item d-flex align-items-center justify-content-between gap-3 px-4 py-3"
                style={{ background: 'transparent', borderColor: 'var(--hueso-borde)' }}
              >
                <span className="pms-kicker">{etiqueta}</span>
                <span className="small">{valor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
