import { useEffect, useState } from 'react';
import { reservaService } from '../../services/reservaService';
import { mensajeError } from '../../utils/formato';
import { botonSecundario } from '../ui/Campo';

/** QR de la reserva: vista, descarga/impresión y envío manual por correo al huésped. */
export default function QrReserva({ reserva }) {
  const [url, setUrl] = useState(null);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let objeto = null;
    setUrl(null);
    setAviso(null);
    reservaService
      .qr(reserva.id)
      .then((blob) => {
        if (cancelado) return;
        objeto = URL.createObjectURL(blob);
        setUrl(objeto);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [reserva.id]);

  async function enviar() {
    setEnviando(true);
    setAviso(null);
    try {
      const r = await reservaService.enviarCorreo(reserva.id);
      setAviso({ tipo: 'ok', texto: `Correo enviado a ${r.para}.` });
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeError(err, 'No se pudo enviar el correo.') });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <p className="pms-kicker mb-2">Código QR</p>
      <div className="pms-card p-3 text-center" style={{ boxShadow: 'none' }}>
        {url ? (
          <img src={url} alt={`QR de la reserva ${reserva.codigo}`} className="d-block mx-auto" style={{ width: 160, height: 160 }} />
        ) : (
          <p className="small text-claro py-5 mb-0">Generando QR…</p>
        )}
        <div className="fw-semibold text-vino mt-1" style={{ letterSpacing: '0.25em' }}>{reserva.codigo}</div>
        <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
          {url && (
            <a href={url} download={`reserva-${reserva.codigo}.png`} className={botonSecundario}>
              <i className="bi bi-download me-1" />
              Descargar
            </a>
          )}
          <button
            onClick={enviar}
            disabled={enviando || !reserva.huespedEmail}
            title={reserva.huespedEmail ? `Enviar a ${reserva.huespedEmail}` : 'El huésped no tiene correo registrado'}
            className={botonSecundario}
          >
            <i className="bi bi-envelope me-1" />
            {enviando ? 'Enviando…' : 'Enviar por correo'}
          </button>
        </div>
        {!reserva.huespedEmail && <p className="small text-claro mt-2 mb-0">El huésped no tiene correo registrado.</p>}
        {aviso && (
          <div className={`alert ${aviso.tipo === 'ok' ? 'alert-success' : 'alert-danger'} small py-1 px-2 mt-2 mb-0`}>
            {aviso.texto}
          </div>
        )}
      </div>
    </div>
  );
}
