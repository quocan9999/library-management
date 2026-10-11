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
      role: 'ROLE_USER',
      permissions: ['role:read'],
    },
    role: 'ROLE_USER',
    permissions: ['role:read'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
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
});
