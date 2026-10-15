// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../app/App';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'signed-in-token' as string | null,
    isBootstrapping: false,
    currentUser: {
      id: 17,
      username: 'reader',
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['account:change-password'],
    } as { id: number; username: string | null; email: string; role: string; permissions: string[] } | null,
    role: 'USER' as string | null,
    permissions: ['account:change-password'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  Object.assign(mocks.auth, {
    accessToken: 'signed-in-token',
    currentUser: {
      id: 17,
      username: 'reader',
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['account:change-password'],
    },
    role: 'USER',
    permissions: ['account:change-password'],
    isBootstrapping: false,
    capabilityStatus: 'ready',
  });
});

describe('authenticated profile routes', () => {
  it.each([
    ['ADMIN', '/admin/roles'], ['ADMIN', '/admin/members'],
    ['LIBRARIAN', '/admin/roles'], ['LIBRARIAN', '/admin/members'],
  ])('still denies direct %s access to %s without permission', async (role, path) => {
    mocks.auth.role = role;
    mocks.auth.currentUser!.role = role;
    mocks.auth.permissions = [];
    mocks.auth.currentUser!.permissions = [];
    renderRoute(path);
    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/403');
  });
  it('shows the profile email and password action for a USER with permission', async () => {
    renderRoute('/profile');

    expect(await screen.findByRole('heading', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Email hiện tại' })).getByText('reader@example.com')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' }).getAttribute('href'))
      .toBe('/profile/change-password');
  });

  it('keeps the profile route available when only another profile permission is present', async () => {
    mocks.auth.permissions = ['account:change-email'];
    mocks.auth.currentUser!.permissions = ['account:change-email'];
    renderRoute('/profile');

    expect(await screen.findByRole('heading', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Email hiện tại' })).getByText('reader@example.com')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' }).getAttribute('href')).toBe('/profile/change-password');
    expect(screen.getByRole('link', { name: 'Đổi email' }).getAttribute('href')).toBe('/profile/change-email');
  });

  it('allows an admin account to reach email self-service without a profile permission', async () => {
    mocks.auth.role = 'ADMIN';
    mocks.auth.currentUser!.role = 'ADMIN';
    mocks.auth.permissions = [];
    mocks.auth.currentUser!.permissions = [];
    renderRoute('/profile/change-email');
    expect(await screen.findByRole('heading', { name: 'Đổi email' })).toBeTruthy();
  });

  it('allows an admin account to reach password self-service without a profile permission', async () => {
    mocks.auth.role = 'ADMIN';
    mocks.auth.currentUser!.role = 'ADMIN';
    mocks.auth.permissions = [];
    mocks.auth.currentUser!.permissions = [];
    renderRoute('/profile/change-password');
    expect(await screen.findByRole('heading', { name: 'Đổi mật khẩu' })).toBeTruthy();
  });

  it.each(['ADMIN', 'LIBRARIAN'])('allows %s to use the profile route with no permissions', async (role) => {
    mocks.auth.currentUser!.role = role;
    mocks.auth.role = role;
    mocks.auth.currentUser!.permissions = [];
    mocks.auth.permissions = [];
    renderRoute('/profile');

    expect(await screen.findByRole('heading', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hồ sơ tài khoản' })).toBeTruthy();
  });

  it('sends anonymous visitors to Login', async () => {
    mocks.auth.accessToken = null;
    mocks.auth.currentUser = null;
    mocks.auth.role = null;
    mocks.auth.permissions = [];
    renderRoute('/profile/change-password');

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/login'));
  });
});
