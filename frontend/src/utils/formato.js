export const moneda = (valor) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(valor || 0));

/** Fecha local de hoy en formato YYYY-MM-DD (sin desfase de zona horaria). */
export function hoyISO() {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function sumarDias(iso, dias) {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function nochesEntre(entrada, salida) {
  if (!entrada || !salida) return 0;
  return Math.round((Date.parse(`${salida}T00:00:00Z`) - Date.parse(`${entrada}T00:00:00Z`)) / 86400000);
}

/** '2026-12-20' -> '20 dic 2026' */
export function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function fechaHora(marcaTiempo) {
  if (!marcaTiempo) return '—';
  return new Date(marcaTiempo).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fechaLarga(date = new Date()) {
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const mensajeError = (err, porDefecto) => err?.response?.data?.error || porDefecto;
