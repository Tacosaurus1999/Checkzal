import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const SeleccionContext = createContext(null);

/**
 * Estado compartido entre páginas, panel de detalle y barra inferior:
 *  - reservaId:   reserva abierta en el DetailPanel (detalle, pagos, check-in/out)
 *  - habitacion:  habitación resaltada en la BottomBar (cambio rápido de estado)
 *  - version:     contador que se incrementa tras cada cambio; las vistas lo usan
 *                 como dependencia de useEffect para recargar sus datos.
 */
export function SeleccionProvider({ children }) {
  const [reservaId, setReservaId] = useState(null);
  const [habitacion, setHabitacion] = useState(null);
  const [version, setVersion] = useState(0);

  const seleccionarReserva = useCallback((id) => setReservaId(id), []);
  const seleccionarHabitacion = useCallback((h) => setHabitacion(h), []);
  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  const valor = useMemo(
    () => ({ reservaId, habitacion, version, seleccionarReserva, seleccionarHabitacion, refrescar }),
    [reservaId, habitacion, version, seleccionarReserva, seleccionarHabitacion, refrescar]
  );

  return <SeleccionContext.Provider value={valor}>{children}</SeleccionContext.Provider>;
}

export function useSeleccion() {
  const contexto = useContext(SeleccionContext);
  if (!contexto) throw new Error('useSeleccion debe usarse dentro de SeleccionProvider');
  return contexto;
}
