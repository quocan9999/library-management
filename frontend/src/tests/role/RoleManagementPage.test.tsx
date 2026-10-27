// @vitest-environment jsdom
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { AppNotificationProvider } from '../../components/AppNotificationProvider';
import { RoleManagementPage, RolePermissionDetailPage } from '../../role/RoleManagementPage';
import type { RolePermissions } from '../../role/types';

const mocks = vi.hoisted(() => ({
  refreshCapabilities: vi.fn(),
  currentUser: {
    id: 2,
    username: 'admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    permissions: ['role:read', 'role:update', 'book:read', 'book:import', 'member:read'],
  },
}));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mocks.currentUser,
    refreshCapabilities: mocks.refreshCapabilities,
  }),
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function response<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: status === 200 ? 'OK' : 'Forbidden', headers: new AxiosHeaders(), config };
}

function success<T>(code: string, data: T): ApiEnvelope<T> {
  return {
    success: true,
    status: 200,
    code,
    message: 'Success.',
    data,
    timestamp: new Date().toISOString(),
  };
}

function failure(config: InternalAxiosRequestConfig, status: number, code: string, message = 'Private server message.'): never {
  const body: ApiEnvelope<null> = {
    success: false,
    status,
    code,
    message,
    data: null,
    timestamp: new Date().toISOString(),
  };
  throw new AxiosError(
    'Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined,
    response(config, body, status),
  );
}

