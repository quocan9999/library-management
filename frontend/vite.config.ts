import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const port = Number(env.VITE_DEV_PORT || '5173');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_DEV_PORT phải là cổng hợp lệ từ 1 đến 65535.');
  }

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port,
      strictPort: true,
    },
  };
});
