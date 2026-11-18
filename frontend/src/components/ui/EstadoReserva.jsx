import { ESTADOS_RESERVA } from '../../utils/estados';

/** Insignia del estado de una reserva (ENUM estado_reserva). */
export default function EstadoReserva({ estado }) {
  const config = ESTADOS_RESERVA[estado] || { etiqueta: estado, clase: 'estado-no_show' };
  return <span className={`estado-badge ${config.clase}`}>{config.etiqueta}</span>;
}