function configureRoleApi(options: {
  patchStatus?: number;
  patchCode?: string;
  version?: number;
  userCanEdit?: boolean;
  deferPatch?: boolean;
  assignedPermissions?: string[];
  patchMessage?: string;
  unmanageableMemberRead?: boolean;
  createStatus?: number;
  createCode?: string;
  metadataStatus?: number;
  metadataCode?: string;
  statusStatus?: number;
  statusCode?: string;
  additionalRoles?: Array<{
    code: string;
    displayName: string;
    description: string | null;
    enabled: boolean;
    version: number;
    systemRole: boolean;
    accountCount: number;
    permissionCount: number;
    createdAt: string | null;
    canEdit: boolean;
  }>;
} = {}) {
  const requests: Array<{ method: string; url: string; body: unknown; params?: unknown }> = [];
  let detailReads = 0;
  let roleCodes: string[] = [];
  let resolvePendingPatch: ((result: RolePermissions) => void) | undefined;
  const roleList = [
    { code: 'ADMIN', displayName: 'Quản trị viên', description: 'Quản trị viên', version: 3, canEdit: false, enabled: true },
    { code: 'USER', displayName: 'Người dùng', description: 'Người dùng', version: options.version ?? 7, canEdit: options.userCanEdit ?? true, enabled: true },
    ...(options.additionalRoles ?? []).map(({ code, displayName, description, version, canEdit, enabled }) => ({
      code, displayName, description: description ?? '', version, canEdit, enabled,
    })),
  ];
  const searchRows = [
    {
      code: 'ADMIN', displayName: 'Quản trị viên', description: 'Quản trị viên', enabled: true, version: 3,
      systemRole: true, accountCount: 1, permissionCount: 12, createdAt: '2026-10-14T10:00:00', canEdit: false,
    },
    {
      code: 'USER', displayName: 'Người dùng', description: 'Người dùng', enabled: true, version: options.version ?? 7,
      systemRole: true, accountCount: 4, permissionCount: 3, createdAt: '2026-10-14T10:00:00', canEdit: options.userCanEdit ?? true,
    },
    ...(options.additionalRoles ?? []),
  ];
  apiClient.defaults.adapter = (async (config) => {
    requests.push({ method: config.method ?? '', url: config.url ?? '', body: config.data, params: config.params });
    if (config.url === '/api/v1/roles' && config.method === 'get') {
      roleCodes = roleList.map(({ code }) => code);
      return response(config, success('ROLE_LIST_SUCCESS', roleList));
    }
    if (config.url === '/api/v1/roles/search') {
      const params = config.params as Record<string, unknown> | undefined;
      const query = typeof params?.q === 'string' ? params.q.toLocaleLowerCase() : '';
      const status = params?.status;
      const filtered = searchRows.filter((item) => (!query
        || `${item.code} ${item.displayName} ${item.description ?? ''}`.toLocaleLowerCase().includes(query))
        && (!status || (status === 'ACTIVE' ? item.enabled : !item.enabled)));
      const page = Number(params?.page ?? 0);
      const size = Number(params?.size ?? 10);
      return response(config, success('ROLE_SEARCH_SUCCESS', {
        content: filtered.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
        first: page === 0,
        last: (page + 1) * size >= filtered.length,
      }));
    }
    if (config.url === '/api/v1/roles' && config.method === 'post') {
      if (options.createStatus) failure(config, options.createStatus, options.createCode ?? 'ROLE_CODE_CONFLICT');
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      return response(config, success('ROLE_CREATED', {
        code: body.code,
        displayName: body.displayName,
        description: body.description,
        enabled: true,
        version: 0,
        systemRole: false,
        readOnly: false,
        accountCount: 0,
        permissionCount: Array.isArray(body.permissions) ? body.permissions.length : 0,
        createdAt: '2026-10-15T10:00:00',
      }));
    }
    if (config.url === '/api/v1/permissions') {
      return response(config, success('PERMISSION_LIST_SUCCESS', [
        { code: 'role:read', description: 'Xem vai trò', manageableByActor: true, dependencies: [] },
        { code: 'role:update', description: 'Cập nhật quyền', manageableByActor: true, dependencies: ['role:read'] },
        { code: 'book:read', description: 'Xem sách', manageableByActor: true, dependencies: [] },
        { code: 'book:create', description: 'Tạo sách', manageableByActor: true, dependencies: ['book:read'] },
        { code: 'book:update', description: 'Cập nhật sách', manageableByActor: true, dependencies: ['book:read'] },
        { code: 'book:delete', description: 'Xóa sách', manageableByActor: false, dependencies: ['book:read'] },
        { code: 'book:import', description: 'Nhập sách', manageableByActor: true, dependencies: ['book:read'] },
        { code: 'member:read', description: 'Xem thành viên', manageableByActor: !options.unmanageableMemberRead, dependencies: [] },
        { code: 'member:create', description: 'Tạo thành viên', manageableByActor: true, dependencies: ['member:read'] },
        { code: 'member:update', description: 'Cập nhật thành viên', manageableByActor: true, dependencies: ['member:read'] },
        { code: 'member:delete', description: 'Xóa thành viên', manageableByActor: true, dependencies: ['member:read'] },
        { code: 'future:review', description: 'Xem nghiệp vụ mới', manageableByActor: false, dependencies: [] },
      ]));
    }
    if (config.url?.startsWith('/api/v1/roles/') && config.url.endsWith('/permissions') && config.method === 'get') {
      detailReads += 1;
      const targetRoleCode = config.url.split('/')[4] ?? 'USER';
      const assigned = targetRoleCode === 'ADMIN' ? ['role:read', 'role:update'] : options.assignedPermissions ?? ['book:read', 'book:delete'];
      return response(config, success('ROLE_PERMISSIONS_SUCCESS', {
        roleCode: targetRoleCode,
        version: targetRoleCode === 'USER' ? options.version ?? 7 : 3,
        assignedPermissions: assigned,
        effectivePermissions: assigned,
        editablePermissions: targetRoleCode === 'ADMIN'
          ? ['role:read', 'role:update']
          : options.userCanEdit === false ? []
            : ['book:read', 'book:create', 'book:update', 'book:import', 'member:read', 'member:create', 'member:update', 'member:delete'],
        editable: targetRoleCode !== 'ADMIN'
          && (targetRoleCode !== 'USER' || options.userCanEdit !== false),
      }));
    }
    if (config.url === '/api/v1/roles/USER/permissions' && config.method === 'patch') {
      if (options.patchStatus) failure(config, options.patchStatus, options.patchCode ?? 'PERMISSION_DENIED', options.patchMessage);
      if (options.deferPatch) {
        return await new Promise((resolve) => {
          resolvePendingPatch = (result) => resolve(response(config, success('ROLE_PERMISSIONS_UPDATED', result)));
        });
      }
      return response(config, success('ROLE_PERMISSIONS_UPDATED', {
        roleCode: 'USER',
        version: (options.version ?? 7) + 1,
        assignedPermissions: options.assignedPermissions ?? ['book:read', 'book:delete'],
        effectivePermissions: options.assignedPermissions ?? ['book:read', 'book:delete'],
        editablePermissions: ['book:read', 'book:create', 'book:update', 'book:import', 'member:read', 'member:create'],
        editable: true,
      }));
    }
    if (config.url?.startsWith('/api/v1/roles/') && config.url.endsWith('/status') && config.method === 'patch') {
      if (options.statusStatus) failure(config, options.statusStatus, options.statusCode ?? 'ROLE_VERSION_CONFLICT');
      const roleCode = config.url.split('/')[4];
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      const current = searchRows.find((role) => role.code === roleCode);
      return response(config, success('ROLE_STATUS_UPDATED', {
        code: roleCode,
        displayName: current?.displayName ?? roleCode,
        description: current?.description ?? '',
        enabled: body.enabled,
        version: Number(body.expectedVersion) + 1,
        systemRole: current?.systemRole ?? false,
        readOnly: false,
        accountCount: current?.accountCount ?? 0,
        permissionCount: current?.permissionCount ?? 1,
        createdAt: current?.createdAt ?? '2026-10-15T10:00:00',
      }));
    }
    if (config.url?.startsWith('/api/v1/roles/') && config.method === 'patch' && !config.url.endsWith('/permissions')) {
      if (options.metadataStatus) failure(config, options.metadataStatus, options.metadataCode ?? 'ROLE_VERSION_CONFLICT');
      const roleCode = config.url.split('/')[4];
      const body = typeof config.data === 'string' ? JSON.parse(config.data) as Record<string, unknown> : config.data as Record<string, unknown>;
      const current = searchRows.find((role) => role.code === roleCode);
      return response(config, success('ROLE_UPDATED', {
        code: roleCode,
        displayName: body.displayName,
        description: body.description,
        enabled: current?.enabled ?? true,
        version: Number(body.expectedVersion) + 1,
        systemRole: current?.systemRole ?? false,
        readOnly: false,
        accountCount: current?.accountCount ?? 0,
        permissionCount: current?.permissionCount ?? 1,
        createdAt: current?.createdAt ?? '2026-10-15T10:00:00',
      }));
    }
    throw new Error(`Unexpected request: ${config.method} ${config.url}`);
  }) satisfies AxiosAdapter;
  return {
    requests,
    resolvePendingPatch: (result: RolePermissions) => resolvePendingPatch?.(result),
    get detailReads() { return detailReads; },
    get roleCodes() { return roleCodes; },
  };
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  mocks.refreshCapabilities.mockResolvedValue(undefined);
  Object.assign(mocks.currentUser, {
    id: 2,
    username: 'admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    permissions: ['role:read', 'role:update', 'book:read', 'book:create', 'book:import', 'member:read', 'member:create'],
  });
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  apiClient.defaults.adapter = originalAdapter;
  mocks.refreshCapabilities.mockReset();
});

