// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { AuthProvider } from '../../auth/AuthContext';
import { apiClient } from '../../auth/api';
import { setAccessToken } from '../../auth/tokenStore';

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
  sessionStorage.clear();
  localStorage.clear();
});

function mount(path: string, signedIn: boolean, state?: { registrationCooldownUntil: number }) {
  apiClient.defaults.adapter = (async (config) => {
    const response = (code: string, data: unknown, status = 200) => ({
      config, status, statusText: 'OK', headers: new AxiosHeaders(),
      data: { success: status === 200, status, code, data, message: '', timestamp: new Date().toISOString() },
    });
    if (config.url === '/api/v1/auth/refresh') {
      if (!signedIn) throw new AxiosError('missing', undefined, config, undefined,
        response('AUTH_REFRESH_TOKEN_MISSING', null, 401));
      return response('AUTH_TOKEN_REFRESHED', { accessToken: 'admin-token', tokenType: 'Bearer', accessTokenExpiresIn: 900 });
    }
    if (config.url === '/api/v1/auth/me') return response('AUTH_ME_SUCCESS', {
      id: 1, username: 'admin', email: 'admin@example.com', role: 'ADMIN', permissions: [],
    });
    if (config.url === '/api/v1/auth/verify-email') return response('EMAIL_VERIFIED', null);
    throw new Error(`Unexpected request ${config.url}`);
  }) satisfies AxiosAdapter;
  function Probe() {
    return <output aria-label="current path">{useLocation().pathname}</output>;
  }
  render(<MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}><AuthProvider><App /><Probe /></AuthProvider></MemoryRouter>);
}

describe('special authentication routes', () => {
  it.each(['/login', '/register', '/forgot-password', '/check-email', '/reset-password', '/verify-email'])('redirects a signed-in direct visit to %s home', async (path) => {
    mount(path, true);
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/'));
    expect(await screen.findByRole('region', { name: 'Tài khoản đang đăng nhập' })).toBeTruthy();
  });

  it.each(['/check-email', '/reset-password', '/verify-email'])('redirects a guest direct visit to %s to login', async (path) => {
    mount(path, false);
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('keeps a registration continuation available to a guest', async () => {
    sessionStorage.setItem('registrationEmail', 'reader@example.com');
    mount('/check-email', false);
    expect(await screen.findByText('reader@example.com')).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/check-email');
  });

  it('accepts registration navigation context even without saved email', async () => {
    mount('/check-email', false, { registrationCooldownUntil: Date.now() + 60_000 });
    expect(await screen.findByRole('heading', { name: 'Kiểm tra email' })).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/check-email');
  });

  it('redirects a signed-in user despite saved registration context', async () => {
    sessionStorage.setItem('registrationEmail', 'reader@example.com');
    mount('/check-email', true);
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/'));
  });

  it.each([false, true])('keeps an email verification result after cleaning its URL with signedIn=%s', async (signedIn) => {
    mount('/verify-email?token=email-link', signedIn);
    expect(await screen.findByRole('heading', { name: 'Email đã được xác thực' })).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/verify-email');
  });

  it.each([false, true])('opens a password reset email link with signedIn=%s', async (signedIn) => {
    mount('/reset-password?token=password-link', signedIn);
    expect(await screen.findByLabelText('Mật khẩu mới')).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/reset-password');
  });
});
