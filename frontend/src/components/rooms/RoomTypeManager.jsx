import { useState } from 'react';
import { habitacionService } from '../../services/habitacionService';
import { mensajeError, moneda } from '../../utils/formato';
import Campo, { botonPeligro, botonPrimario, botonSecundario, inputClase } from '../ui/Campo';

const VACIO = { nombre: '', descripcion: '', capacidad: 2, precioBase: '' };

/** Catálogo de tipos de habitación (Sencilla, Doble, Suite…) con su capacidad y precio base. */
export default function RoomTypeManager({ tipos, esGestion, onCambio }) {
  const [editando, setEditando] = useState(null); // null | 'nuevo' | tipo
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const actualizar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));

  function abrirNuevo() {
    setForm(VACIO);
    setEditando('nuevo');
    setError(null);
  }

  function abrirEdicion(tipo) {
    setForm({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      capacidad: tipo.capacidad,
      precioBase: tipo.precioBase,
    });
    setEditando(tipo);
    setError(null);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const datos = {
      nombre: form.nombre,
      descripcion: form.descripcion.trim() || null,
      capacidad: Number(form.capacidad),
      precioBase: Number(form.precioBase),
    };
    try {
      if (editando === 'nuevo') await habitacionService.crearTipo(datos);
      else await habitacionService.actualizarTipo(editando.id, datos);
      setEditando(null);
      await onCambio();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el tipo de habitación.'));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este tipo de habitación?')) return;
    try {
      await habitacionService.eliminarTipo(id);
      await onCambio();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar el tipo de habitación.'));
    }
  }

  return (
    <section className="mt-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h3 mb-0">Tipos de habitación</h2>
        {esGestion && !editando && (
          <button onClick={abrirNuevo} className={botonSecundario}>
            <i className="bi bi-plus-lg me-1" /> Nuevo tipo
          </button>
        )}
      </div>

      {editando && (
        <form onSubmit={guardar} className="pms-card-arena d-flex flex-column gap-3 mb-4 p-3">
          <div className="row g-3">
            <Campo etiqueta="Nombre" className="col-12 col-sm-4">
              <input required value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} className={inputClase} />
            </Campo>
            <Campo etiqueta="Capacidad" className="col-6 col-sm-4">
              <input
                required
                type="number"
                min="1"
                value={form.capacidad}
                onChange={(e) => actualizar('capacidad', e.target.value)}
                className={inputClase}
              />
            </Campo>
            <Campo etiqueta="Precio base / noche" className="col-6 col-sm-4">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.precioBase}
                onChange={(e) => actualizar('precioBase', e.target.value)}
                className={inputClase}
              />
            </Campo>
          </div>
          <Campo etiqueta="Descripción">
            <input value={form.descripcion} onChange={(e) => actualizar('descripcion', e.target.value)} className={inputClase} />
          </Campo>
          {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
          <div className="d-flex justify-content-end gap-2">
            <button type="button" onClick={() => setEditando(null)} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={botonPrimario}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <ul className="list-group list-group-flush pms-card overflow-hidden">
        {tipos.length === 0 && <li className="list-group-item small text-claro">Aún no hay tipos registrados.</li>}
        {tipos.map((t) => (
          <li key={t.id} className="list-group-item d-flex align-items-center justify-content-between gap-3 border-hueso">
            <div className="min-w-0 text-truncate">
              <p className="mb-0 small fw-medium">
                {t.nombre} <span className="fw-normal text-tierra">· {t.capacidad} pers.</span>
              </p>
              {t.descripcion && <p className="mb-0 text-tierra text-truncate celda-detalle">{t.descripcion}</p>}
            </div>
            <div className="d-flex flex-shrink-0 align-items-center gap-3">
              <span className="small fw-semibold text-vino">{moneda(t.precioBase)}</span>
              {esGestion && (
                <>
                  <button onClick={() => abrirEdicion(t)} className={botonSecundario}>
                    Editar
                  </button>
                  <button onClick={() => eliminar(t.id)} className={botonPeligro}>
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
