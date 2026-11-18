import api from './api';

export const habitacionService = {
  async listar() {
    const { data } = await api.get('/habitaciones');
    return data;
  },

  async crear(datos) {
    const { data } = await api.post('/habitaciones', datos);
    return data;
  },

  async actualizar(id, datos) {
    const { data } = await api.put(`/habitaciones/${id}`, datos);
    return data;
  },

  /** limpieza ↔ disponible ↔ mantenimiento ("ocupada" la gestionan el check-in/check-out) */
  async cambiarEstado(id, estado) {
    const { data } = await api.patch(`/habitaciones/${id}/estado`, { estado });
    return data;
  },

  async eliminar(id) {
    const { data } = await api.delete(`/habitaciones/${id}`);
    return data;
  },

  /** Consume la función SQL habitaciones_disponibles */
  async disponibilidad(entrada, salida) {
    const { data } = await api.get('/disponibilidad', { params: { entrada, salida } });
    return data; // { entrada, salida, noches, disponibles: [...] }
  },

  // ----- Tipos de habitación -----
  async listarTipos() {
    const { data } = await api.get('/tipos-habitacion');
    return data;
  },

  async crearTipo(datos) {
    const { data } = await api.post('/tipos-habitacion', datos);
    return data;
  },

  async actualizarTipo(id, datos) {
    const { data } = await api.put(`/tipos-habitacion/${id}`, datos);
    return data;
  },

  async eliminarTipo(id) {
    const { data } = await api.delete(`/tipos-habitacion/${id}`);
    return data;
  },
};
