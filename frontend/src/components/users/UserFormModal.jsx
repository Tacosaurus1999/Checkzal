import { useState } from 'react';
import { ROLES } from '../../utils/estados';
import { mensajeError } from '../../utils/formato';
import Modal from '../ui/Modal';
import Campo, { botonPrimario, botonSecundario, inputClase, selectClase } from '../ui/Campo';

/** Alta / edición de personal. En edición, la contraseña es opcional (solo si se quiere restablecer). */
export default function UserFormModal({ usuarioInicial, esPropio, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre: usuarioInicial?.nombre || '',
    email: usuarioInicial?.email || '',
    rol: usuarioInicial?.rol || 'recepcionista',
    password: '',
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const actualizar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));

  async function manejarSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const datos = { nombre: form.nombre, email: form.email, rol: form.rol };
    if (form.password) datos.password = form.password;
    try {
      await onGuardar(datos);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el usuario.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={usuarioInicial ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar}>
      <form onSubmit={manejarSubmit} className="d-grid gap-3">
        <Campo etiqueta="Nombre">
          <input required value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} className={inputClase} />
        </Campo>
        <Campo etiqueta="Correo electrónico">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => actualizar('email', e.target.value)}
            className={inputClase}
          />
        </Campo>
        <Campo etiqueta="Rol">
          <select
            value={form.rol}
            disabled={esPropio}
            onChange={(e) => actualizar('rol', e.target.value)}
            className={selectClase}
          >
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta={usuarioInicial ? 'Nueva contraseña (opcional)' : 'Contraseña'}>
          <input
            required={!usuarioInicial}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => actualizar('password', e.target.value)}
            className={inputClase}
            placeholder="Mínimo 8 caracteres, letras y números"
          />
        </Campo>

        {error && <div className="alert alert-danger py-2 small mb-0" role="alert">{error}</div>}

        <div className="d-flex justify-content-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={botonPrimario}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
