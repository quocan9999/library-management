// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'opaque-session-token',
    isBootstrapping: false,
    currentUser: {
      id: 4,
      username: null,
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['role:read'],
    },
    role: 'USER',
    permissions: ['role:read'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

vi.mock('../../role/RoleManagementPage', () => ({
  RoleManagementPage: () => <h1>Group management page</h1>,
}));
vi.mock('../../role/AuthorizationPages', () => ({
  AuthorizationLandingPage: () => <h1>Authorization overview page</h1>,
  AssignmentPlaceholderPage: () => <h1>Assignment placeholder page</h1>,
}));

const originalAdapter = apiClient.defaults.adapter;

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  mocks.auth.refreshCapabilities.mockClear();
  Object.assign(mocks.auth, {
    accessToken: 'opaque-session-token',
    role: 'USER',
    currentUser: {
      id: 4,
      username: null,
      email: 'reader@example.com',
      role: 'USER',
      permissions: ['role:read'],
    },
    permissions: ['role:read'],
  });
});

describe('permission-protected routes', () => {
  it('blocks a USER even when stale session data claims role:read', async () => {
    let roleApiCalls = 0;
    apiClient.defaults.adapter = (async (config) => {
      roleApiCalls += 1;
      throw new Error(`Role API must not run for USER: ${config.url}`);
    });

    render(<MemoryRouter initialEntries={['/admin/roles']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(roleApiCalls).toBe(0);
  });

  it('blocks a custom role from the authorization landing even when it has role:read', async () => {
    Object.assign(mocks.auth, {
      role: 'LIBRARIAN',
      currentUser: { ...mocks.auth.currentUser, role: 'LIBRARIAN' },
    });
    render(<MemoryRouter initialEntries={['/admin/authorization']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(screen.queryByRole('link', { name: 'Quản lý phân quyền' })).toBeNull();
  });

  it('blocks the assignment placeholder for a USER even when stale data grants RBAC permissions', async () => {
    Object.assign(mocks.auth, {
      role: 'USER',
      currentUser: { ...mocks.auth.currentUser, role: 'USER', permissions: ['role:read', 'role:update'] },
      permissions: ['role:read', 'role:update'],
    });
    render(<MemoryRouter initialEntries={['/admin/authorization/assignments']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(screen.queryByRole('heading', { name: 'Assignment placeholder page' })).toBeNull();
  });

  it('shows the authorization navigation to ADMIN by role and sends the legacy route to groups', async () => {
    Object.assign(mocks.auth, {
      role: 'ADMIN',
      currentUser: { ...mocks.auth.currentUser, role: 'ADMIN' },
      permissions: ['role:read'],
    });
    mocks.auth.currentUser.permissions = ['role:read'];
    render(<MemoryRouter initialEntries={['/admin/roles']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Group management page' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/admin/authorization/groups'));
    expect(screen.getByRole('link', { name: 'Quản lý phân quyền' })).toBeTruthy();
  });

  it('keeps the admin navigation role-based when role:read is absent', async () => {
    Object.assign(mocks.auth, {
      role: 'ADMIN',
      currentUser: { ...mocks.auth.currentUser, role: 'ADMIN', permissions: [] },
      permissions: [],
    });
    render(<MemoryRouter initialEntries={['/admin/authorization']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Authorization overview page' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quản lý phân quyền' })).toBeTruthy();
  });
});
