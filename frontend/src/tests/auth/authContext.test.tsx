// @vitest-environment jsdom
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { setAccessToken } from '../../auth/tokenStore';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
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

function currentUser(id: number, role: string, permissions: string[]) {
  return {
    id,
    username: null,
    email: `user${id}@example.com`,
    role,
    permissions,
  };
}

function CapabilityProbe() {
  const { capabilityStatus, currentUser: account, login, logout } = useAuth();
  return (
    <>
      <output aria-label="capabilities">
        {capabilityStatus}|{account?.id ?? 'none'}|{account?.permissions.join(',') ?? ''}
      </output>
      <button onClick={() => void login({ identifier: 'second@example.com', password: 'Strong1!' })}>
        Đổi tài khoản
      </button>
      <button onClick={() => void logout()}>Đăng xuất</button>
    </>
  );
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
});

describe('AuthProvider capability session', () => {
  it('ignores a late /auth/me response from the previous token and clears rights on logout', async () => {
    let resolvePreviousMe: ((result: AxiosResponse<ApiEnvelope<ReturnType<typeof currentUser>>>) => void) | undefined;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/auth/refresh') {
        return response(config, success('AUTH_TOKEN_REFRESHED', {
          accessToken: 'first-account-token', tokenType: 'Bearer', accessTokenExpiresIn: 900,
        }));
      }
      if (config.url === '/api/v1/auth/me' && config.headers.get('Authorization') === 'Bearer first-account-token') {
        return await new Promise((resolve) => { resolvePreviousMe = resolve; });
      }
      if (config.url === '/api/v1/auth/login') {
        return response(config, success('AUTH_LOGIN_SUCCESS', {
          accessToken: 'second-account-token', tokenType: 'Bearer', accessTokenExpiresIn: 900,
        }));
      }
      if (config.url === '/api/v1/auth/me' && config.headers.get('Authorization') === 'Bearer second-account-token') {
        return response(config, success('AUTH_ME_SUCCESS', currentUser(2, 'ROLE_ADMIN', ['role:read'])));
      }
      if (config.url === '/api/v1/auth/logout') {
        return response(config, success('AUTH_LOGOUT_SUCCESS', null));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<AuthProvider><CapabilityProbe /></AuthProvider>);
    await waitFor(() => expect(resolvePreviousMe).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tài khoản' }));
    await waitFor(() => expect(screen.getByLabelText('capabilities').textContent)
      .toContain('ready|2|role:read'));

    resolvePreviousMe?.(response(
      {} as Parameters<AxiosAdapter>[0],
      success('AUTH_ME_SUCCESS', currentUser(1, 'ROLE_USER', ['book:read'])),
    ));
    await waitFor(() => expect(screen.getByLabelText('capabilities').textContent)
      .toContain('ready|2|role:read'));
    expect(screen.getByLabelText('capabilities').textContent).not.toContain('book:read');

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.getByLabelText('capabilities').textContent).toBe('ready|none|'));
  });
});
