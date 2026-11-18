import { useState } from 'react';
import { TIPOS_DOCUMENTO } from '../../utils/estados';
import { mensajeError } from '../../utils/formato';
import Modal from '../ui/Modal';
import Campo, { botonPrimario, botonSecundario, inputClase, selectClase } from '../ui/Campo';

const VACIO = {
  nombre: '',
  apellidos: '',
  email: '',
  telefono: '',
  tipoDocumento: '',
  numeroDocumento: '',
  nacionalidad: 'Mexicana',
  fechaNacimiento: '',
  notas: '',
};

/** Alta / edición de huésped. */
export default function GuestFormModal({ huespedInicial, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    huespedInicial
      ? {
          nombre: huespedInicial.nombre,
          apellidos: huespedInicial.apellidos,
          email: huespedInicial.email || '',
          telefono: huespedInicial.telefono || '',
          tipoDocumento: huespedInicial.tipoDocumento || '',
          numeroDocumento: huespedInicial.numeroDocumento || '',
          nacionalidad: huespedInicial.nacionalidad || 'Mexicana',
          fechaNacimiento: huespedInicial.fechaNacimiento || '',
          notas: huespedInicial.notas || '',
        }
      : VACIO
  );
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const actualizar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));

  async function manejarSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        tipoDocumento: form.tipoDocumento || null,
        numeroDocumento: form.numeroDocumento.trim() || null,
        nacionalidad: form.nacionalidad.trim() || 'Mexicana',
        fechaNacimiento: form.fechaNacimiento || null,
        notas: form.notas.trim() || null,
      });
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el huésped.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={huespedInicial ? 'Editar huésped' : 'Nuevo huésped'} ancho="max-w-lg" onCerrar={onCerrar}>
      <form onSubmit={manejarSubmit} className="d-grid gap-3">
        <div className="row g-3">
          <Campo etiqueta="Nombre" className="col-sm-6">
            <input required value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} className={inputClase} />
          </Campo>
          <Campo etiqueta="Apellidos" className="col-sm-6">
            <input required value={form.apellidos} onChange={(e) => actualizar('apellidos', e.target.value)} className={inputClase} />
          </Campo>
          <Campo etiqueta="Teléfono" className="col-sm-6">
            <input value={form.telefono} onChange={(e) => actualizar('telefono', e.target.value)} className={inputClase} />
          </Campo>
          <Campo etiqueta="Correo" className="col-sm-6">
            <input type="email" value={form.email} onChange={(e) => actualizar('email', e.target.value)} className={inputClase} />
          </Campo>
          <Campo etiqueta="Tipo de documento" className="col-sm-6">
            <select value={form.tipoDocumento} onChange={(e) => actualizar('tipoDocumento', e.target.value)} className={selectClase}>
              <option value="">Sin documento</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Número de documento" className="col-sm-6">
            <input
              value={form.numeroDocumento}
              disabled={!form.tipoDocumento}
              onChange={(e) => actualizar('numeroDocumento', e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo etiqueta="Nacionalidad" className="col-sm-6">
            <input value={form.nacionalidad} onChange={(e) => actualizar('nacionalidad', e.target.value)} className={inputClase} />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" className="col-sm-6">
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => actualizar('fechaNacimiento', e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        <Campo etiqueta="Notas">
          <textarea
            rows={2}
            value={form.notas}
            onChange={(e) => actualizar('notas', e.target.value)}
            className={inputClase}
            placeholder="Preferencias, alergias a tener en cuenta del servicio, etc."
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
