// @vitest-environment jsdom
import { AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'opaque-book-session',
    isBootstrapping: false,
    currentUser: { id: 7, username: 'admin', email: 'admin@example.test', role: 'ADMIN', permissions: ['book:read'] },
    role: 'ADMIN',
    permissions: ['book:read'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

const originalAdapter = apiClient.defaults.adapter;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (media: string) => ({ matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
  });
});

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function success<T>(data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code: 'BOOK_LIST_SUCCESS', message: 'Success.', data, timestamp: new Date().toISOString() };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  Object.assign(mocks.auth, {
    currentUser: { id: 7, username: 'admin', email: 'admin@example.test', role: 'ADMIN', permissions: ['book:read'] },
    role: 'ADMIN',
    permissions: ['book:read'],
    capabilityStatus: 'ready',
  });
});

describe('Book admin routes', () => {
  it('denies USER on book administration routes even when book:read is present', async () => {
    Object.assign(mocks.auth, {
      currentUser: { ...mocks.auth.currentUser, role: 'USER', permissions: ['book:read'] },
      role: 'USER',
      permissions: ['book:read'],
    });
    let bookRequests = 0;
    apiClient.defaults.adapter = (async (config) => {
      bookRequests += 1;
      throw new Error(`Book API should not be called: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/books']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(screen.queryByRole('link', { name: 'Quản lý sách' })).toBeNull();
    expect(bookRequests).toBe(0);
  });

  it('shows the book list and only the actions allowed by effective permissions', async () => {
    const requests: string[] = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.url ?? '');
      return response(config, success({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true }));
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/books']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Quản lý sách' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quản lý sách' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm sách' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nhập CSV' })).toBeNull();
    await waitFor(() => expect(requests).toContain('/api/v1/books'));
  });
});
