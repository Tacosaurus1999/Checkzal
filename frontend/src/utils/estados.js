/**
 * Mapeo visual de los ENUM del esquema SQL.
 *  - estado_habitacion: disponible | ocupada | limpieza | mantenimiento
 *  - estado_reserva:    pendiente | confirmada | checkin | checkout | cancelada | no_show
 *  - metodo_pago / origen_reserva
 */

export const ESTADOS_HABITACION = {
  disponible: { etiqueta: 'Disponible', tarjeta: 'hab-disponible', punto: 'punto-disponible', puntoResumen: 'punto-disponible' },
  ocupada: { etiqueta: 'Ocupada', tarjeta: 'hab-ocupada', punto: 'punto-ocupada', puntoResumen: 'punto-ocupada' },
  limpieza: { etiqueta: 'Limpieza', tarjeta: 'hab-limpieza', punto: 'punto-limpieza', puntoResumen: 'punto-limpieza' },
  mantenimiento: { etiqueta: 'Mantenimiento', tarjeta: 'hab-mantenimiento', punto: 'punto-mantenimiento', puntoResumen: 'punto-mantenimiento' },
};

// Las clases `estado-*`, `hab-*` y `punto-*` están definidas en src/tema.css.
export const ESTADOS_RESERVA = {
  pendiente: { etiqueta: 'Pendiente', clase: 'estado-pendiente' },
  confirmada: { etiqueta: 'Confirmada', clase: 'estado-confirmada' },
  checkin: { etiqueta: 'En casa', clase: 'estado-checkin' },
  checkout: { etiqueta: 'Check-out', clase: 'estado-checkout' },
  cancelada: { etiqueta: 'Cancelada', clase: 'estado-cancelada' },
  no_show: { etiqueta: 'No-show', clase: 'estado-no_show' },
};

export const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'deposito', etiqueta: 'Depósito' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const ORIGENES_RESERVA = [
  { valor: 'directa', etiqueta: 'Directa' },
  { valor: 'telefono', etiqueta: 'Teléfono' },
  { valor: 'telegram', etiqueta: 'Telegram' },
  { valor: 'web', etiqueta: 'Web' },
  { valor: 'booking', etiqueta: 'Booking' },
  { valor: 'airbnb', etiqueta: 'Airbnb' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const ROLES = [
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'gerente', etiqueta: 'Gerente' },
  { valor: 'recepcionista', etiqueta: 'Recepcionista' },
];

export const TIPOS_DOCUMENTO = ['INE', 'Pasaporte', 'Licencia', 'Otro'];

export const etiquetaRol = (rol) => ROLES.find((r) => r.valor === rol)?.etiqueta || rol;
