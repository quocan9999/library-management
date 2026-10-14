// @vitest-environment jsdom
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../app/App';
import { apiClient } from '../auth/api';
import type { ApiEnvelope } from '../auth/types';
import { AppNotificationProvider } from '../components/AppNotificationProvider';

const mocks = vi.hoisted(() => ({
  auth: {
    accessToken: 'opaque-session-token',
    isBootstrapping: false,
    currentUser: {
      id: 2,
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      permissions: ['role:read', 'role:update'],
    },
    role: 'ADMIN',
    permissions: ['role:read', 'role:update'],
    capabilityStatus: 'ready',
    refreshCapabilities: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  },
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => null,
}));

const originalAdapter = apiClient.defaults.adapter;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface AccountRow {
  id: number;
  username: string;
  email: string;
  roleCode: string;
  roleDisplayName: string;
  emailVerified: boolean;
  enabled: boolean;
  systemAccount: boolean;
  sessionVersion: number;
  createdAt: string;
}

function response<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: status === 201 ? 'Created' : status === 200 ? 'OK' : 'Error', headers: new AxiosHeaders(), config };
}

function success<T>(code: string, data: T, status = 200): ApiEnvelope<T> {
  return { success: true, status, code, message: 'Success.', data, timestamp: new Date().toISOString() };
}

function apiFailure(config: InternalAxiosRequestConfig, status: number, code: string): never {
  const body: ApiEnvelope<null> = {
    success: false,
    status,
    code,
    message: 'Sensitive backend detail must not be displayed.',
    data: null,
    timestamp: new Date().toISOString(),
  };
  throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, status));
}

function initialAccounts(): AccountRow[] {
  return [
    { id: 1, username: 'root-admin', email: 'root@example.com', roleCode: 'ADMIN', roleDisplayName: 'Quản trị viên', emailVerified: true, enabled: true, systemAccount: true, sessionVersion: 1, createdAt: '2026-10-01T10:00:00' },
    { id: 2, username: 'admin', email: 'admin@example.com', roleCode: 'ADMIN', roleDisplayName: 'Quản trị viên', emailVerified: true, enabled: true, systemAccount: false, sessionVersion: 5, createdAt: '2026-10-02T10:00:00' },
    { id: 3, username: 'librarian', email: 'librarian@example.com', roleCode: 'LIBRARIAN', roleDisplayName: 'Thủ thư', emailVerified: false, enabled: true, systemAccount: false, sessionVersion: 7, createdAt: '2026-10-03T10:00:00' },
    { id: 4, username: 'archive', email: 'archive@example.com', roleCode: 'ARCHIVE', roleDisplayName: 'Nhóm lưu trữ', emailVerified: true, enabled: true, systemAccount: false, sessionVersion: 9, createdAt: '2026-10-04T10:00:00' },
    { id: 5, username: 'locked', email: 'locked@example.com', roleCode: 'LIBRARIAN', roleDisplayName: 'Thủ thư', emailVerified: true, enabled: false, systemAccount: false, sessionVersion: 14, createdAt: '2026-10-05T10:00:00' },
    // Deliberately malformed API data verifies that the UI also excludes USER rows defensively.
    { id: 99, username: 'reader', email: 'reader@example.com', roleCode: 'USER', roleDisplayName: 'Người dùng', emailVerified: true, enabled: true, systemAccount: false, sessionVersion: 0, createdAt: '2026-10-06T10:00:00' },
  ];
}

