import api from './api';

export const dashboardService = {
  /** v_ocupacion_hoy + v_movimientos_hoy -> { ocupacion, llegadas, salidas } */
  async resumen() {
    const { data } = await api.get('/dashboard/resumen');
    return data;
  },

  /** SOLO administrador. granularidad: 'semana' | 'mes' | 'anio'; desde/hasta opcionales (YYYY-MM-DD). */
  async estadisticas({ granularidad = 'mes', desde, hasta } = {}) {
    const params = { granularidad };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    const { data } = await api.get('/dashboard/estadisticas', { params });
    return data;
  },
};
