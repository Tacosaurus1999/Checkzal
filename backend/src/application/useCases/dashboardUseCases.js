'use strict';

/**
 * Caso de uso: GetDashboard (Read)
 * Combina la ocupación de hoy (v_ocupacion_hoy) y las llegadas/salidas
 * del día (v_movimientos_hoy) en una sola respuesta para el panel.
 */
class GetDashboard {
  constructor(dashboardRepository) {
    this.dashboardRepository = dashboardRepository;
  }

  async ejecutar(hotelId) {
    const [ocupacion, movimientos] = await Promise.all([
      this.dashboardRepository.ocupacionHoy(hotelId),
      this.dashboardRepository.movimientosHoy(hotelId),
    ]);
    return {
      ocupacion,
      llegadas: movimientos.filter((m) => m.movimiento === 'llegada'),
      salidas: movimientos.filter((m) => m.movimiento === 'salida'),
    };
  }
}

module.exports = { GetDashboard };
