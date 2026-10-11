// @vitest-environment jsdom
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import { AuthProvider } from '../../auth/AuthContext';
import type { ApiEnvelope } from '../../auth/types';
import { setAccessToken } from '../../auth/tokenStore';
import { MemoryRouter, useLocation } from 'react-router-dom';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Forbidden',
    headers: new AxiosHeaders(),
    config,
  };
}

function success<T>(code: string, data: T | null): ApiEnvelope<T> {
  return {
    success: true,
    status: 200,
    code,
    message: 'Success.',
    data,
    timestamp: new Date().toISOString(),
  };
}

function forbidden(config: InternalAxiosRequestConfig): never {
  const body: ApiEnvelope<null> = {
    success: false,
    status: 403,
    code: 'PERMISSION_DENIED',
    message: 'Forbidden.',
    data: null,
    timestamp: new Date().toISOString(),
  };
  throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, 403));
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function DeniedRequestProbe() {
  return <button onClick={() => { void apiClient.get('/api/v1/probe').catch(() => undefined); }}>
    Gọi endpoint bị từ chối
  </button>;
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
});

describe('permission revocation synchronization', () => {
  it('leaves the active page for /403 when a fresh /auth/me removes role:read', async () => {
    const user = userEvent.setup();
    let revocationRequested = false;
    let deniedRequests = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        return response(config, success('AUTH_TOKEN_REFRESHED', {
          accessToken: 'admin-smoke-token', tokenType: 'Bearer', accessTokenExpiresIn: 900,
        }));
      }
      if (config.url === '/api/v1/auth/me') {
        const permissions = revocationRequested ? ['book:read'] : ['role:read', 'role:update'];
        return response(config, success('AUTH_ME_SUCCESS', {
          id: 5,
          username: 'admin',
          email: 'admin@example.com',
          role: 'ROLE_ADMIN',
          permissions,
        }));
      }
      if (config.url === '/api/v1/roles') {
        return response(config, success('ROLE_LIST_SUCCESS', [
          { code: 'ROLE_ADMIN', description: 'Quản trị viên', version: 0, canEdit: false },
          { code: 'ROLE_USER', description: 'Người dùng', version: 0, canEdit: true },
        ]));
      }
      if (config.url === '/api/v1/permissions') {
        return response(config, success('PERMISSION_LIST_SUCCESS', [
          { code: 'book:read', description: 'Xem sách', manageableByActor: true },
        ]));
      }
      if (config.url === '/api/v1/roles/ROLE_USER/permissions') {
        return response(config, success('ROLE_PERMISSIONS_SUCCESS', {
          roleCode: 'ROLE_USER',
          version: 0,
          assignedPermissions: [],
          effectivePermissions: [],
          editablePermissions: ['book:read'],
          editable: true,
        }));
      }
      if (config.url === '/api/v1/probe') {
        deniedRequests += 1;
        revocationRequested = true;
        forbidden(config);
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(
      <MemoryRouter initialEntries={['/admin/roles']}>
        <AuthProvider><App /><DeniedRequestProbe /><LocationProbe /></AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Quản lý vai trò' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Gọi endpoint bị từ chối' }));

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(deniedRequests).toBe(1);
  });
});
