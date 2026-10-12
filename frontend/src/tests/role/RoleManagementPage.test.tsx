// @vitest-environment jsdom
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { AppNotificationProvider } from '../../components/AppNotificationProvider';
import { RoleManagementPage } from '../../role/RoleManagementPage';
import type { RolePermissions } from '../../role/types';

const mocks = vi.hoisted(() => ({
  refreshCapabilities: vi.fn(),
  currentUser: {
    id: 2,
    username: 'admin',
    email: 'admin@example.com',
    role: 'ROLE_ADMIN',
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
  visibleSuperAdmin?: boolean;
  userCanEdit?: boolean;
  deferPatch?: boolean;
  assignedPermissions?: string[];
  patchMessage?: string;
  unmanageableMemberRead?: boolean;
} = {}) {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  let detailReads = 0;
  let roleCodes: string[] = [];
  let resolvePendingPatch: ((result: RolePermissions) => void) | undefined;
  apiClient.defaults.adapter = (async (config) => {
    requests.push({ method: config.method ?? '', url: config.url ?? '', body: config.data });
    if (config.url === '/api/v1/roles') {
      const superAdmin = options.visibleSuperAdmin ?? mocks.currentUser.role === 'ROLE_SUPER_ADMIN';
      const roleList = [
        ...(superAdmin ? [{ code: 'ROLE_SUPER_ADMIN', description: 'Siêu quản trị viên', version: 1, canEdit: false }] : []),
        { code: 'ROLE_ADMIN', description: 'Quản trị viên', version: 3, canEdit: superAdmin },
        { code: 'ROLE_USER', description: 'Người dùng', version: options.version ?? 7, canEdit: options.userCanEdit ?? true },
      ];
      roleCodes = roleList.map(({ code }) => code);
      return response(config, success('ROLE_LIST_SUCCESS', roleList));
    }
    if (config.url === '/api/v1/permissions') {
      const superAdmin = mocks.currentUser.role === 'ROLE_SUPER_ADMIN';
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
        { code: 'member:update', description: 'Cập nhật thành viên', manageableByActor: superAdmin, dependencies: ['member:read'] },
        { code: 'member:delete', description: 'Xóa thành viên', manageableByActor: superAdmin, dependencies: ['member:read'] },
        { code: 'future:review', description: 'Xem nghiệp vụ mới', manageableByActor: false, dependencies: [] },
      ]));
    }
    if (config.url?.startsWith('/api/v1/roles/') && config.url.endsWith('/permissions') && config.method === 'get') {
      detailReads += 1;
      const targetRoleCode = config.url.split('/')[4] ?? 'ROLE_USER';
      const ownSuperAdmin = targetRoleCode === 'ROLE_SUPER_ADMIN';
      const assigned = ownSuperAdmin
        ? ['role:read', 'role:update', 'book:read', 'book:create', 'book:delete', 'book:import', 'member:read']
        : targetRoleCode === 'ROLE_ADMIN' ? ['role:read', 'role:update'] : options.assignedPermissions ?? ['book:read', 'book:delete'];
      return response(config, success('ROLE_PERMISSIONS_SUCCESS', {
        roleCode: targetRoleCode,
        version: targetRoleCode === 'ROLE_USER' ? options.version ?? 7 : 3,
        assignedPermissions: assigned,
        effectivePermissions: assigned,
        editablePermissions: ownSuperAdmin ? [] : targetRoleCode === 'ROLE_ADMIN'
          ? ['role:read', 'role:update']
          : options.userCanEdit === false ? [] : mocks.currentUser.role === 'ROLE_SUPER_ADMIN'
            ? ['book:read', 'book:create', 'book:update', 'book:import', 'member:read', 'member:create', 'member:update', 'member:delete']
            : ['book:read', 'book:create', 'book:update', 'book:import', 'member:read', 'member:create'],
        editable: !ownSuperAdmin && (targetRoleCode !== 'ROLE_ADMIN' || mocks.currentUser.role === 'ROLE_SUPER_ADMIN')
          && (targetRoleCode !== 'ROLE_USER' || options.userCanEdit !== false),
      }));
    }
    if (config.url === '/api/v1/roles/ROLE_USER/permissions' && config.method === 'patch') {
      if (options.patchStatus) failure(config, options.patchStatus, options.patchCode ?? 'PERMISSION_DENIED', options.patchMessage);
      if (options.deferPatch) {
        return await new Promise((resolve) => {
          resolvePendingPatch = (result) => resolve(response(config, success('ROLE_PERMISSIONS_UPDATED', result)));
        });
      }
      return response(config, success('ROLE_PERMISSIONS_UPDATED', {
        roleCode: 'ROLE_USER',
        version: (options.version ?? 7) + 1,
        assignedPermissions: options.assignedPermissions ?? ['book:read', 'book:delete'],
        effectivePermissions: options.assignedPermissions ?? ['book:read', 'book:delete'],
        editablePermissions: ['book:read', 'book:create', 'book:update', 'book:import', 'member:read', 'member:create'],
        editable: true,
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
    role: 'ROLE_ADMIN',
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

describe('RoleManagementPage', () => {
  it('adds permission dependencies when an operation is selected and previews the complete delta', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

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
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await user.click(await screen.findByRole('checkbox', { name: /Chọn tất cả quyền nhóm Thành viên/ }));

    expect((screen.getByRole('checkbox', { name: /member:read/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /member:create/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Quyền được thêm (2)' })).toBeTruthy();
  });

  it('does not select an operation when the actor cannot grant its missing dependency', async () => {
    const user = userEvent.setup();
    configureRoleApi({ unmanageableMemberRead: true });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await user.click(await screen.findByRole('checkbox', { name: /member:create/ }));

    expect((screen.getByRole('checkbox', { name: /member:create/ }) as HTMLInputElement).checked).toBe(false);
    expect(await screen.findByText(/không được phép cấp quyền đó/)).toBeTruthy();
  });

  it('keeps base permission when an operation is removed', async () => {
    const user = userEvent.setup();
    configureRoleApi({ assignedPermissions: ['book:read', 'book:delete', 'member:read', 'member:create'] });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

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
    render(<AppNotificationProvider><MemoryRouter><RoleManagementPage /></MemoryRouter></AppNotificationProvider>);

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
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Không thể thu hồi member:read khi còn member:create.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('selects only editable permissions in a group and preserves assigned locked rights', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

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
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

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
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(api.requests.filter(({ method }) => method === 'patch')).toHaveLength(0);
    expect((screen.getByRole('checkbox', { name: /book:create/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('1 thêm · 0 gỡ')).toBeTruthy();
  });

  it('lets an Admin view both permitted targets and keeps its own role read-only', async () => {
    const user = userEvent.setup();
    configureRoleApi();
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    await screen.findByRole('checkbox', { name: /book:read/ });
    const selector = await screen.findByRole('combobox', { name: 'Vai trò' });
    await user.click(selector);
    expect(screen.queryByRole('option', { name: 'Siêu quản trị viên' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Quản trị viên' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Người dùng' })).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Quản trị viên' }));

    const ownPermission = await screen.findByRole('checkbox', { name: /role:read/ });
    expect((ownPermission as HTMLInputElement).checked).toBe(true);
    expect((ownPermission as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Vai trò này chỉ được xem trong phiên quản trị hiện tại.')).toBeTruthy();
  });

  it('shows all three roles to SuperAdmin while keeping SuperAdmin permissions immutable', async () => {
    const user = userEvent.setup();
    Object.assign(mocks.currentUser, {
      id: 1,
      username: 'root',
      email: null,
      role: 'ROLE_SUPER_ADMIN',
      permissions: ['role:read', 'role:update'],
    });
    const api = configureRoleApi({ visibleSuperAdmin: true });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    const selector = await screen.findByRole('combobox', { name: 'Vai trò' });
    await waitFor(() => expect(api.roleCodes).toEqual(['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER']));
    await user.click(selector);
    const ownRole = screen.getByRole('option', { name: 'Siêu quản trị viên' });
    expect(ownRole).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Quản trị viên' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Người dùng' })).toBeTruthy();
    await user.click(ownRole);

    const immutablePermission = await screen.findByRole('checkbox', { name: /role:read/ });
    expect((immutablePermission as HTMLInputElement).checked).toBe(true);
    expect((immutablePermission as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Vai trò này chỉ được xem trong phiên quản trị hiện tại.')).toBeTruthy();

    await user.click(selector);
    await user.click(await screen.findByRole('option', { name: 'Quản trị viên' }));
    const removablePermission = await screen.findByRole('checkbox', { name: /role:read/ });
    expect((removablePermission as HTMLInputElement).disabled).toBe(false);
    await user.click(screen.getByRole('checkbox', { name: /role:update/ }));
    await user.click(removablePermission);
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    expect(await screen.findByText('Gỡ quyền quản lý vai trò có thể làm mất khả năng truy cập màn hình này.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
  });

  it('keeps USER read-only when an Admin has role:read but lacks role:update', async () => {
    Object.assign(mocks.currentUser, { permissions: ['role:read'] });
    configureRoleApi({ userCanEdit: false });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

    const assignment = await screen.findByRole('checkbox', { name: /book:create/ });
    expect((assignment as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }).hasAttribute('disabled')).toBe(true);
  });

  it('preserves pending edits after 409 until the user confirms a refresh', async () => {
    const user = userEvent.setup();
    const api = configureRoleApi({ patchStatus: 409, patchCode: 'ROLE_VERSION_CONFLICT' });
    render(<MemoryRouter><RoleManagementPage /></MemoryRouter>);

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
      username: 'root',
      email: null,
      role: 'ROLE_SUPER_ADMIN',
      permissions: ['role:read', 'role:update'],
    });
    const api = configureRoleApi({ deferPatch: true, visibleSuperAdmin: true });
    render(<AppNotificationProvider><MemoryRouter><RoleManagementPage /></MemoryRouter></AppNotificationProvider>);

    await user.click(await screen.findByRole('checkbox', { name: /book:create/ }));
    await user.click(screen.getByRole('button', { name: 'Xem thay đổi và lưu' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(api.requests.filter(({ method }) => method === 'patch')).toHaveLength(1));

    expect((document.getElementById('role-target-select') as HTMLInputElement).disabled).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

    api.resolvePendingPatch?.({
      roleCode: 'ROLE_USER',
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
});