function renderDetailPage(roleCode = 'USER') {
  return render(
    <MemoryRouter initialEntries={[`/admin/authorization/groups/${roleCode}`]}>
      <Routes>
        <Route path="/admin/authorization/groups/:roleCode" element={<RolePermissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderDetailPageWithNotifications(roleCode = 'USER') {
  return render(
    <AppNotificationProvider>
      <MemoryRouter initialEntries={[`/admin/authorization/groups/${roleCode}`]}>
        <Routes>
          <Route path="/admin/authorization/groups/:roleCode" element={<RolePermissionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppNotificationProvider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

describe('RoleManagementPage', () => {
  it('adds permission dependencies when an operation is selected and previews the complete delta', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /member:create/ }));

    expect((screen.getByRole('checkbox', { name: /member:read/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    const preview = within(screen.getByRole('dialog'));
    expect(preview.getByText('member:create')).toBeTruthy();
    expect(preview.getByText('member:read')).toBeTruthy();
    expect(preview.getByRole('heading', { name: 'Quyền được thêm (2)' })).toBeTruthy();
  });

  it('applies dependencies when the permission-group checkbox is selected', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /Chọn tất cả quyền nhóm Thành viên/ }));

    expect((screen.getByRole('checkbox', { name: /member:read/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /member:create/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Quyền được thêm (4)' })).toBeTruthy();
  });

  it('does not select an operation when the actor cannot grant its missing dependency', async () => {
    const user = userEvent.setup();
    configureRoleApi({ unmanageableMemberRead: true });
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /member:create/ }));

    expect((screen.getByRole('checkbox', { name: /member:create/ }) as HTMLInputElement).checked).toBe(false);
    expect(await screen.findByText(/không được phép cấp quyền đó/)).toBeTruthy();
  });

  it('keeps base permission when an operation is removed', async () => {
    const user = userEvent.setup();
    configureRoleApi({ assignedPermissions: ['book:read', 'book:delete', 'member:read', 'member:create'] });
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /member:create/ }));

    expect((screen.getByRole('checkbox', { name: /member:read/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    const preview = within(screen.getByRole('dialog'));
    expect(preview.getByRole('heading', { name: 'Quyền được gỡ (1)' })).toBeTruthy();
    expect(preview.getByText('member:create')).toBeTruthy();
    expect(preview.queryByText('member:read')).toBeNull();
  });

  it('blocks saving a base permission removal until all dependent permissions are also removed', async () => {
    const user = userEvent.setup();
    configureRoleApi({ assignedPermissions: ['book:read', 'book:delete', 'member:read', 'member:create'] });
    renderDetailPageWithNotifications();

    await user.click(await screen.findByRole('checkbox', { name: /member:read/ }));
    expect(await screen.findByText(/Không thể gỡ quyền cơ sở member:read/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Xem thay đổi và lưu' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: /member:create/ }));
    expect((screen.getByRole('button', { name: 'Xem thay đổi và lưu' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Quyền được gỡ (2)' })).toBeTruthy();
  });

  it('shows a clear API dependency error and keeps the draft when the server rejects it', async () => {
    const user = userEvent.setup();
    configureRoleApi({
      patchStatus: 400,
      patchCode: 'ROLE_PERMISSION_DEPENDENCY_CONFLICT',
      patchMessage: 'Không thể thu hồi member:read khi còn member:create.',
    });
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Không thể thu hồi member:read khi còn member:create.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('selects only editable permissions in a group and preserves assigned locked rights', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    renderDetailPage();

    const locked = await screen.findByRole('checkbox', { name: /book:delete/ });
    const group = screen.getByRole('checkbox', { name: /Chọn tất cả quyền nhóm Sách/ });
    expect((locked as HTMLInputElement).checked).toBe(true);
    expect((locked as HTMLInputElement).disabled).toBe(true);
    expect((group as HTMLInputElement).indeterminate).toBe(true);

    await user.click(group);

    expect((screen.getByRole('checkbox', { name: /book:read/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /book:import/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /book:delete/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('region', { name: 'Nhóm future' })).toBeTruthy();
  });

  it('keeps edits and does not retry a denied PATCH while syncing current capabilities', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({ patchStatus: 403, patchCode: 'PERMISSION_DENIED' });
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(mocks.refreshCapabilities).toHaveBeenCalledTimes(1));
    expect(api.requests.filter(({ method }) => method === 'patch')).toHaveLength(1);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('canceling the preview retains the draft and sends no PATCH', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi();
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(api.requests.filter(({ method }) => method === 'patch')).toHaveLength(0);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('1 thêm · 0 gỡ')).toBeTruthy();
  });

  it('lets an Admin view both permitted targets and keeps its own role read-only', async () => {
    configureRoleApi();
    renderDetailPage('ADMIN');

    const ownPermission = await screen.findByRole('checkbox', { name: /role:read/ });
    expect((ownPermission as HTMLInputElement).checked).toBe(true);
    expect((ownPermission as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText('Chỉ xem').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps USER read-only when an Admin has role:read but lacks role:update', async () => {
    Object.assign(mocks.currentUser, { permissions: ['role:read'] });
    configureRoleApi({ userCanEdit: false });
    renderDetailPage();

    const assignment = await screen.findByRole('checkbox', { name: /book:create/ });
    expect((assignment as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }).hasAttribute('disabled')).toBe(true);
  });

  it('preserves pending edits after 409 until the user confirms a refresh', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({ patchStatus: 409, patchCode: 'ROLE_VERSION_CONFLICT' });
    renderDetailPage();

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.detailReads).toBe(1);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Tải lại quyền' }));
    expect(api.detailReads).toBe(1);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Xác nhận tải lại' }));
    await waitFor(() => expect(api.detailReads).toBe(2));
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('locks the role target and preview close actions while a save is pending', async () => {
    const user = userEvent.setup();
    Object.assign(mocks.currentUser, {
      id: 1,
      username: 'admin',
      email: null,
      role: 'ADMIN',
      permissions: ['role:read', 'role:update'],
    });
    const api = configureRoleApi({ deferPatch: true });
    renderDetailPageWithNotifications();

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(api.requests.filter(({ method }) => method === 'patch')).toHaveLength(1));

    // role-target-select combobox was removed in favor of dedicated route
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

    api.resolvePendingPatch?.({
      roleCode: 'USER',
      version: 8,
      assignedPermissions: ['book:read', 'book:create', 'book:delete'],
      effectivePermissions: ['book:read', 'book:create', 'book:delete'],
      editablePermissions: ['book:read', 'book:create', 'book:import', 'member:read'],
      editable: true,
    });

    expect(await screen.findByText('Đã cập nhật quyền cho vai trò.')).toBeTruthy();
    expect(screen.getByText('Đã cập nhật quyền cho vai trò.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('navigates to permission detail page when clicking Phân quyền in the group list', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    render(
      <MemoryRouter initialEntries={['/admin/authorization/groups']}>
        <Routes>
          <Route path="/admin/authorization/groups" element={<RoleManagementPage />} />
          <Route path="/admin/authorization/groups/:roleCode" element={<RolePermissionDetailPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    const editBtn = await screen.findByRole('button', { name: 'Phân quyền' });
    await user.click(editBtn);

    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/admin/authorization/groups/USER'));
    expect(await screen.findByRole('heading', { name: /Phân quyền:/ })).toBeTruthy();
  });

  it('renders both Quyền quản trị and Quyền độc giả tabs in detail page', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    renderDetailPage('USER');

    expect(await screen.findByRole('tab', { name: 'Quyền quản trị' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Quyền độc giả' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Quyền độc giả' }));
    expect(await screen.findByRole('heading', { name: 'Sách' })).toBeTruthy();
  });

  it('links back to the group list from the permission detail page', async () => {
    configureRoleApi();
    renderDetailPage('USER');

    const backLink = await screen.findByRole('link', { name: /Quay lại danh sách nhóm/ });
    expect(backLink.getAttribute('href')).toBe('/admin/authorization/groups');
  });

  it('creates a dynamic group with auto-added dependencies and never submits protected permissions', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi();
    render(<AppNotificationProvider><MemoryRouter><RoleManagementPage /></MemoryRouter></AppNotificationProvider>);

    await screen.findByRole('heading', { name: 'Nhóm quyền' });
    await user.click(screen.getByRole('button', { name: 'Tạo nhóm quyền' }));
    const dialog = within(screen.getByRole('dialog'));
    const createButton = dialog.getByRole('button', { name: 'Tạo nhóm' });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);

    await user.type(dialog.getByLabelText('Mã nhóm'), 'librarian');
    await user.type(dialog.getByLabelText('Tên hiển thị'), 'Thủ thư');
    await user.click(dialog.getByRole('button', { name: 'Hiện quyền không thể cấp' }));
    const protectedPermission = dialog.getByRole('checkbox', { name: /book:delete/ });
    expect((protectedPermission as HTMLInputElement).disabled).toBe(true);
    await user.click(dialog.getByRole('checkbox', { name: /book:create/ }));

    expect((dialog.getByRole('checkbox', { name: /book:read/ }) as HTMLInputElement).checked).toBe(true);
    expect(dialog.getByText('Quyền cơ sở sẽ được thêm tự động')).toBeTruthy();
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(createButton);

    await waitFor(() => expect(api.requests.some(({ method, url }) => method === 'post' && url === '/api/v1/roles')).toBe(true));
    const request = api.requests.find(({ method, url }) => method === 'post' && url === '/api/v1/roles');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body.code).toBe('LIBRARIAN');
    expect(body.displayName).toBe('Thủ thư');
    expect(body.permissions).toEqual(['book:create', 'book:read']);
  });

  it('does not auto-add an ungrantable prerequisite when a permission group is selected', async () => {
    const user = userEvent.setup();
    configureRoleApi({ unmanageableMemberRead: true });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Nhóm quyền' });
    await user.click(screen.getByRole('button', { name: 'Tạo nhóm quyền' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Mã nhóm'), 'librarian');
    await user.type(dialog.getByLabelText('Tên hiển thị'), 'Thủ thư');
    await user.click(dialog.getByRole('checkbox', { name: 'Chọn tất cả quyền nhóm Thành viên' }));

    expect((dialog.getByRole('checkbox', { name: /member:create/ }) as HTMLInputElement).checked).toBe(false);
    expect(dialog.getByText(/không được phép cấp quyền đó/)).toBeTruthy();
    expect((dialog.getByRole('button', { name: 'Tạo nhóm' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the create draft and reports a duplicate code as a field-level conflict', async () => {
    const user = userEvent.setup();
    configureRoleApi({ createStatus: 409, createCode: 'ROLE_CODE_CONFLICT' });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Nhóm quyền' });
    await user.click(screen.getByRole('button', { name: 'Tạo nhóm quyền' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Mã nhóm'), 'librarian');
    await user.type(dialog.getByLabelText('Tên hiển thị'), 'Thủ thư');
    await user.click(dialog.getByRole('checkbox', { name: /book:read/ }));
    await user.click(dialog.getByRole('button', { name: 'Tạo nhóm' }));

    expect(await dialog.findByRole('alert')).toBeTruthy();
    expect(dialog.getByText('Mã nhóm này đã được sử dụng. Hãy chọn mã khác.')).toBeTruthy();
    expect((dialog.getByLabelText('Mã nhóm') as HTMLInputElement).value).toBe('LIBRARIAN');
    expect((dialog.getByLabelText('Tên hiển thị') as HTMLInputElement).value).toBe('Thủ thư');
  });

  it('limits each group row to its allowed metadata, permission, and status actions', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({
      additionalRoles: [
        {
          code: 'LIBRARIAN', displayName: 'Thủ thư', description: 'Quản lý sách', enabled: true,
          version: 4, systemRole: false, accountCount: 2, permissionCount: 3,
          createdAt: '2026-10-15T10:00:00', canEdit: true,
        },
        {
          code: 'ARCHIVE', displayName: 'Nhóm lưu trữ', description: '', enabled: false,
          version: 6, systemRole: false, accountCount: 1, permissionCount: 2,
          createdAt: '2026-10-15T10:00:00', canEdit: false,
        },
      ],
    });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Nhóm quyền' });
    const adminRow = await screen.findByRole('row', { name: /ADMIN/ });
    expect(within(adminRow).getByRole('button', { name: 'Xem quyền' })).toBeTruthy();
    expect(within(adminRow).queryByRole('button', { name: 'Sửa thông tin' })).toBeNull();
    const userRow = screen.getByRole('row', { name: /USER/ });
    expect(within(userRow).getByRole('button', { name: 'Sửa thông tin' })).toBeTruthy();
    expect(within(userRow).queryByRole('button', { name: 'Ngừng hoạt động' })).toBeNull();
    const activeRow = screen.getByRole('row', { name: /LIBRARIAN/ });
    expect(within(activeRow).getByRole('button', { name: 'Phân quyền' })).toBeTruthy();
    expect(within(activeRow).getByRole('button', { name: 'Sửa thông tin' })).toBeTruthy();
    const inactiveRow = screen.getByRole('row', { name: /ARCHIVE/ });
    expect(within(inactiveRow).getByRole('button', { name: 'Kích hoạt' })).toBeTruthy();
    expect(within(inactiveRow).queryByRole('button', { name: 'Sửa thông tin' })).toBeNull();

    await user.click(within(inactiveRow).getByRole('button', { name: 'Kích hoạt' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Kích hoạt nhóm quyền?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Kích hoạt nhóm' }));
    await waitFor(() => expect(api.requests.some(({ url, method }) => url.endsWith('/ARCHIVE/status') && method === 'patch')).toBe(true));
    const statusRequest = api.requests.find(({ url, method }) => url.endsWith('/ARCHIVE/status') && method === 'patch');
    const statusBody = typeof statusRequest?.body === 'string' ? JSON.parse(statusRequest.body) as Record<string, unknown> : statusRequest?.body as Record<string, unknown>;
    expect(statusBody).toEqual({ expectedVersion: 6, enabled: true });
  });

  it('warns before disabling an active custom group and preserves the expected version', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({
      additionalRoles: [{
        code: 'LIBRARIAN', displayName: 'Thủ thư', description: 'Quản lý sách', enabled: true,
        version: 4, systemRole: false, accountCount: 2, permissionCount: 3,
        createdAt: '2026-10-15T10:00:00', canEdit: true,
      }],
    });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    const activeRow = await screen.findByRole('row', { name: /LIBRARIAN/ });
    await user.click(within(activeRow).getByRole('button', { name: 'Ngừng hoạt động' }));
    expect(screen.getByText(/Quyền của Thủ thư sẽ tạm mất hiệu lực với mọi tài khoản/)).toBeTruthy();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ngừng hoạt động' }));

    await waitFor(() => expect(api.requests.some(({ url, method }) => url.endsWith('/LIBRARIAN/status') && method === 'patch')).toBe(true));
    const request = api.requests.find(({ url, method }) => url.endsWith('/LIBRARIAN/status') && method === 'patch');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body).toEqual({ expectedVersion: 4, enabled: false });
  });

  it('submits server search text and displays dynamic group names from the API', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({
      additionalRoles: [{
        code: 'LIBRARIAN', displayName: 'Thủ thư', description: 'Quản lý sách', enabled: true,
        version: 4, systemRole: false, accountCount: 2, permissionCount: 3,
        createdAt: '2026-10-15T10:00:00', canEdit: true,
      }],
    });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    expect(await screen.findByRole('row', { name: /LIBRARIAN Thủ thư/ })).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Tìm nhóm quyền' }), 'librarian');
    await waitFor(() => expect(api.requests.some(({ url, params }) =>
      url === '/api/v1/roles/search' && (params as Record<string, unknown> | undefined)?.q === 'librarian')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('row', { name: /ADMIN Quản trị viên/ })).toBeNull());
    expect(screen.getByRole('row', { name: /LIBRARIAN Thủ thư/ })).toBeTruthy();
  });

  it('edits only group metadata and sends the current row version', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({
      additionalRoles: [{
        code: 'LIBRARIAN', displayName: 'Thủ thư', description: 'Quản lý sách', enabled: true,
        version: 4, systemRole: false, accountCount: 2, permissionCount: 3,
        createdAt: '2026-10-15T10:00:00', canEdit: true,
      }],
    });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    const row = await screen.findByRole('row', { name: /LIBRARIAN Thủ thư/ });
    await user.click(within(row).getByRole('button', { name: 'Sửa thông tin' }));
    const dialog = within(screen.getByRole('dialog'));
    expect((dialog.getByLabelText('Mã nhóm') as HTMLInputElement).readOnly).toBe(true);
    await user.clear(dialog.getByLabelText('Tên hiển thị'));
    await user.type(dialog.getByLabelText('Tên hiển thị'), 'Thủ thư trưởng');
    await user.click(dialog.getByRole('button', { name: 'Lưu thông tin' }));

    await waitFor(() => expect(api.requests.some(({ method, url }) => method === 'patch' && url === '/api/v1/roles/LIBRARIAN')).toBe(true));
    const request = api.requests.find(({ method, url }) => method === 'patch' && url === '/api/v1/roles/LIBRARIAN');
    const body = typeof request?.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request?.body as Record<string, unknown>;
    expect(body).toEqual({ expectedVersion: 4, displayName: 'Thủ thư trưởng', description: 'Quản lý sách' });
    expect(body).not.toHaveProperty('code');
  });

  it('keeps metadata edits on a 409 version conflict and offers a list refresh', async () => {
    const user = userEvent.setup();
    configureRoleApi({
      metadataStatus: 409,
      metadataCode: 'ROLE_VERSION_CONFLICT',
      additionalRoles: [{
        code: 'LIBRARIAN', displayName: 'Thủ thư', description: 'Quản lý sách', enabled: true,
        version: 4, systemRole: false, accountCount: 2, permissionCount: 3,
        createdAt: '2026-10-15T10:00:00', canEdit: true,
      }],
    });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    const row = await screen.findByRole('row', { name: /LIBRARIAN Thủ thư/ });
    await user.click(within(row).getByRole('button', { name: 'Sửa thông tin' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText('Tên hiển thị'));
    await user.type(dialog.getByLabelText('Tên hiển thị'), 'Thủ thư trưởng');
    await user.click(dialog.getByRole('button', { name: 'Lưu thông tin' }));

    expect(await dialog.findByText(/Nhóm đã được thay đổi ở nơi khác/)).toBeTruthy();
    expect((dialog.getByLabelText('Tên hiển thị') as HTMLInputElement).value).toBe('Thủ thư trưởng');
    expect(dialog.getByRole('button', { name: 'Tải lại danh sách' })).toBeTruthy();
  });
});
