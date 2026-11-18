import api from './api';

export const huespedService = {
  async listar(q = '') {
    const { data } = await api.get('/huespedes', { params: q ? { q } : {} });
    return data;
  },

  async crear(datos) {
    const { data } = await api.post('/huespedes', datos);
    return data;
  },

  async actualizar(id, datos) {
    const { data } = await api.put(`/huespedes/${id}`, datos);
    return data;
  },

  async eliminar(id) {
    const { data } = await api.delete(`/huespedes/${id}`);
    return data;
  },
};
