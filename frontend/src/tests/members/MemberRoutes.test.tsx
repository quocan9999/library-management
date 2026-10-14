// @vitest-environment jsdom
import {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
} from 'axios';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'opaque-member-session',
    isBootstrapping: false,
    currentUser: {
      id: 7,
      username: 'reader',
      email: 'reader@example.test',
      role: 'USER',
      permissions: ['member:read'],
    },
    role: 'USER',
    permissions: ['member:read'],
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
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

function response<T>(config: Parameters<AxiosAdapter>[0], data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function success<T>(code: string, data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code, message: 'Success.', data, timestamp: new Date().toISOString() };
}

const member = {
  id: 17,
  memberCode: 'M000017',
  fullName: 'Nguyễn An',
  email: 'an@example.test',
  phone: '0388919210',
  dateOfBirth: '2000-01-02',
  createdAt: '2026-10-01T08:30:00',
  updatedAt: '2026-10-02T08:30:00',
  address: null,
  emailVerified: true,
  enabled: true,
  version: 0,
  borrowedItemCount: 1,
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function configureMemberApi() {
  const requests: string[] = [];
  apiClient.defaults.adapter = (async (config) => {
    requests.push(config.url ?? '');
    if (config.url === '/api/v1/members') {
      return response(config, success('MEMBER_LIST_SUCCESS', {
        content: [{ ...member, address: undefined, updatedAt: undefined, version: undefined, borrowedItemCount: undefined }],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      }));
    }
    if (config.url === '/api/v1/members/17') {
      return response(config, success('MEMBER_DETAIL_SUCCESS', member));
    }
    if (config.url === '/api/v1/members/17/loan-history') {
      return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', {
        content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
      }));
    }
    throw new Error(`Unexpected request: ${config.method} ${config.url}`);
  }) satisfies AxiosAdapter;
  return requests;
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  window.sessionStorage.clear();
  Object.assign(mocks.auth, {
    accessToken: 'opaque-member-session',
    currentUser: { ...mocks.auth.currentUser, role: 'USER', permissions: ['member:read'] },
    role: 'USER',
    permissions: ['member:read'],
    capabilityStatus: 'ready',
  });
  mocks.auth.logout.mockReset();
  mocks.auth.logout.mockResolvedValue(undefined);
});

describe('Member routes integrated with shared Role permissions', () => {
  it('denies a USER with member:read from the member administration routes', async () => {
    let memberRequests = 0;
    apiClient.defaults.adapter = (async (config) => {
      memberRequests += 1;
      throw new Error(`Member API should not be called: ${config.url}`);
    }) satisfies AxiosAdapter;
    render(<MemoryRouter initialEntries={['/admin/members']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(screen.queryByRole('link', { name: 'Quản lý thành viên' })).toBeNull();
    expect(memberRequests).toBe(0);
  });

  it('denies an Admin without member:read and keeps the menu hidden by effective permission', async () => {
    Object.assign(mocks.auth, {
      currentUser: { ...mocks.auth.currentUser, role: 'ADMIN', permissions: ['role:read'] },
      role: 'ADMIN',
      permissions: ['role:read'],
    });
    let memberRequests = 0;
    apiClient.defaults.adapter = (async (config) => {
      memberRequests += 1;
      throw new Error(`Member API should not be called: ${config.url}`);
    }) satisfies AxiosAdapter;
    render(<MemoryRouter initialEntries={['/admin/members']}><App /><LocationProbe /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
    expect(screen.queryByRole('link', { name: 'Quản lý thành viên' })).toBeNull();
    expect(memberRequests).toBe(0);
  });

  it('clears the saved member list state when the shared AdminLayout logs out', async () => {
    Object.assign(mocks.auth, {
      currentUser: { ...mocks.auth.currentUser, role: 'ADMIN', permissions: ['member:read'] },
      role: 'ADMIN',
      permissions: ['member:read'],
    });
    configureMemberApi();
    window.sessionStorage.setItem('memberManagement:listState:v1', JSON.stringify({ privateSearch: 'Nguyen' }));
    render(<MemoryRouter initialEntries={['/admin/members']}><App /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý thành viên' });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(window.sessionStorage.getItem('memberManagement:listState:v1')).toBeNull());
  });
});
