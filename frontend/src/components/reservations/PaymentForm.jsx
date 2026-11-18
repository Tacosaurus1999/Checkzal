import { useState } from 'react';
import { pagoService } from '../../services/pagoService';
import { METODOS_PAGO } from '../../utils/estados';
import { mensajeError } from '../../utils/formato';
import Campo, { botonPrimario, inputClase, selectClase } from '../ui/Campo';

/** Registro de un pago (anticipo, abono o liquidación) sobre una reserva. */
export default function PaymentForm({ reservaId, saldo, onRegistrado }) {
  const [monto, setMonto] = useState(String(saldo > 0 ? saldo : ''));
  const [metodo, setMetodo] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await pagoService.registrar(reservaId, {
        monto: Number(monto),
        metodo,
        referencia: referencia.trim() || null,
      });
      setReferencia('');
      onRegistrado();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo registrar el pago.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={manejarSubmit} className="pms-card-arena p-3 d-grid gap-2" style={{ background: 'var(--hueso-alt)' }}>
      <div className="row g-2">
        <Campo etiqueta="Monto" className="col-6">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={saldo > 0 ? saldo : undefined}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={inputClase}
          />
        </Campo>
        <Campo etiqueta="Método" className="col-6">
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={selectClase}>
            {METODOS_PAGO.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Referencia (opcional)">
        <input
          value={referencia}
          maxLength={80}
          onChange={(e) => setReferencia(e.target.value)}
          className={inputClase}
          placeholder="Folio, últimos 4 dígitos…"
        />
      </Campo>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0">{error}</div>}
      <button type="submit" disabled={guardando} className={`${botonPrimario} w-100`}>
        {guardando ? 'Registrando…' : 'Registrar pago'}
      </button>
    </form>
  );
}
