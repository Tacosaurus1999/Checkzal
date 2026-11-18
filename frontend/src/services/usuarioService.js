import api from './api';

export const usuarioService = {
  async listar() {
    const { data } = await api.get('/usuarios');
    return data;
  },

  async crear(datos) {
    const { data } = await api.post('/usuarios', datos);
    return data;
  },

  async actualizar(id, datos) {
    const { data } = await api.put(`/usuarios/${id}`, datos);
    return data;
  },

  async eliminar(id) {
    const { data } = await api.delete(`/usuarios/${id}`);
    return data;
  },
};
