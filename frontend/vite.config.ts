import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// Đọc cùng một .env root với Spring Boot, bất kể terminal đang ở thư mục nào.
const rootEnvDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parsePort(rawPort: string, name: string): number {
  const port = Number(rawPort);
  if (!/^\\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} phải là cổng hợp lệ từ 1 đến 65535.`);
  }
  return port;
}

export function resolveSharedFrontendConfig(env: Record<string, string>) {
  const backendPort = parsePort(env.SERVER_PORT || '8081', 'SERVER_PORT');
  const frontendBaseUrl = env.FRONTEND_BASE_URL || 'http://localhost:5173';

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(frontendBaseUrl);
  } catch {
    throw new Error('FRONTEND_BASE_URL phải là URL hợp lệ.');
  }
  if (!['http:', 'https:'].includes(frontendUrl.protocol)
      || !frontendUrl.hostname || !frontendUrl.port
      || frontendUrl.username || frontendUrl.password
      || frontendUrl.pathname !== '/' || frontendUrl.search || frontendUrl.hash) {
    throw new Error('FRONTEND_BASE_URL phải có dạng http://hostname:port (không chứa path hoặc query).');
  }
  const frontendPort = parsePort(frontendUrl.port, 'FRONTEND_BASE_URL');

  return {
    host: frontendUrl.hostname,
    port: frontendPort,
    apiBaseUrl: `http://localhost:${backendPort}`,
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv với prefix rỗng chỉ chạy ở Node.js để đọc các biến root.
  // Không đưa MYSQL_PASSWORD, JWT_SECRET hay MAIL_APP_PASSWORD vào trình duyệt.
  const env = loadEnv(mode, rootEnvDir, '');
  const { host, port, apiBaseUrl } = resolveSharedFrontendConfig(env);

  return {
    plugins: [react()],
    envDir: rootEnvDir,
    envPrefix: 'VITE_',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: {
      host,
      port,
      strictPort: true,
    },
  };
});
