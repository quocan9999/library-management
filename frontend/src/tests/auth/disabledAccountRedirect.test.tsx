// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const authMock = vi.hoisted(() => ({
  accessToken: null as string | null,
  login: vi.fn(async () => undefined),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ accessToken: authMock.accessToken, isBootstrapping: false, login: authMock.login }),
  useOptionalAuth: () => null,
}));

import { App } from '../../app/App';
import { ACCOUNT_DISABLED_EVENT, apiClient, authApi } from '../../auth/api';
import { setAccessToken } from '../../auth/tokenStore';
import type { ApiEnvelope } from '../../auth/types';

const originalAdapter = apiClient.defaults.adapter;

function response<T>(config: Parameters<AxiosAdapter>[0], data: T, status: number): AxiosResponse<T> {
  return { data, status, statusText: 'Forbidden', headers: new AxiosHeaders(), config };
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
  window.sessionStorage.clear();
  authMock.accessToken = null;
});

describe('disabled account session redirect', () => {
  it('routes to login with a Vietnamese notice when refresh reports a disabled account', async () => {
    window.sessionStorage.setItem('memberManagement:listState:v1', 'cached filters');
    apiClient.defaults.adapter = (async (config) => {
      const body: ApiEnvelope<null> = {
        success: false,
        status: 403,
        code: 'AUTH_ACCOUNT_DISABLED',
        message: 'Account disabled.',
        data: null,
        timestamp: new Date().toISOString(),
      };
      throw new AxiosError('Forbidden', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, 403));
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
    await expect(authApi.refresh()).rejects.toMatchObject({ response: { data: { code: 'AUTH_ACCOUNT_DISABLED' } } });

    expect(await screen.findByText('Phiên đăng nhập đã bị thu hồi')).toBeTruthy();
    expect(window.sessionStorage.getItem('memberManagement:listState:v1')).toBeNull();
    expect(ACCOUNT_DISABLED_EVENT).toBe('auth:account-disabled');
  });
});
