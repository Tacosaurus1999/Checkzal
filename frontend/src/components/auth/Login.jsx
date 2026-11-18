import logo from '../../assets/logo.png';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { botonPrimario, inputClase } from '../ui/Campo';
import { mensajeError } from '../../utils/formato';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.desde || '/panel';

  if (usuario) return <Navigate to={destino} replace />;

  async function manejarSubmit(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login({ email, password });
      navigate(destino, { replace: true });
    } catch (err) {
      setError(mensajeError(err, 'No se pudo iniciar sesión. Intenta de nuevo.'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pms-login p-0">
      <div className="row g-0 w-100 min-vh-100">
        <div
          className="col-lg-6 d-none d-lg-flex flex-column justify-content-between p-5"
          style={{ background: 'var(--cafe)', color: 'var(--hueso)' }}
        >
          <span className="d-flex align-items-center gap-3">
            <span className="pms-logo pms-logo-lg"><img src={logo} alt="" /></span>
            <span className="font-serif fs-2">Checkzal</span>
          </span>
          <div>
            <p className="font-serif fw-semibold mb-3" style={{ fontSize: '3rem', lineHeight: 1.1 }}>
              Cada habitación,
              <br />
              siempre en su lugar.
            </p>
            <p className="small mb-0" style={{ maxWidth: 380, color: 'rgba(253,251,247,.7)' }}>
              Reservas sin sobreventas, check-in y check-out ordenados y el estado de cada cuarto a la vista.
            </p>
          </div>
          <span className="pms-kicker" style={{ color: 'rgba(253,251,247,.5)' }}>
            San Cristóbal · Tuxtla Gutiérrez
          </span>
        </div>

        <div className="col-lg-6 d-flex align-items-center justify-content-center p-4">
          <div className="w-100" style={{ maxWidth: 380 }}>
            <div className="d-flex align-items-center gap-2 mb-4 d-lg-none">
              <img src={logo} alt="" width="44" height="44" />
              <span className="font-serif fs-3 text-vino">Checkzal</span>
            </div>
            <h1 className="pms-titulo" style={{ fontSize: '2.6rem' }}>Bienvenido</h1>
            <p className="pms-subtitulo mt-1 mb-4">Inicia sesión con tu cuenta del hotel</p>

            <form onSubmit={manejarSubmit} className="d-grid gap-3">
              <div>
                <label className="pms-label d-block">Correo electrónico</label>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClase}
                  placeholder="nombre@hotel.mx"
                />
              </div>

              <div>
                <label className="pms-label d-block">Contraseña</label>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClase}
                />
              </div>

              {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}

              <button type="submit" disabled={cargando} className={`${botonPrimario} w-100 py-2`}>
                {cargando ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
