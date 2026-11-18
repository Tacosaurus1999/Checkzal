import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HTTPS=true (npm run dev:https): certificado local autofirmado. Es lo que permite usar la CÁMARA
// desde un celular o desde otra PC de la red (los navegadores solo abren la cámara en HTTPS o localhost).
export default defineConfig(async () => {
  const usarHttps = process.env.HTTPS === 'true';
  const plugins = [react()];
  if (usarHttps) plugins.push((await import('@vitejs/plugin-basic-ssl')).default());

  return {
    plugins,
    server: {
      port: 5173,
      host: true, // permite abrir el PMS desde el celular en la misma red (necesario para el QR)
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
