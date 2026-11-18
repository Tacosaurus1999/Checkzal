import api from './api';

export const pagoService = {
  async listar(reservaId) {
    const { data } = await api.get(`/reservas/${reservaId}/pagos`);
    return data; // { pagos: [...], saldo: { totalAPagar, totalPagado, saldo } }
  },

  async registrar(reservaId, { monto, metodo, referencia }) {
    const { data } = await api.post(`/reservas/${reservaId}/pagos`, { monto, metodo, referencia });
    return data;
  },
};
