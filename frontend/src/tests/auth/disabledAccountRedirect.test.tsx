// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppNotificationProvider } from '../../components/AppNotificationProvider';

const authMock = vi.hoisted(() => ({
  accessToken: null as string | null,
  login: vi.fn(async () => undefined),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ accessToken: authMock.accessToken, isBootstrapping: false, login: authMock.login }),
  useOptionalAuth: () => null,
}));

import { App } from '../../app/App';
import {
  ACCOUNT_DISABLED_EVENT,
  ACCOUNT_SESSION_REVOKED_EVENT,
  apiClient,
  authApi,
} from '../../auth/api';
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
  window.localStorage.clear();
  authMock.accessToken = null;
});

function LocationProbe() {
  return <output aria-label="current path">{useLocation().pathname}</output>;
}

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

    render(<AppNotificationProvider><MemoryRouter initialEntries={['/login']}><App /></MemoryRouter></AppNotificationProvider>);
    await expect(authApi.refresh()).rejects.toMatchObject({ response: { data: { code: 'AUTH_ACCOUNT_DISABLED' } } });

    expect(await screen.findByText('Phiên đăng nhập đã bị thu hồi')).toBeTruthy();
    expect((await screen.findAllByText('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.')).length)
      .toBeGreaterThanOrEqual(2);
    expect(window.sessionStorage.getItem('memberManagement:listState:v1')).toBeNull();
    expect(ACCOUNT_DISABLED_EVENT).toBe('auth:account-disabled');
  });

  it('shows a top-right warning and returns a role-changed account to shared login', async () => {
    window.localStorage.clear();
    authMock.accessToken = 'role-changed-access-token';
    setAccessToken('role-changed-access-token');
    render(<AppNotificationProvider>
      <MemoryRouter initialEntries={['/profile']}><App /><LocationProbe /></MemoryRouter>
    </AppNotificationProvider>);

    setAccessToken(null);
    authMock.accessToken = null;
    window.dispatchEvent(new Event('auth:role-changed'));

    expect(await screen.findByText('Nhóm quyền của tài khoản đã thay đổi. Vui lòng đăng nhập lại để tiếp tục.'))
      .toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/login'));
  });

  it('shows a generic notice when a refresh cookie belongs to another account', async () => {
    authMock.accessToken = 'expired-account-a';
    setAccessToken('expired-account-a');
    render(<AppNotificationProvider>
      <MemoryRouter initialEntries={['/profile']}><App /><LocationProbe /></MemoryRouter>
    </AppNotificationProvider>);

    setAccessToken(null);
    authMock.accessToken = null;
    window.dispatchEvent(new Event(ACCOUNT_SESSION_REVOKED_EVENT));

    expect(await screen.findByText('Phiên đăng nhập này không còn hiệu lực. Vui lòng đăng nhập lại.'))
      .toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/login'));
  });
});
