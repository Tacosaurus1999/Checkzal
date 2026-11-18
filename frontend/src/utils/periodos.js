/** Etiqueta legible de un periodo según la granularidad ('2026-11-02' + 'semana' -> 'Sem. 2 nov'). */
export function etiquetaPeriodo(iso, granularidad) {
  const fecha = new Date(`${iso}T00:00:00Z`);
  if (granularidad === 'anio') return iso.slice(0, 4);
  if (granularidad === 'mes') {
    return fecha.toLocaleDateString('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
  }
  return `Sem. ${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '')}`;
}

export const GRANULARIDADES = [
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'anio', etiqueta: 'Año' },
];
