import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar, { NavMovil } from './components/layout/Sidebar';
import BottomBar from './components/layout/BottomBar';
import DetailPanel from './components/layout/DetailPanel';
import Login from './components/auth/Login';
import PanelPage from './pages/PanelPage';
import ReservasPage from './pages/ReservasPage';
import HabitacionesPage from './pages/HabitacionesPage';
import HuespedesPage from './pages/HuespedesPage';
import UsuariosPage from './pages/UsuariosPage';
import PerfilPage from './pages/PerfilPage';
import EstadisticasPage from './pages/EstadisticasPage';
import EscanearPage from './pages/EscanearPage';

function Cargando() {
  return (
    <div className="d-flex min-vh-100 align-items-center justify-content-center text-tierra">
      <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando…
    </div>
  );
}

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Cargando />;
  // Se recuerda la ruta (p. ej. /escanear?c=... al abrir un QR con la cámara) para volver tras iniciar sesión.
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />;

  return children;
}

/** Igual que RutaProtegida, pero además exige rol de administrador. */
function RutaAdmin({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== 'admin') return <Navigate to="/panel" replace />;

  return children;
}

function LayoutPrincipal({ children }) {
  return (
    <div className="pms-app">
      <div className="pms-cuerpo">
        <Sidebar />
        <main className="pms-main">{children}</main>
        <DetailPanel />
      </div>
      <BottomBar />
      <NavMovil />
    </div>
  );
}

function Protegida({ children }) {
  return (
    <RutaProtegida>
      <LayoutPrincipal>{children}</LayoutPrincipal>
    </RutaProtegida>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/panel" element={<Protegida><PanelPage /></Protegida>} />
      <Route path="/reservas" element={<Protegida><ReservasPage /></Protegida>} />
      <Route path="/escanear" element={<Protegida><EscanearPage /></Protegida>} />
      <Route path="/habitaciones" element={<Protegida><HabitacionesPage /></Protegida>} />
      <Route path="/huespedes" element={<Protegida><HuespedesPage /></Protegida>} />
      <Route path="/perfil" element={<Protegida><PerfilPage /></Protegida>} />

      {/* Vista exclusiva de administrador */}
      <Route
        path="/usuarios"
        element={
          <RutaAdmin>
            <LayoutPrincipal>
              <UsuariosPage />
            </LayoutPrincipal>
          </RutaAdmin>
        }
      />

      <Route
        path="/estadisticas"
        element={
          <RutaAdmin>
            <LayoutPrincipal>
              <EstadisticasPage />
            </LayoutPrincipal>
          </RutaAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
