// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { Modal } from 'antd';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { MemberDetailPage } from '../../features/members/MemberDetailPage';
import type { LoanHistoryItem, MemberDetail, PageResponse } from '../../features/members/types';

const originalAdapter = apiClient.defaults.adapter;

const authState = vi.hoisted(() => ({
  permissions: ['member:read'] as string[],
  capabilityStatus: 'ready' as 'ready' | 'loading' | 'error',
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ permissions: authState.permissions, capabilityStatus: authState.capabilityStatus }),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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
  return { success: true, status: 200, code, message: 'Success.', data, timestamp: '2026-10-01T00:00:00Z' };
}

const member: MemberDetail = {
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

const historyItem: LoanHistoryItem = {
  loanItemId: 91,
  loanId: 42,
  loanCode: 'L202600042',
  loanStatus: 'PARTIALLY_RETURNED',
  bookId: 8,
  bookCode: 'B000008',
  bookTitle: 'Những ngày thơ ấu',
  bookAuthor: 'Nguyên Hồng',
  isbn: null,
  itemStatus: 'BORROWED',
  borrowedAt: '2026-10-01T08:30:00',
  dueDate: '2026-10-15',
  returnedAt: null,
  borrowFee: 1500.5,
  lateFeePerDay: 250,
  lateFee: 0,
  recordedTotalFee: 1500.5,
};

afterEach(() => {
  Modal.destroyAll();
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  authState.permissions = ['member:read'];
  authState.capabilityStatus = 'ready';
});

describe('MemberDetailPage', () => {
  it('shows read-only member details and one history row with separate item and loan states', async () => {
    const requests: Array<{ url?: string; params?: unknown }> = [];
    const page: PageResponse<LoanHistoryItem> = {
      content: [historyItem], page: 0, size: 10, totalElements: 1, totalPages: 1, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      requests.push({ url: config.url, params: config.params });
      if (config.url === '/api/v1/members/17') return response(config, success('MEMBER_DETAIL_SUCCESS', member));
      if (config.url === '/api/v1/members/17/loan-history') return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', page));
      throw new Error(`Unexpected request ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);

    expect(await screen.findByText('M000017')).toBeTruthy();
    expect(await screen.findByText('Những ngày thơ ấu')).toBeTruthy();
    expect(screen.getAllByText('Đang mượn')).toHaveLength(2);
    expect(screen.getByText('Phiếu trả một phần')).toBeTruthy();
    expect(screen.getAllByText(/1\.500,5/)).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Quay lại danh sách' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /lưu|sửa|khóa|xóa/i })).toBeNull();
    expect(requests.find((request) => request.url?.endsWith('/loan-history'))?.params).toMatchObject({
      status: 'ALL', page: 0, size: 10,
    });
  });

  it('paginates LoanItem history independently and resets it when status changes', async () => {
    const historyRequests: Array<Record<string, unknown>> = [];
    const page: PageResponse<LoanHistoryItem> = {
      content: [historyItem], page: 0, size: 10, totalElements: 25, totalPages: 3, first: true, last: false,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17') return response(config, success('MEMBER_DETAIL_SUCCESS', member));
      if (config.url === '/api/v1/members/17/loan-history') {
        historyRequests.push(config.params as Record<string, unknown>);
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', page));
      }
      throw new Error(`Unexpected request ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText('Những ngày thơ ấu')).toBeTruthy();

    fireEvent.click(screen.getByTitle('2'));
    await vi.waitFor(() => expect(historyRequests).toHaveLength(2));
    expect(historyRequests[1]).toMatchObject({ status: 'ALL', page: 1, size: 10 });

    fireEvent.change(screen.getByLabelText('Lọc trạng thái sách'), { target: { value: 'RETURNED' } });
    await vi.waitFor(() => expect(historyRequests).toHaveLength(3));
    expect(historyRequests[2]).toMatchObject({ status: 'RETURNED', page: 0, size: 10 });
  });

  it('shows the profile modal only with member:update and PATCHes only changed fields', async () => {
    authState.permissions = ['member:read', 'member:update'];
    const patchBodies: unknown[] = [];
    const memberWithAddress = { ...member, address: 'Quận 1, Thành phố Hồ Chí Minh' };
    let detailReads = 0;
    const updatedMember = { ...memberWithAddress, fullName: 'Nguyễn Bình', version: 1 };
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        detailReads += 1;
        return response(config, success('MEMBER_DETAIL_SUCCESS', detailReads === 1 ? memberWithAddress : updatedMember));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'patch') {
        patchBodies.push(JSON.parse(String(config.data)));
        return response(config, success('MEMBER_PROFILE_UPDATED', updatedMember));
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText('M000017')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    expect(await screen.findByRole('dialog', { name: 'Chỉnh sửa hồ sơ thành viên' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Bình' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(patchBodies).toEqual([{ version: 0, fullName: 'Nguyễn Bình' }]));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa hồ sơ thành viên' })).toBeNull());
    await waitFor(() => expect(detailReads).toBe(2));
    expect(await screen.findByText('Nguyễn Bình')).toBeTruthy();
  });

  it('PATCHes null when each populated profile field is cleared', async () => {
    authState.permissions = ['member:read', 'member:update'];
    const populatedMember = { ...member, address: 'Quận 1, Thành phố Hồ Chí Minh' };
    const clearedMember = {
      ...populatedMember,
      fullName: null,
      dateOfBirth: null,
      phone: null,
      address: null,
      version: 1,
    };
    const patchBodies: unknown[] = [];
    let detailReads = 0;
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        detailReads += 1;
        return response(config, success('MEMBER_DETAIL_SUCCESS', detailReads === 1 ? populatedMember : clearedMember));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'patch') {
        patchBodies.push(JSON.parse(String(config.data)));
        return response(config, success('MEMBER_PROFILE_UPDATED', clearedMember));
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    await screen.findByText('M000017');
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));

    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: '' } });
    const datePicker = screen.getByLabelText('Ngày sinh').closest('.ant-picker');
    const clearDate = datePicker?.querySelector('.ant-picker-clear');
    expect(clearDate).toBeTruthy();
    fireEvent.mouseDown(clearDate!);
    fireEvent.click(clearDate!);
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(patchBodies).toEqual([{
      version: 0,
      fullName: null,
      dateOfBirth: null,
      phone: null,
      address: null,
    }]));
  });

  it('confirms status changes on the detail page and warns with the borrowed item count', async () => {
    authState.permissions = ['member:read', 'member:status:update'];
    let detailReads = 0;
    let statusBody: unknown;
    let latestMember = member;
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        detailReads += 1;
        return response(config, success('MEMBER_DETAIL_SUCCESS', latestMember));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17/account-status' && config.method === 'patch') {
        statusBody = JSON.parse(String(config.data));
        latestMember = { ...member, enabled: false };
        return response(config, success('MEMBER_ACCOUNT_STATUS_UPDATED', latestMember));
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText('M000017')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa tài khoản' }));
    expect(await screen.findByRole('dialog', { name: 'Xác nhận vô hiệu hóa tài khoản' })).toBeTruthy();
    expect(screen.getByText('Đang mượn 1 cuốn sách chưa trả')).toBeTruthy();
    expect(screen.getByText(/M000017.*không thể đăng nhập/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa' }));

    await waitFor(() => expect(statusBody).toEqual({ expectedEnabled: true, enabled: false }));
    await waitFor(() => expect(detailReads).toBe(2));
    expect(await screen.findByRole('button', { name: 'Kích hoạt tài khoản' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes a conflicted status confirmation and reloads member details without retrying', async () => {
    authState.permissions = ['member:read', 'member:status:update'];
    let detailReads = 0;
    let statusAttempts = 0;
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        detailReads += 1;
        return response(config, success('MEMBER_DETAIL_SUCCESS', detailReads === 1 ? member : { ...member, enabled: false }));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17/account-status' && config.method === 'patch') {
        statusAttempts += 1;
        const conflict: ApiEnvelope<null> = {
          success: false,
          status: 409,
          code: 'MEMBER_ACCOUNT_STATUS_CONFLICT',
          message: 'Status changed.',
          data: null,
          timestamp: '2026-10-01T00:00:00Z',
        };
        throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
          data: conflict,
          status: 409,
          statusText: 'Conflict',
          headers: new AxiosHeaders(),
          config,
        });
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    await screen.findByText('M000017');
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa tài khoản' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vô hiệu hóa' }));

    expect(await screen.findByText('Trạng thái tài khoản đã thay đổi. Hồ sơ đã được tải lại.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Kích hoạt tài khoản' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(statusAttempts).toBe(1);
    expect(detailReads).toBe(2);
  });

  it('keeps stale edits intact until a confirmed reload fetches the new version', async () => {
    authState.permissions = ['member:read', 'member:update'];
    let patchCount = 0;
    let latestMember = member;
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        return response(config, success('MEMBER_DETAIL_SUCCESS', latestMember));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'patch') {
        patchCount += 1;
        latestMember = { ...member, fullName: 'Concurrent edit', version: 1 };
        const envelope: ApiEnvelope<null> = {
          success: false,
          status: 409,
          code: 'MEMBER_VERSION_CONFLICT',
          message: 'Thông tin thành viên đã được thay đổi bởi quản trị viên khác',
          data: null,
          timestamp: '2026-10-01T00:00:00Z',
        };
        throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
          data: envelope,
          status: 409,
          statusText: 'Conflict',
          headers: new AxiosHeaders(),
          config,
        });
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes><Route path="/admin/members/:id" element={<MemberDetailPage />} /></Routes>
    </MemoryRouter>);
    await screen.findByText('M000017');
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const fullName = await screen.findByLabelText('Họ và tên');
    fireEvent.change(fullName, { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(patchCount).toBe(1));
    expect(await screen.findByText('Thông tin thành viên đã được thay đổi bởi quản trị viên khác')).toBeTruthy();
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Unsaved draft');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    expect(await screen.findByText('Tải dữ liệu mới sẽ bỏ các chỉnh sửa chưa lưu trong biểu mẫu.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tải lại và bỏ thay đổi' }));
    await waitFor(() => expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value)
      .toBe('Concurrent edit'));
    expect(screen.queryByText('Thông tin thành viên đã được thay đổi bởi quản trị viên khác')).toBeNull();
    expect(patchCount).toBe(1);
  });

  it('shows Delete Member only with permission and keeps the record after a loan-history conflict', async () => {
    authState.permissions = ['member:read', 'member:delete'];
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    let deleteRequest: { method?: string; url?: string } | null = null;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        return response(config, success('MEMBER_DETAIL_SUCCESS', member));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'delete') {
        deleteRequest = { method: config.method, url: config.url };
        const conflict: ApiEnvelope<null> = {
          success: false,
          status: 409,
          code: 'MEMBER_HAS_LOAN_HISTORY',
          message: 'Member has loan history.',
          data: null,
          timestamp: '2026-10-01T00:00:00Z',
        };
        throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
          data: conflict,
          status: 409,
          statusText: 'Conflict',
          headers: new AxiosHeaders(),
          config,
        });
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes>
        <Route path="/admin/members/:id" element={<MemberDetailPage />} />
        <Route path="/admin/members" element={<div>Danh sách thành viên</div>} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByText('M000017')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa thành viên' }));
    expect(await screen.findByText('Xác nhận xóa thành viên')).toBeTruthy();
    expect(screen.getByText(/không thể khôi phục/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Xóa$/ }));

    expect(await screen.findByText(/không thể xóa thành viên có lịch sử mượn/i)).toBeTruthy();
    expect(screen.getByText('M000017')).toBeTruthy();
    expect(deleteRequest).toEqual({ method: 'delete', url: '/api/v1/members/17' });
    expect(screen.queryByText('Danh sách thành viên')).toBeNull();
  });

  it('deletes a member only after confirmation and returns to the list', async () => {
    authState.permissions = ['member:read', 'member:delete'];
    const emptyPage: PageResponse<LoanHistoryItem> = {
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true,
    };
    let deleteCount = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/members/17' && config.method === 'get') {
        return response(config, success('MEMBER_DETAIL_SUCCESS', member));
      }
      if (config.url === '/api/v1/members/17/loan-history') {
        return response(config, success('MEMBER_LOAN_HISTORY_SUCCESS', emptyPage));
      }
      if (config.url === '/api/v1/members/17' && config.method === 'delete') {
        deleteCount += 1;
        return { ...response(config, null), status: 204 };
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/admin/members/17']}>
      <Routes>
        <Route path="/admin/members/:id" element={<MemberDetailPage />} />
        <Route path="/admin/members" element={<div>Danh sách thành viên</div>} />
      </Routes>
    </MemoryRouter>);
    await screen.findByText('M000017');
    expect(deleteCount).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa thành viên' }));
    expect(await screen.findByText(/không thể khôi phục/i)).toBeTruthy();
    expect(deleteCount).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /^Xóa$/ }));

    expect(await screen.findByText('Danh sách thành viên')).toBeTruthy();
    expect(deleteCount).toBe(1);
  });
});
