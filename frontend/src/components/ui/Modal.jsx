import { useEffect } from 'react';

const TAMANOS = { 'max-w-sm': '', 'max-w-md': '', 'max-w-lg': 'modal-lg', 'max-w-xl': 'modal-lg', 'max-w-2xl': 'modal-xl', 'max-w-3xl': 'modal-xl', 'max-w-4xl': 'modal-xl' };

/**
 * Modal de Bootstrap controlado por React (sin el JS de Bootstrap).
 * `ancho` acepta los valores antiguos (max-w-md, max-w-2xl…) o directamente '', 'modal-lg', 'modal-xl'.
 */
export default function Modal({ titulo, ancho = '', onCerrar, children }) {
  useEffect(() => {
    function alPresionar(e) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alPresionar);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', alPresionar);
      document.body.classList.remove('modal-open');
    };
  }, [onCerrar]);

  const tamano = ancho in TAMANOS ? TAMANOS[ancho] : ancho;

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal pms-modal" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${tamano}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{titulo}</h3>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
