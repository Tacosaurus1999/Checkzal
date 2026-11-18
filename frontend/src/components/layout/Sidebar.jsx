import logo from '../../assets/logo.png';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { etiquetaRol } from '../../utils/estados';

const MODULOS = [
  { to: '/panel', etiqueta: 'Panel', icono: 'bi-grid-1x2' },
  { to: '/reservas', etiqueta: 'Reservas', icono: 'bi-journal-text' },
  { to: '/escanear', etiqueta: 'Escanear QR', icono: 'bi-qr-code-scan' },
  { to: '/habitaciones', etiqueta: 'Habitaciones', icono: 'bi-door-open' },
  { to: '/huespedes', etiqueta: 'Huéspedes', icono: 'bi-people' },
  { to: '/perfil', etiqueta: 'Perfil', icono: 'bi-person-circle' },
];

const MODULOS_ADMIN = [
  { to: '/estadisticas', etiqueta: 'Estadísticas', icono: 'bi-bar-chart-line' },
  { to: '/usuarios', etiqueta: 'Personal', icono: 'bi-person-badge' },
];

function Enlace({ modulo }) {
  return (
    <NavLink to={modulo.to}>
      <i aria-hidden className={`bi ${modulo.icono}`} />
      {modulo.etiqueta}
    </NavLink>
  );
}

/** Navegación inferior para pantallas pequeñas (el menú lateral se oculta por debajo de 768 px). */
export function NavMovil() {
  const { esAdmin } = useAuth();
  const items = [
    ['/panel', 'Panel', 'bi-grid-1x2'],
    ['/reservas', 'Reservas', 'bi-journal-text'],
    ['/escanear', 'Escanear', 'bi-qr-code-scan'],
    ['/habitaciones', 'Cuartos', 'bi-door-open'],
    ['/huespedes', 'Huéspedes', 'bi-people'],
    ...(esAdmin ? [['/estadisticas', 'Stats', 'bi-bar-chart-line']] : []),
  ];
  return (
    <nav className="pms-movil" aria-label="Navegación">
      {items.map(([to, etiqueta, icono]) => (
        <NavLink key={to} to={to}>
          <i aria-hidden className={`bi ${icono}`} />
          {etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const { usuario, esAdmin, logout } = useAuth();

  return (
    <aside className="pms-sidebar">
      <div className="pms-marca d-flex flex-column align-items-center text-center gap-2">
        <span className="pms-logo pms-logo-xl"><img src={logo} alt="Checkzal" /></span>
        <div className="min-w-0 w-100">
          <div className="nombre">Checkzal</div>
          <div className="sub text-truncate">{usuario?.hotelNombre}</div>
        </div>
      </div>

      <nav className="pms-nav">
        <p className="pms-kicker px-2 mb-1" style={{ color: 'rgba(253,251,247,.4)' }}>Operación</p>
        {MODULOS.map((modulo) => (
          <Enlace key={modulo.to} modulo={modulo} />
        ))}

        {esAdmin && (
          <>
            <p className="pms-kicker px-2 mt-3 mb-1" style={{ color: 'rgba(253,251,247,.4)' }}>Administración</p>
            {MODULOS_ADMIN.map((modulo) => (
              <Enlace key={modulo.to} modulo={modulo} />
            ))}
          </>
        )}
      </nav>

      <div className="pms-nav-pie">
        <div className="pms-usuario">
          <div className="fw-medium text-truncate">{usuario?.nombre}</div>
          <small>{etiquetaRol(usuario?.rol)}</small>
        </div>
        <button onClick={logout} className="btn btn-outline-light btn-sm rounded-pill w-100 justify-content-center">
          <i className="bi bi-box-arrow-right me-1" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
