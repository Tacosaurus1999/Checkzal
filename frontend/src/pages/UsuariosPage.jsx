import { useEffect, useState } from 'react';
import UserList from '../components/users/UserList';
import UserFormModal from '../components/users/UserFormModal';
import { botonPrimario } from '../components/ui/Campo';
import { useAuth } from '../context/AuthContext';
import { usuarioService } from '../services/usuarioService';
import { mensajeError } from '../utils/formato';

/** SOLO administrador — ruta /usuarios */
export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState(null);
  const { usuario: actual } = useAuth();

  async function cargarUsuarios() {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await usuarioService.listar());
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar el personal.'));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function manejarGuardar(datos) {
    if (usuarioEditar) await usuarioService.actualizar(usuarioEditar.id, datos);
    else await usuarioService.crear(datos);
    setModalAbierto(false);
    setUsuarioEditar(null);
    await cargarUsuarios();
  }

  async function manejarActualizar(id, cambios) {
    try {
      await usuarioService.actualizar(id, cambios);
      await cargarUsuarios();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo actualizar el usuario.'));
    }
  }

  async function manejarEliminar(id) {
    if (!confirm('¿Eliminar este usuario? Si ya registró reservas o pagos, desactívalo en su lugar.')) return;
    try {
      await usuarioService.eliminar(id);
      await cargarUsuarios();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar el usuario.'));
    }
  }

  return (
    <div className="pms-pagina">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 className="pms-titulo">Personal</h1>
          <p className="pms-subtitulo mb-0">{usuarios.length} usuario(s) con acceso al sistema</p>
        </div>
        <button
          onClick={() => {
            setUsuarioEditar(null);
            setModalAbierto(true);
          }}
          className={`${botonPrimario} px-4 py-2`}
        >
          <i className="bi bi-plus-lg me-1" />
          Nuevo usuario
        </button>
      </div>

      {cargando ? (
        <p className="small text-claro">Cargando personal…</p>
      ) : error ? (
        <div className="alert alert-danger py-2 small" role="alert">{error}</div>
      ) : (
        <UserList
          usuarios={usuarios}
          usuarioActualId={actual?.id}
          onActualizar={manejarActualizar}
          onEditar={(u) => {
            setUsuarioEditar(u);
            setModalAbierto(true);
          }}
          onEliminar={manejarEliminar}
        />
      )}

      {modalAbierto && (
        <UserFormModal
          usuarioInicial={usuarioEditar}
          esPropio={usuarioEditar?.id === actual?.id}
          onGuardar={manejarGuardar}
          onCerrar={() => {
            setModalAbierto(false);
            setUsuarioEditar(null);
          }}
        />
      )}
    </div>
  );
}
