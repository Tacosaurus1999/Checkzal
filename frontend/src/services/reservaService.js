import api from './api';

export const reservaService = {
  /** @param {{ estado?: string, desde?: string, hasta?: string, q?: string }} filtros */
  async listar(filtros = {}) {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor));
    const { data } = await api.get('/reservas', { params });
    return data;
  },

  async obtener(id) {
    const { data } = await api.get(`/reservas/${id}`);
    return data;
  },

  /** POST transaccional: responde 409 (SOBREVENTA) si el cuarto ya fue tomado. */
  async crear(datos) {
    const { data } = await api.post('/reservas', datos);
    return data;
  },

  /** confirmada | cancelada | no_show */
  async cambiarEstado(id, estado) {
    const { data } = await api.patch(`/reservas/${id}/estado`, { estado });
    return data;
  },

  async checkin(id) {
    const { data } = await api.post(`/reservas/${id}/checkin`);
    return data;
  },

  /** `forzar` solo es aceptado para admin/gerente cuando hay saldo pendiente. */
  async checkout(id, forzar = false) {
    const { data } = await api.post(`/reservas/${id}/checkout`, { forzar });
    return data;
  },

  /** Uso administrativo: solo reservas pendientes/canceladas/no-show sin pagos. */
  async eliminar(id) {
    const { data } = await api.delete(`/reservas/${id}`);
    return data;
  },

  /** Busca por código de 8 caracteres o por el texto completo leído del QR. */
  async porCodigo(texto) {
    const { data } = await api.get('/reservas/por-codigo', { params: { c: texto } });
    return data;
  },

  /** Imagen PNG del QR (Blob; la API exige token, por eso no se usa como <img src> directo). */
  async qr(id) {
    const { data } = await api.get(`/reservas/${id}/qr`, { responseType: 'blob' });
    return data;
  },

  /** Envía al correo del huésped el resumen de la reserva con su QR. */
  async enviarCorreo(id) {
    const { data } = await api.post(`/reservas/${id}/enviar-correo`);
    return data;
  },
};
