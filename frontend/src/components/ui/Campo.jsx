/**
 * Clases Bootstrap compartidas por todos los formularios y acciones.
 * Se exportan como cadenas para usarlas en className (mismos nombres que antes del rediseño).
 */
export const inputClase = 'form-control';
export const selectClase = 'form-select';

export const botonPrimario = 'btn btn-primary btn-sm rounded-pill px-3';
export const botonSecundario = 'btn btn-outline-secondary btn-sm rounded-pill px-3';
export const botonPeligro = 'btn btn-outline-danger btn-sm rounded-pill px-3';

/** Etiqueta + control (use `className` para columnas, p. ej. "col-md-6"). */
export default function Campo({ etiqueta, children, className = '' }) {
  return (
    <label className={`d-block ${className}`}>
      <span className="pms-label d-block">{etiqueta}</span>
      {children}
    </label>
  );
}
