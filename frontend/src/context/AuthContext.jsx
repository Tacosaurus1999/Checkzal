import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    }
    setCargando(false);
  }, []);

  async function login(credenciales) {
    const { usuario: usuarioAutenticado, token } = await authService.login(credenciales);
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuarioAutenticado));
    setUsuario(usuarioAutenticado);
    return usuarioAutenticado;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  const esAdmin = usuario?.rol === 'admin';
  // admin y gerente: precios, catálogo de habitaciones, bajas y forzar check-out
  const esGestion = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  return (
    <AuthContext.Provider value={{ usuario, cargando, esAdmin, esGestion, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
