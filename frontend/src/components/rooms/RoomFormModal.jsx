import { useState } from 'react';
import { mensajeError, moneda } from '../../utils/formato';
import Modal from '../ui/Modal';
import Campo, { botonPrimario, botonSecundario, inputClase, selectClase } from '../ui/Campo';

/** Alta / edición de habitación (numero, piso, tipo, notas, activa). */
export default function RoomFormModal({ habitacionInicial, tipos, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    habitacionInicial
      ? {
          numero: habitacionInicial.numero,
          piso: habitacionInicial.piso,
          tipoHabitacionId: habitacionInicial.tipoHabitacionId,
          notas: habitacionInicial.notas || '',
          activa: habitacionInicial.activa,
        }
      : { numero: '', piso: 1, tipoHabitacionId: tipos[0]?.id ?? '', notas: '', activa: true }
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
        numero: form.numero,
        piso: Number(form.piso),
        tipoHabitacionId: Number(form.tipoHabitacionId),
        notas: form.notas.trim() || null,
        activa: form.activa,
      });
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar la habitación.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={habitacionInicial ? 'Editar habitación' : 'Nueva habitación'} onCerrar={onCerrar}>
      <form onSubmit={manejarSubmit} className="d-flex flex-column gap-3">
        <div className="row g-3">
          <Campo etiqueta="Número" className="col-6">
            <input
              required
              maxLength={10}
              value={form.numero}
              onChange={(e) => actualizar('numero', e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo etiqueta="Piso" className="col-6">
            <input
              required
              type="number"
              value={form.piso}
              onChange={(e) => actualizar('piso', e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        <Campo etiqueta="Tipo de habitación">
          <select
            required
            value={form.tipoHabitacionId}
            onChange={(e) => actualizar('tipoHabitacionId', e.target.value)}
            className={selectClase}
          >
            {tipos.length === 0 && <option value="">Primero crea un tipo de habitación</option>}
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.capacidad} pers. · {moneda(t.precioBase)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Notas">
          <textarea rows={2} value={form.notas} onChange={(e) => actualizar('notas', e.target.value)} className={inputClase} />
        </Campo>

        <div className="form-check">
          <input
            id="habitacion-activa"
            type="checkbox"
            checked={form.activa}
            onChange={(e) => actualizar('activa', e.target.checked)}
            className="form-check-input"
          />
          <label htmlFor="habitacion-activa" className="form-check-label small">
            Habitación activa (aparece en el panel y en la disponibilidad)
          </label>
        </div>

        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}

        <div className="d-flex justify-content-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando || tipos.length === 0} className={botonPrimario}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