function configureApi(options: { statusFailure?: { status: number; code: string }; roleFailure?: { status: number; code: string } } = {}) {
  const requests: Array<{ method: string; url: string; params?: unknown; body?: unknown }> = [];
  const accounts = initialAccounts();
  const roles = [
    { code: 'ADMIN', displayName: 'Quản trị viên', description: '', enabled: true, version: 2, canEdit: false },
    { code: 'USER', displayName: 'Người dùng', description: '', enabled: true, version: 2, canEdit: false },
    { code: 'LIBRARIAN', displayName: 'Thủ thư', description: '', enabled: true, version: 3, canEdit: true },
    { code: 'ARCHIVE', displayName: 'Nhóm lưu trữ', description: '', enabled: false, version: 4, canEdit: false },
    { code: 'SUPER_ADMIN', displayName: 'Siêu quản trị', description: '', enabled: true, version: 1, canEdit: false },
  ];
  let nextId = 100;

  apiClient.defaults.adapter = (async (config) => {
    const method = config.method ?? '';
    const url = config.url ?? '';
    requests.push({ method, url, params: config.params, body: config.data });
    if (url === '/api/v1/roles' && method === 'get') {
      return response(config, success('ROLE_LIST_SUCCESS', roles));
    }
    if (url === '/api/v1/admin/accounts' && method === 'get') {
      const params = config.params as Record<string, unknown> | undefined;
      const username = String(params?.username ?? '').toLocaleLowerCase();
      const email = String(params?.email ?? '').toLocaleLowerCase();
      const roleCode = params?.roleCode;
      const enabled = params?.enabled;
      const emailVerified = params?.emailVerified;
      const matching = accounts.filter((account) => account.roleCode !== 'USER'
        && (!username || account.username.toLocaleLowerCase().includes(username))
        && (!email || account.email.toLocaleLowerCase().includes(email))
        && (!roleCode || account.roleCode === roleCode)
        && (enabled === undefined || account.enabled === enabled)
        && (emailVerified === undefined || account.emailVerified === emailVerified));
      const page = Number(params?.page ?? 0);
      const size = Number(params?.size ?? 10);
      return response(config, success('ADMIN_ACCOUNT_SEARCH_SUCCESS', {
        content: matching.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: matching.length,
        totalPages: Math.ceil(matching.length / size),
        first: page === 0,
        last: (page + 1) * size >= matching.length,
      }));
    }
    const accountMatch = url.match(/^\/api\/v1\/admin\/accounts\/(\d+)(?:\/(role|status))?$/);
    if (accountMatch && method === 'get') {
      const account = accounts.find(({ id }) => id === Number(accountMatch[1]));
      if (!account) apiFailure(config, 404, 'ADMIN_ACCOUNT_NOT_FOUND');
      return response(config, success('ADMIN_ACCOUNT_DETAIL_SUCCESS', account));
    }
    if (url === '/api/v1/admin/accounts' && method === 'post') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      const role = roles.find(({ code }) => code === body.roleCode);
      const created: AccountRow = {
        id: nextId++,
        username: String(body.username),
        email: String(body.email),
        roleCode: String(body.roleCode),
        roleDisplayName: role?.displayName ?? String(body.roleCode),
        emailVerified: false,
        enabled: true,
        systemAccount: false,
        sessionVersion: 0,
        createdAt: '2026-10-15T10:00:00',
      };
      accounts.push(created);
      return response(config, success('ADMIN_ACCOUNT_CREATED', created, 201), 201);
    }
    if (accountMatch && method === 'patch' && accountMatch[2] === 'role') {
      if (options.roleFailure) apiFailure(config, options.roleFailure.status, options.roleFailure.code);
      const account = accounts.find(({ id }) => id === Number(accountMatch[1]));
      if (!account) apiFailure(config, 404, 'ADMIN_ACCOUNT_NOT_FOUND');
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      account.roleCode = String(body.roleCode);
      account.roleDisplayName = roles.find(({ code }) => code === account.roleCode)?.displayName ?? account.roleCode;
      account.sessionVersion += 1;
      return response(config, success('ADMIN_ACCOUNT_ROLE_UPDATED', account));
    }
    if (accountMatch && method === 'patch' && accountMatch[2] === 'status') {
      if (options.statusFailure) apiFailure(config, options.statusFailure.status, options.statusFailure.code);
      const account = accounts.find(({ id }) => id === Number(accountMatch[1]));
      if (!account) apiFailure(config, 404, 'ADMIN_ACCOUNT_NOT_FOUND');
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      account.enabled = Boolean(body.enabled);
      account.sessionVersion += 1;
      return response(config, success('ADMIN_ACCOUNT_STATUS_UPDATED', account));
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }) satisfies AxiosAdapter;

  return { requests, accounts };
}

function LocationProbe() {
  return <output aria-label="current path">{useLocation().pathname}</output>;
}

function renderApp(path: string) {
  return render(<AppNotificationProvider><MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter></AppNotificationProvider>);
}

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function accountRow(id: number): HTMLTableRowElement {
  const row = document.querySelector<HTMLTableRowElement>(`.admin-account-table-wrap tr[data-row-key="${id}"]`);
  if (!row) throw new Error(`Account row not found: ${id}`);
  return row;
}

