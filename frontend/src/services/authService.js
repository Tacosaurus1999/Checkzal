import api from './api';

export const authService = {
  async login({ email, password }) {
    const { data } = await api.post('/auth/login', { email, password });
    return data; // { usuario, token }
  },

  async obtenerPerfil() {
    const { data } = await api.get('/auth/perfil');
    return data;
  },
};
