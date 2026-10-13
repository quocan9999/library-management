// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { App } from '../../app/App';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { apiClient } from '../../auth/api';
import { setAccessToken } from '../../auth/tokenStore';

vi.mock('../../features/members/MemberListPage', () => ({ MemberListPage: () => <h1>Members page</h1> }));
vi.mock('../../role/RoleManagementPage', () => ({ RoleManagementPage: () => <h1>Roles page</h1> }));
const originalAdapter = apiClient.defaults.adapter;
afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
  localStorage.clear();
});
function Probe() {
  const { refreshCapabilities } = useAuth();
  return <><output data-testid="path">{useLocation().pathname}</output>
    <button onClick={() => { void refreshCapabilities({ force: true }); }}>Reload permissions</button></>;
}

describe('default route for administrators without permissions', () => {
  it.each([
    ['ROLE_ADMIN', 'member:read', 'Members page'],
    ['ROLE_SUPER_ADMIN', 'member:read', 'Members page'],
    ['ROLE_ADMIN', 'role:read', 'Roles page'],
    ['ROLE_SUPER_ADMIN', 'role:read', 'Roles page'],
  ])('keeps empty content after %s login and opens the existing page when %s is restored', async (role, restoredPermission, heading) => {
    const user = userEvent.setup();
    let permissions: string[] = [];
    let logoutCalls = 0;
    apiClient.defaults.adapter = (async (config) => {
      const response = (code: string, data: unknown, status = 200) => ({
        config, status, statusText: 'OK', headers: new AxiosHeaders(),
        data: { success: status === 200, status, code, data, message: '', timestamp: new Date().toISOString() },
      });
      if (config.url === '/api/v1/auth/refresh') {
        throw new AxiosError('missing', undefined, config, undefined, response('AUTH_REFRESH_TOKEN_MISSING', null, 401));
      }
      if (config.url === '/api/v1/auth/login') return response('AUTH_LOGIN_SUCCESS', {
        accessToken: 'admin-token', tokenType: 'Bearer', accessTokenExpiresIn: 900,
      });
      if (config.url === '/api/v1/auth/me') return response('AUTH_ME_SUCCESS', {
        id: 1, username: 'admin', email: 'admin@example.com', role, permissions,
      });
      if (config.url === '/api/v1/auth/logout') { logoutCalls++; return response('AUTH_LOGOUT_SUCCESS', null); }
      throw new Error(`Unexpected request ${config.url}`);
    }) satisfies AxiosAdapter;
    const view = render(<MemoryRouter initialEntries={['/login']}><AuthProvider><App /><Probe /></AuthProvider></MemoryRouter>);
    await user.type(await screen.findByLabelText('Tên đăng nhập hoặc email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Mật khẩu'), 'Current1!');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    const nav = screen.getByRole('navigation', { name: 'Chính' });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    expect(view.container.querySelector('.admin-shell__content')?.textContent).toBe('');
    expect(screen.getByRole('region', { name: 'Tài khoản đang đăng nhập' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
    permissions = [restoredPermission];
    await user.click(screen.getByRole('button', { name: 'Reload permissions' }));
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
    expect(logoutCalls).toBe(1);
  });
});