function inputByLabel(label: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!input) throw new Error(`Input not found: ${label}`);
  return input;
}

function inputById(id: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Input not found: ${id}`);
  return input;
}

async function chooseRoleOption(label: string) {
  const user = userEvent.setup();
  await waitFor(() => expect(Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'))
    .some((option) => option.textContent?.includes(label))).toBe(true));
  const option = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'))
    .find((candidate) => candidate.textContent?.includes(label));
  if (!option) throw new Error(`Role option not found: ${label}`);
  await user.click(option);
}

function openSelect(label: string) {
  const input = inputByLabel(label);
  const root = input.closest('.ant-select');
  const selector = root?.querySelector<HTMLElement>('.ant-select-content') ?? root;
  if (!selector) throw new Error(`Select control not found: ${label}`);
  fireEvent.mouseDown(input, { button: 0 });
  fireEvent.mouseDown(selector, { button: 0 });
  fireEvent.click(root as HTMLElement);
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => ({ matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
  });
  Object.assign(mocks.auth, {
    accessToken: 'opaque-session-token',
    isBootstrapping: false,
    currentUser: { id: 2, username: 'admin', email: 'admin@example.com', role: 'ADMIN', permissions: ['role:read', 'role:update'] },
    role: 'ADMIN',
    permissions: ['role:read', 'role:update'],
    capabilityStatus: 'ready',
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  apiClient.defaults.adapter = originalAdapter;
  mocks.auth.refreshCapabilities.mockClear();
});

describe('admin account UI routes', () => {
  it('blocks USER access to the admin account page despite stale RBAC permissions', async () => {
    Object.assign(mocks.auth, {
      role: 'USER',
      currentUser: { id: 9, username: 'reader', email: 'reader@example.com', role: 'USER', permissions: ['role:read', 'role:update'] },
      permissions: ['role:read', 'role:update'],
    });
    renderApp('/admin/accounts');

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/403'));
  });

  it('shows only admin accounts from the API and uses server-backed filters', async () => {
    const api = configureApi();
    renderApp('/admin/accounts');

    expect(document.querySelector('#admin-account-title')?.textContent).toBe('Quản lý tài khoản quản trị');
    await waitFor(() => expect(document.querySelector('.admin-account-table-wrap')?.textContent).toContain('librarian@example.com'));
    expect(document.body.textContent).not.toContain('reader@example.com');
    expect(accountRow(1).textContent).toContain('Tài khoản hệ thống');
    openSelect('Lọc theo nhóm quyền');
    await waitFor(() => expect(Array.from(document.querySelectorAll('.ant-select-item-option'))
      .some((option) => option.textContent?.includes('Siêu quản trị (SUPER_ADMIN)'))).toBe(true));
    fireEvent.keyDown(inputByLabel('Lọc theo nhóm quyền'), { key: 'Escape', keyCode: 27 });
    const usernameInput = document.querySelector<HTMLInputElement>('.admin-account-filters input[aria-label="Tên đăng nhập"]');
    expect(usernameInput).not.toBeNull();
    fireEvent.change(usernameInput as HTMLInputElement, { target: { value: 'librarian' } });
    await waitFor(() => expect(api.requests.some(({ url, params }) => url === '/api/v1/admin/accounts'
      && (params as Record<string, unknown> | undefined)?.username === 'librarian')).toBe(true), { timeout: 2500 });
    expect(document.querySelector('.admin-account-table-wrap')?.textContent).toContain('librarian@example.com');
  });

  it('requires a role and confirms ADMIN privilege before creating an unverified account', async () => {
    const api = configureApi();
    renderApp('/admin/accounts');

    await waitFor(() => expect(document.querySelector('#admin-account-title')?.textContent).toBe('Quản lý tài khoản quản trị'));
    fireEvent.click(buttonByText(document, 'Tạo tài khoản quản trị'));
    const createButton = buttonByText(document, 'Tạo tài khoản');
    expect(createButton.disabled).toBe(true);
    fireEvent.change(inputById('admin-account-username'), { target: { value: 'newadmin' } });
    fireEvent.change(inputById('admin-account-email'), { target: { value: 'newadmin@example.com' } });
    fireEvent.change(inputById('admin-account-password'), { target: { value: 'StrongPass1!' } });
    fireEvent.change(inputById('admin-account-password-confirm'), { target: { value: 'StrongPass1!' } });
    expect(createButton.disabled).toBe(true);
    openSelect('Nhóm quyền');
    await chooseRoleOption('Quản trị viên (ADMIN)');
    expect(buttonByText(document, 'Tạo tài khoản').disabled).toBe(false);
    fireEvent.click(buttonByText(document, 'Tạo tài khoản'));

    await waitFor(() => expect(document.body.textContent).toContain('Nhóm ADMIN có toàn quyền'));
    expect(api.requests.some(({ method, url }) => method === 'post' && url === '/api/v1/admin/accounts')).toBe(false);
    fireEvent.click(buttonByText(document, 'Xác nhận cấp ADMIN'));
    await waitFor(() => expect(api.requests.some(({ method, url }) => method === 'post' && url === '/api/v1/admin/accounts')).toBe(true));
    const request = api.requests.find(({ method, url }) => method === 'post' && url === '/api/v1/admin/accounts');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body).toEqual({ username: 'newadmin', email: 'newadmin@example.com', password: 'StrongPass1!', roleCode: 'ADMIN' });
    await waitFor(() => expect(document.body.textContent).toContain('chưa xác minh email'));
    fireEvent.click(buttonByText(document, 'Tạo tài khoản quản trị'));
    expect(document.querySelector('#admin-account-role')?.closest('.ant-select')?.textContent).toContain('Chọn nhóm đang hoạt động');
    fireEvent.click(buttonByText(document, 'Hủy'));
  });

  it('confirms disabling another account with its current session version', async () => {
    const api = configureApi();
    renderApp('/admin/accounts');

    await waitFor(() => expect(document.querySelector('.admin-account-table-wrap')?.textContent).toContain('librarian@example.com'));
    fireEvent.click(buttonByText(accountRow(3), 'Khóa tài khoản'));
    await waitFor(() => expect(document.body.textContent).toContain('phải đăng nhập lại'));
    fireEvent.click(buttonByText(document, 'Xác nhận khóa tài khoản'));

    await waitFor(() => expect(api.requests.some(({ method, url }) => method === 'patch' && url === '/api/v1/admin/accounts/3/status')).toBe(true));
    const request = api.requests.find(({ method, url }) => method === 'patch' && url === '/api/v1/admin/accounts/3/status');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body).toEqual({ enabled: false, expectedSessionVersion: 7 });
    expect(api.accounts.find(({ id }) => id === 3)?.enabled).toBe(false);
  });

  it('blocks a role change from an inactive source group until that group is activated', async () => {
    const api = configureApi();
    renderApp('/admin/authorization/assignments');

    await waitFor(() => expect(document.querySelector('.admin-account-table-wrap')?.textContent).toContain('archive@example.com'));
    fireEvent.click(buttonByText(accountRow(4), 'Đổi nhóm'));

    await waitFor(() => expect(document.body.textContent).toContain('Kích hoạt nhóm trước khi chuyển'));
    expect(api.requests.some(({ method, url }) => method === 'patch' && url === '/api/v1/admin/accounts/4/role')).toBe(false);
  });

  it('confirms an assignment and posts the selected active role with the account session version', async () => {
    const api = configureApi();
    renderApp('/admin/authorization/assignments');

    await waitFor(() => expect(document.querySelector('.admin-account-table-wrap')?.textContent).toContain('librarian@example.com'));
    fireEvent.click(buttonByText(accountRow(3), 'Đổi nhóm'));
    openSelect('Nhóm quyền mới');
    await chooseRoleOption('Quản trị viên (ADMIN)');
    fireEvent.click(buttonByText(document, 'Tiếp tục'));

    await waitFor(() => expect(document.body.textContent).toContain('librarian'));
    await waitFor(() => expect(document.body.textContent).toContain('Tất cả phiên đăng nhập'));
    fireEvent.click(buttonByText(document, 'Xác nhận đổi nhóm'));
    await waitFor(() => expect(api.requests.some(({ method, url }) => method === 'patch' && url === '/api/v1/admin/accounts/3/role')).toBe(true));
    const request = api.requests.find(({ method, url }) => method === 'patch' && url === '/api/v1/admin/accounts/3/role');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body).toEqual({ roleCode: 'ADMIN', expectedSessionVersion: 7 });
    expect(api.accounts.find(({ id }) => id === 3)?.roleCode).toBe('ADMIN');
  });
});
