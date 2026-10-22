// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../../app/App';
import { apiClient } from '../../auth/api';
import { AppNotificationProvider } from '../../components/AppNotificationProvider';
import type { ApiEnvelope } from '../../auth/types';
import type { BorrowItem, BorrowRequestSummary, LoanItemStatus, StaffBorrowRequest } from '../../features/borrow/types';

const auth = vi.hoisted(() => ({
  accessToken: 'borrow-session' as string | null,
  isBootstrapping: false,
  currentUser: { id: 41, username: 'member41', email: 'member41@example.test', role: 'USER', permissions: ['book:read', 'borrow:create', 'borrow:read-own', 'borrow:cancel-own', 'borrow:renew'] },
  role: 'USER',
  permissions: ['book:read', 'borrow:create', 'borrow:read-own', 'borrow:cancel-own', 'borrow:renew'] as string[],
  capabilityStatus: 'ready',
  refreshCapabilities: vi.fn(async () => undefined),
  login: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => auth,
  useOptionalAuth: () => auth,
}));

const originalAdapter = apiClient.defaults.adapter;

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (media: string) => ({ matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
  });
  const getComputedStyle = window.getComputedStyle.bind(window);
  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: (element: Element) => getComputedStyle(element),
  });
});

function response<T>(config: Parameters<AxiosAdapter>[0], data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function success<T>(code: string, data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code, message: 'Success.', data, timestamp: new Date().toISOString() };
}

function failure(config: Parameters<AxiosAdapter>[0], status: number, code: string): AxiosError<ApiEnvelope<unknown>> {
  const body: ApiEnvelope<unknown> = {
    success: false, status, code, message: 'Không thể hoàn tất yêu cầu.', data: null, timestamp: new Date().toISOString(),
  };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, status));
}

function page<T>(content: T[], options: { page?: number; size?: number; totalElements?: number } = {}) {
  const pageNumber = options.page ?? 0;
  const size = options.size ?? 10;
  const totalElements = options.totalElements ?? content.length;
  const totalPages = Math.ceil(totalElements / size);
  return { content, page: pageNumber, size, totalElements, totalPages, first: pageNumber === 0, last: pageNumber >= totalPages - 1 };
}

function catalogBook(id: number, title = 'Lập trình Java') {
  return {
    id, bookCode: `B${String(id).padStart(6, '0')}`, isbn: '9786041234567', title, author: 'Nguyễn An',
    publisher: 'Nhà xuất bản Trẻ', publishedDate: '2024-03-10', totalQuantity: 3, availableQuantity: 1,
    borrowFee: 0, lateFeePerDay: 2000, coverImageUrl: null, waitlistCount: 0, waitlistCap: 6,
  };
}

function item(id: number, status: LoanItemStatus, title: string): BorrowItem {
  return {
    id, bookId: id + 100, bookCode: `B${id}`, title, author: 'Nguyễn An', coverImageUrl: null, status,
    borrowFee: id === 2 ? 0 : 15000, lateFeePerDay: 2000, paidBorrowFee: 0, lateFee: 0,
    borrowedAt: null, dueDate: null, readyAt: status === 'READY_FOR_PICKUP' ? '2026-10-19T03:00:00Z' : null,
    pickupExpiresAt: status === 'READY_FOR_PICKUP' ? '2026-10-22T03:00:00Z' : null,
    renewalCount: 0, version: 4, waitlistPosition: status === 'WAITLISTED' ? 2 : null,
    waitlistTotal: status === 'WAITLISTED' ? 5 : null,
  };
}

function ownRequest(): BorrowRequestSummary {
  return {
    loanCode: 'LN-2026-000041', pickupReference: 'QR-SECRET-REFERENCE', aggregateStatus: 'OPEN',
    createdAt: '2026-10-19T03:00:00Z', version: 8, itemCount: 2, statuses: ['WAITLISTED', 'READY_FOR_PICKUP'],
    items: [item(1, 'WAITLISTED', 'Clean Architecture'), item(2, 'READY_FOR_PICKUP', 'Nhập môn Java')],
  };
}

function staffRequest(): StaffBorrowRequest {
  const request = ownRequest();
  return {
    loanCode: request.loanCode, pickupReference: request.pickupReference, status: 'OPEN',
    createdAt: request.createdAt, version: request.version,
    member: { id: 41, memberCode: 'MB000041', fullName: 'Nguyễn An' },
    items: [item(1, 'READY_FOR_PICKUP', 'Clean Architecture'), item(2, 'READY_FOR_PICKUP', 'Nhập môn Java'), item(3, 'WAITLISTED', 'Sách xếp hàng')],
    preparingOverdueItemIds: [],
  };
}

function staffCountResponse(config: Parameters<AxiosAdapter>[0], counts: Record<string, number> = {}) {
  if (config.url !== '/api/v1/librarian/borrow-requests') return null;
  const query = config.params as Record<string, unknown>;
  if (Number(query.size) !== 1) return null;
  const count = counts[String(query.status)] ?? 0;
  return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([], { page: 0, size: 1, totalElements: count })));
}

function resetAuth() {
  Object.assign(auth, {
    accessToken: 'borrow-session', isBootstrapping: false,
    currentUser: { id: 41, username: 'member41', email: 'member41@example.test', role: 'USER', permissions: ['book:read', 'borrow:create', 'borrow:read-own', 'borrow:cancel-own', 'borrow:renew'] },
    role: 'USER', permissions: ['book:read', 'borrow:create', 'borrow:read-own', 'borrow:cancel-own', 'borrow:renew'],
    capabilityStatus: 'ready',
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function LocationSearchProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  resetAuth();
});

describe('Borrow Book routes and pages', () => {
  it('allows a custom staff role to open the desk by permission', async () => {
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });
    apiClient.defaults.adapter = (async (config) => response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([staffRequest()])))) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Xử lý yêu cầu mượn tại quầy' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xử lý mượn sách' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thu phí và bàn giao' })).toBeNull();
  });

  it('denies USER access to the staff route before making a staff API request', async () => {
    let staffReads = 0;
    apiClient.defaults.adapter = (async (config) => {
      staffReads += 1;
      throw new Error(`Staff API should not run: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Xử lý mượn sách' })).toBeNull();
    expect(staffReads).toBe(0);
  });

  it('keeps the member catalog route and sidebar item out of admin navigation', async () => {
    Object.assign(auth, {
      role: 'ADMIN',
      currentUser: { id: 1, username: 'admin', email: 'admin@example.test', role: 'ADMIN', permissions: ['book:read', 'role:read'] },
      permissions: ['book:read', 'role:read'],
    });
    let catalogReads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') catalogReads += 1;
      throw new Error(`Catalog API should not run: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Danh mục sách' })).toBeNull();
    expect(catalogReads).toBe(0);
  });

  it('denies admins direct access to member catalog details', async () => {
    Object.assign(auth, {
      role: 'ADMIN',
      currentUser: { id: 1, username: 'admin', email: 'admin@example.test', role: 'ADMIN', permissions: ['book:read', 'role:read'] },
      permissions: ['book:read', 'role:read'],
    });
    let catalogReads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url?.startsWith('/api/v1/catalog/books')) catalogReads += 1;
      throw new Error(`Catalog API should not run: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books/5']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Không thể truy cập trang này' })).toBeTruthy();
    expect(catalogReads).toBe(0);
  });

  it('routes an unauthenticated session to login', async () => {
    auth.accessToken = null;
    render(<MemoryRouter initialEntries={['/my-loans']}><App /><LocationProbe /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/login'));
  });

  it('loads the public catalog from the catalog API and reports forbidden responses safely', async () => {
    const requested: string[] = [];
    let query: Record<string, unknown> | undefined;
    apiClient.defaults.adapter = (async (config) => {
      requested.push(config.url ?? '');
      query = config.params as Record<string, unknown>;
      if (requested.length === 1) return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page([catalogBook(5)])));
      throw failure(config, 403, 'PERMISSION_DENIED');
    }) satisfies AxiosAdapter;

    const view = render(<MemoryRouter initialEntries={['/books']}><App /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Lập trình Java' })).toBeTruthy();
    expect(await screen.findByText('Sắp hết · còn 1')).toBeTruthy();
    expect(requested[0]).toBe('/api/v1/catalog/books');
    expect(query).toMatchObject({ page: 0, size: 10, sort: 'title,asc' });

    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(requested).toHaveLength(2));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(await screen.findByText('Tài khoản hiện không có quyền xem hoặc thực hiện thao tác này.')).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/SQL|stack trace|Exception/i);
  });

  it('renders responsive catalog cards with stock states and clear selection controls', async () => {
    const books = [
      { ...catalogBook(5, 'Sách còn nhiều'), availableQuantity: 3, totalQuantity: 4, borrowFee: 12000, lateFeePerDay: 2500 },
      { ...catalogBook(6, 'Sách sắp hết'), availableQuantity: 1, totalQuantity: 4 },
      { ...catalogBook(7, 'Sách đang có hàng chờ'), availableQuantity: 0, waitlistCount: 2, waitlistCap: 6 },
      { ...catalogBook(8, 'Sách còn bản khác'), availableQuantity: 2, totalQuantity: 3 },
      { ...catalogBook(9, 'Sách hết hàng chờ'), availableQuantity: 0, waitlistCount: 6, waitlistCap: 6 },
    ];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page(books)));
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><App /></MemoryRouter>);

    expect(await screen.findByText('Còn 3/4')).toBeTruthy();
    expect(screen.getByText('Sắp hết · còn 1')).toBeTruthy();
    expect(document.querySelectorAll('.catalog-stock-tag--unavailable')).toHaveLength(2);
    expect(screen.getByText('12.000 ₫')).toBeTruthy();
    expect(within(document.querySelector('[data-catalog-book="5"]') as HTMLElement).getByText('/lượt')).toBeTruthy();
    expect(screen.getByText('B000005')).toBeTruthy();
    expect(screen.getByText('Trễ 2.500 ₫/ngày')).toBeTruthy();
    expect(screen.getByText('Hàng chờ: 2 / 6')).toBeTruthy();
    expect(document.querySelector('[data-catalog-book="7"] .catalog-card__cover-placeholder')?.textContent).toBe('Sách đang có hàng chờ');

    const selectableQueueBook = screen.getByRole('button', { name: 'Vào hàng chờ Sách đang có hàng chờ' });
    expect((selectableQueueBook as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Hết sách Sách hết hàng chờ' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Chọn mượn Sách còn nhiều' }));
    const selectedCard = document.querySelector('[data-catalog-book="5"]');
    expect(selectedCard?.classList.contains('catalog-card--selected')).toBe(true);
    expect(selectedCard?.querySelector('.catalog-card__selected-mark')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Đã chọn ✓ Sách còn nhiều' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Đã chọn ✓ Sách còn nhiều' }));
    expect(selectedCard?.classList.contains('catalog-card--selected')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn mượn Sách còn nhiều' }));

    fireEvent.click(screen.getByRole('button', { name: 'Chọn mượn Sách sắp hết' }));
    fireEvent.click(selectableQueueBook);
    expect((screen.getByRole('button', { name: 'Đã đủ 3 sách Sách còn bản khác' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the bottom cart and drawer synchronized when selected books change', async () => {
    const books = [
      { ...catalogBook(5, 'Sách phí 12 nghìn'), borrowFee: 12000 },
      { ...catalogBook(6, 'Sách phí 20 nghìn'), borrowFee: 20000 },
    ];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page(books)));
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);

    expect(screen.queryByRole('button', { name: 'Xem giỏ' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn mượn Sách phí 12 nghìn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn mượn Sách phí 20 nghìn' }));
    expect(screen.getByText('2/3 sách đã chọn')).toBeTruthy();
    expect(screen.getByText('Tổng phí 32.000 ₫')).toBeTruthy();
    const bottomBar = screen.getByRole('region', { name: 'Tóm tắt giỏ đặt mượn' });
    expect(within(bottomBar).getAllByRole('button')).toHaveLength(1);
    expect(within(bottomBar).getByRole('button', { name: 'Xem giỏ' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByRole('heading', { name: 'Giỏ đặt mượn' })).toBeTruthy();
    expect(within(drawer).getByText('Các sách sẽ được gộp vào một yêu cầu và một mã QR.')).toBeTruthy();
    expect(within(drawer).getByText('Tổng phí mượn')).toBeTruthy();
    expect(within(drawer).getByText('32.000 ₫')).toBeTruthy();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Đóng giỏ đặt mượn' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('2/3 sách đã chọn')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    await screen.findByRole('dialog');
    const drawerMask = document.querySelector('.borrow-cart-drawer .ant-drawer-mask');
    expect(drawerMask).toBeTruthy();
    fireEvent.click(drawerMask as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('2/3 sách đã chọn')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    const drawerAfterMask = await screen.findByRole('dialog');
    expect(within(drawerAfterMask).getByText('32.000 ₫')).toBeTruthy();
    fireEvent.click(within(drawerAfterMask).getByRole('button', { name: 'Bỏ Sách phí 12 nghìn khỏi giỏ' }));
    expect(screen.getByText('1/3 sách đã chọn')).toBeTruthy();
    expect(screen.getByText('Tổng phí 20.000 ₫')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('1/3 sách đã chọn')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    const reopenedDrawer = await screen.findByRole('dialog');
    fireEvent.click(within(reopenedDrawer).getByRole('button', { name: 'Bỏ Sách phí 20 nghìn khỏi giỏ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Xem giỏ' })).toBeNull();
  });

  it('shows a safe session message when the catalog API rejects an expired token', async () => {
    apiClient.defaults.adapter = (async (config) => { throw failure(config, 401, 'AUTH_TOKEN_INVALID'); }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><App /></MemoryRouter>);

    expect(await screen.findByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')).toBeTruthy();
  });

  it('shows a loading state while the catalog request is still in flight', async () => {
    let resolveCatalog: (() => void) | undefined;
    apiClient.defaults.adapter = (async (config) => new Promise((resolve) => {
      resolveCatalog = () => resolve(response(config, success('BOOK_CATALOG_LIST_SUCCESS', page([catalogBook(8)]))));
    })) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><App /></MemoryRouter>);
    expect(screen.getByRole('status')).toBeTruthy();
    await waitFor(() => expect(resolveCatalog).toBeDefined());
    await act(async () => { resolveCatalog?.(); await Promise.resolve(); });
    expect(await screen.findByRole('link', { name: 'Lập trình Java' })).toBeTruthy();
  });

  it('shows single-book request feedback in the shared top-right notification', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books/5') return response(config, success('BOOK_CATALOG_DETAIL_SUCCESS', catalogBook(5)));
      if (config.method === 'post' && config.url === '/api/v1/borrow-requests') {
        return response(config, success('BORROW_REQUEST_CREATED', ownRequest()));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books/5']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Đặt mượn' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đặt mượn' }));

    const notice = await screen.findByText('Trạng thái được xác nhận từ máy chủ.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-inline-alert')).toBeNull();
  });

  it('explains an expired pickup session when the server rejects an old READY action', async () => {
    const request = ownRequest();
    request.items[1] = { ...request.items[1], pickupExpiresAt: '2025-01-01T00:00:00Z' };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/borrow-requests/mine') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([request])));
      if (config.method === 'post' && config.url?.endsWith('/items/2/cancel')) throw failure(config, 409, 'BORROW_PICKUP_EXPIRED');
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/my-loans']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    const readyItem = (await screen.findByText('Nhập môn Java')).closest('[data-loan-item]') as HTMLElement;
    expect(within(readyItem).getByRole('timer').textContent).toContain('Đã hết 72 giờ');
    fireEvent.click(within(readyItem).getByRole('button', { name: 'Hủy sách này' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hủy' }));

    expect(await screen.findByText('Thời hạn nhận sách đã hết. Hãy tải lại để xem trạng thái mới.')).toBeTruthy();
  });

  it('closes a stale member confirmation and shows refreshed item state after a 409', async () => {
    let reads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/borrow-requests/mine') {
        reads += 1;
        const request = ownRequest();
        if (reads > 1) {
          request.items[1] = { ...request.items[1], status: 'CANCELLED', pickupExpiresAt: null };
          request.statuses = ['WAITLISTED', 'CANCELLED'];
        }
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([request])));
      }
      if (config.method === 'post' && config.url?.endsWith('/items/2/cancel')) throw failure(config, 409, 'BORROW_VERSION_CONFLICT');
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/my-loans']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    const readyItem = (await screen.findByText('Nhập môn Java')).closest('[data-loan-item]') as HTMLElement;
    fireEvent.click(within(readyItem).getByRole('button', { name: 'Hủy sách này' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hủy' }));

    const notice = await screen.findByText('Yêu cầu đã thay đổi ở nơi khác. Danh sách đã được tải lại; hãy kiểm tra trạng thái mới.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.ant-notification-topRight')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
    const refreshedItem = (await screen.findByText('Nhập môn Java')).closest('[data-loan-item]') as HTMLElement;
    expect(within(refreshedItem).getByText('Đã hủy')).toBeTruthy();
    expect(within(refreshedItem).queryByRole('button', { name: 'Hủy sách này' })).toBeNull();
  });

  it('filters a mixed request by individual item and lets the member cancel a READY item online', async () => {
    const posted: string[] = [];
    const listQueries: Array<Record<string, unknown>> = [];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/borrow-requests/mine') {
        listQueries.push(config.params as Record<string, unknown>);
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([ownRequest()])));
      }
      if (config.method === 'post') {
        posted.push(config.url ?? '');
        return response(config, success('BORROW_ITEM_CANCELLED', ownRequest()));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/my-loans']}><App /></MemoryRouter>);
    expect(await screen.findByText('Clean Architecture')).toBeTruthy();
    expect(screen.getByText('Nhập môn Java')).toBeTruthy();
    expect(screen.getByText(/2 trong 5/)).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Mã QR nhận sách cho LN-2026-000041' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Sẵn sàng nhận' }));
    await waitFor(() => expect(listQueries.at(-1)).toMatchObject({ page: 0, size: 10, status: 'READY_FOR_PICKUP' }));
    expect(screen.queryByText('Clean Architecture')).toBeNull();
    const readyBook = screen.getByText('Nhập môn Java').closest('[data-loan-item]');
    expect(readyBook).toBeTruthy();
    expect(within(readyBook as HTMLElement).getByRole('timer').textContent).toMatch(/^(Còn|Đã hết)/);
    fireEvent.click(within(readyBook as HTMLElement).getByRole('button', { name: 'Hủy sách này' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hủy' }));

    await waitFor(() => expect(posted).toContain('/api/v1/borrow-requests/mine/LN-2026-000041/items/2/cancel'));
    expect(posted).toHaveLength(1);
  });

  it('filters loans on the server before pagination and resets to the first page when a tab changes', async () => {
    const queries: Array<Record<string, unknown>> = [];
    const pageOne = Array.from({ length: 10 }, (_, index) => {
      const request = ownRequest();
      request.loanCode = `LN-2026-${String(index + 1).padStart(6, '0')}`;
      request.items = [item(index + 1, 'RESERVED', `Yêu cầu ${index + 1}`)];
      return request;
    });
    const borrowedRequest = ownRequest();
    borrowedRequest.loanCode = 'LN-2026-000099';
    borrowedRequest.items = [item(99, 'BORROWED', 'Sách đang mượn ở trang sau')];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/borrow-requests/mine') {
        const query = config.params as Record<string, unknown>;
        queries.push(query);
        if (query.status === 'BORROWED') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([borrowedRequest])));
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page(pageOne, { totalElements: 11 })));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/my-loans']}><App /></MemoryRouter>);
    expect(await screen.findByText('Yêu cầu 1')).toBeTruthy();
    const secondPage = document.querySelector('.ant-pagination-item-2 a');
    expect(secondPage).toBeTruthy();
    fireEvent.click(secondPage as HTMLElement);
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: 1, size: 10, status: 'ALL' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Đang mượn' }));
    expect(await screen.findByText('Sách đang mượn ở trang sau')).toBeTruthy();
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: 0, size: 10, status: 'BORROWED' }));
    expect(screen.queryByText('Chưa có sách ở trạng thái này')).toBeNull();
  });

  it('submits a request once and does not claim success when the network times out', async () => {
    let postCount = 0;
    let failPost: (() => void) | undefined;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page([catalogBook(5)])));
      if (config.method === 'post') {
        postCount += 1;
        return new Promise<AxiosResponse<ApiEnvelope<unknown>>>((_resolve, reject) => {
          failPost = () => reject(new AxiosError('timeout', AxiosError.ECONNABORTED, config));
        });
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn mượn Lập trình Java' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đặt mượn' }));
    const confirm = await screen.findByRole('button', { name: 'Xác nhận đặt mượn' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(postCount).toBe(1));
    await act(async () => { failPost?.(); await Promise.resolve(); });

    const notice = await screen.findByText('Chưa xác nhận được kết quả. Hãy tải danh sách yêu cầu trước khi gửi lại để tránh tạo trùng.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
    expect(postCount).toBe(1);
    expect(screen.queryByText('Đã tạo yêu cầu mượn thành công.')).toBeNull();
  });

  it('explains the global three-book limit when the reservation service rejects a new request', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page([catalogBook(5)])));
      if (config.method === 'post') throw failure(config, 409, 'BORROW_ACTIVE_LIMIT_EXCEEDED');
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn mượn Lập trình Java' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đặt mượn' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đặt mượn' }));

    const notice = await screen.findByText('Mỗi thành viên chỉ được có tối đa 3 đầu sách đang hoạt động.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
  });

  it('creates one Loan for three distinct catalog books and prevents selecting a fourth', async () => {
    let submittedIds: number[] | null = null;
    const books = [catalogBook(5, 'Sách một'), catalogBook(6, 'Sách hai'), catalogBook(7, 'Sách ba'), catalogBook(8, 'Sách bốn')];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books') return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page(books)));
      if (config.method === 'post' && config.url === '/api/v1/borrow-requests') {
        submittedIds = (JSON.parse(String(config.data)) as { bookIds: number[] }).bookIds;
        return response(config, success('BORROW_REQUEST_CREATED', ownRequest()));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/books']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    for (const title of ['Sách một', 'Sách hai', 'Sách ba']) {
      fireEvent.click(await screen.findByRole('button', { name: `Chọn mượn ${title}` }));
    }
    expect((screen.getByRole('button', { name: 'Đã đủ 3 sách Sách bốn' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('3/3 sách đã chọn')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem giỏ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đặt mượn' }));
    expect(document.querySelector('.ant-modal-wrap.ant-modal-centered')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đặt mượn' }));

    await waitFor(() => expect(submittedIds).toEqual([5, 6, 7]));
    expect(new Set(submittedIds).size).toBe(3);
    const notice = await screen.findByText('Trạng thái được xác nhận từ máy chủ.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
  });

  it('loads staff requests in server pages of ten and keeps actionable requests easy to identify', async () => {
    const queries: Array<Record<string, unknown>> = [];
    const requestAt = (number: number) => {
      const request = staffRequest();
      request.loanCode = `LN-2026-${String(number).padStart(6, '0')}`;
      request.member = { ...request.member, fullName: `Thành viên ${number}` };
      request.items = [item(number, 'PREPARING', `Sách ${number}`)];
      return request;
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        const query = config.params as Record<string, unknown>;
        const countResponse = staffCountResponse(config, { ALL: 11, PENDING: 11 });
        if (countResponse) return countResponse;
        queries.push(query);
        const number = Number(query.page) === 0 ? 10 : 1;
        const start = Number(query.page) === 0 ? 11 : 1;
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page(Array.from({ length: number }, (_, index) => requestAt(start + index)), { page: Number(query.page), totalElements: 11 })));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Thành viên 11')).toBeTruthy();
    await waitFor(() => expect(queries[0]).toMatchObject({ page: 0, size: 10, status: 'ALL', sort: 'createdAt,desc' }));
    fireEvent.click(document.querySelector('.ant-pagination-item-2 a') as HTMLElement);

    expect(await within(await screen.findByRole('table')).findByText('Thành viên 1')).toBeTruthy();
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: 1, size: 10, status: 'ALL' }));
    expect(within(screen.getByRole('table')).queryByText('Thành viên 11')).toBeNull();
  });

  it('lets staff reject a missing physical copy and refreshes the server state', async () => {
    let rejectCalls = 0;
    let listReads = 0;
    const currentRequest = (rejected: boolean) => {
      const request = staffRequest();
      request.items[0] = item(1, rejected ? 'REJECTED' : 'PREPARING', 'Clean Architecture');
      return request;
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        const countResponse = staffCountResponse(config, { ALL: 1, PENDING: 1 });
        if (countResponse) return countResponse;
        listReads += 1;
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([currentRequest(rejectCalls > 0)])));
      }
      if (config.method === 'post' && config.url?.endsWith('/items/1/reject')) {
        rejectCalls += 1;
        return response(config, success('BORROW_ITEM_REJECTED', currentRequest(true)));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read', 'borrow:prepare'] },
      permissions: ['borrow:read', 'borrow:prepare'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: `Xử lý yêu cầu ${staffRequest().loanCode}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận không tìm thấy sách' }));
    const rejectConfirmation = await screen.findByText(/không làm tăng số bản sẵn có/);
    const rejectDialog = rejectConfirmation.closest('.ant-modal') as HTMLElement;
    expect(rejectDialog).toBeTruthy();
    fireEvent.click(within(rejectDialog).getByRole('button', { name: 'Xác nhận không tìm thấy sách' }));

    await waitFor(() => expect(rejectCalls).toBe(1));
    expect(await screen.findByText('Không tìm thấy sách')).toBeTruthy();
    const notice = await screen.findByText('Đã ghi nhận không tìm thấy bản sách vật lý; không tăng số bản sẵn có.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    await waitFor(() => expect(listReads).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole('button', { name: 'Ghi nhận không tìm thấy sách' })).toBeNull();
  });

  it('sends the current item version when a member confirms a free renewal', async () => {
    let body: Record<string, unknown> | null = null;
    const request = ownRequest();
    request.items = [{ ...item(7, 'BORROWED', 'Clean Architecture'), dueDate: '2026-10-23', renewalCount: 0 }];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/borrow-requests/mine') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([request])));
      if (config.method === 'post' && config.url?.endsWith('/renew')) {
        body = JSON.parse(String(config.data)) as Record<string, unknown>;
        return response(config, success('BORROW_ITEM_RENEWED', { loanCode: request.loanCode }));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    render(<MemoryRouter initialEntries={['/my-loans']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('tab', { name: 'Đang mượn' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gia hạn miễn phí 7 ngày' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gia hạn thêm 7 ngày' }));

    await waitFor(() => expect(body).toEqual({ expectedItemVersion: 4 }));
    const notice = await screen.findByText('Sách đã được gia hạn miễn phí thêm 7 ngày.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
  });

  it('hands over exactly the READY items with their confirmed fees, including a zero fee', async () => {
    let body: Record<string, unknown> | null = null;
    let readyItemCancelled = false;
    const counterRequest = () => {
      const request = staffRequest();
      request.items = readyItemCancelled
        ? [
          item(1, 'CANCELLED', 'Clean Architecture'),
          item(2, 'READY_FOR_PICKUP', 'Nhập môn Java'),
          item(3, 'WAITLISTED', 'Sách xếp hàng'),
          item(4, 'READY_FOR_PICKUP', 'Thiết kế phần mềm'),
        ]
        : [
          item(1, 'READY_FOR_PICKUP', 'Clean Architecture'),
          item(2, 'READY_FOR_PICKUP', 'Nhập môn Java'),
          item(3, 'WAITLISTED', 'Sách xếp hàng'),
          item(4, 'READY_FOR_PICKUP', 'Thiết kế phần mềm'),
        ];
      return request;
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        const countResponse = staffCountResponse(config, { ALL: 1, PENDING: 1, READY_FOR_PICKUP: 1, WAITLISTED: 1 });
        if (countResponse) return countResponse;
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([counterRequest()])));
      }
      if (config.method === 'post' && config.url?.endsWith('/items/1/cancel')) {
        readyItemCancelled = true;
        return response(config, success('BORROW_ITEM_CANCELLED', counterRequest()));
      }
      if (config.method === 'post' && config.url?.endsWith('/handover')) {
        body = JSON.parse(String(config.data)) as Record<string, unknown>;
        return response(config, success('BORROW_HANDOVER_COMPLETED', counterRequest()));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read', 'borrow:cancel', 'borrow:handover', 'borrow:fee-confirm'] },
      permissions: ['borrow:read', 'borrow:cancel', 'borrow:handover', 'borrow:fee-confirm'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: `Xử lý yêu cầu ${staffRequest().loanCode}` }));
    const requestDrawer = await screen.findByRole('dialog', { name: new RegExp(staffRequest().loanCode) });
    fireEvent.click(within(requestDrawer).getAllByRole('button', { name: 'Hủy READY theo yêu cầu thành viên' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận hủy READY' }));
    await waitFor(() => expect(readyItemCancelled).toBe(true));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Xác nhận hủy sách READY' })).toBeNull());
    expect(await screen.findByText('Đã hủy')).toBeTruthy();
    const drawer = document.querySelector('.librarian-borrow-drawer .ant-drawer-section') as HTMLElement;
    expect(drawer).toBeTruthy();
    const identityCheck = within(drawer).getByRole('checkbox', { name: 'Đã xác minh danh tính tại quầy' });
    const openHandover = within(drawer).getByRole('button', { name: /Thu 15\.000 ₫ và bàn giao/ });
    await waitFor(() => expect((identityCheck as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(identityCheck);
    expect((openHandover as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(openHandover);
    const confirmHandover = await screen.findByRole('button', { name: 'Xác nhận thu 15.000 ₫ và bàn giao' });
    const feeList = document.querySelector('.handover-fee-list');
    expect(feeList?.textContent).toContain('Nhập môn Java');
    expect(feeList?.textContent).toContain('Thiết kế phần mềm');
    expect(feeList?.textContent).not.toContain('Clean Architecture');
    fireEvent.click(confirmHandover);

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      identityVerified: true,
      expectedLoanVersion: 8,
      items: [
        { loanItemId: 2, collectedBorrowFee: 0 },
        { loanItemId: 4, collectedBorrowFee: 15000 },
      ],
    });
    const notice = await screen.findByText('Đã xác nhận phí và bàn giao toàn bộ sách READY còn lại.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
  });

  it('shows a specific fee mismatch message and keeps the handover unconfirmed', async () => {
    let handoverCalls = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        const countResponse = staffCountResponse(config, { ALL: 1, READY_FOR_PICKUP: 1, WAITLISTED: 1 });
        if (countResponse) return countResponse;
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([staffRequest()])));
      }
      if (config.method === 'post' && config.url?.endsWith('/handover')) {
        handoverCalls += 1;
        throw failure(config, 422, 'BORROW_FEE_MISMATCH');
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read', 'borrow:handover', 'borrow:fee-confirm'] },
      permissions: ['borrow:read', 'borrow:handover', 'borrow:fee-confirm'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: `Xử lý yêu cầu ${staffRequest().loanCode}` }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.click(within(drawer).getByRole('checkbox', { name: 'Đã xác minh danh tính tại quầy' }));
    fireEvent.click(within(drawer).getByRole('button', { name: /Thu .*và bàn giao/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận thu 15.000 ₫ và bàn giao' }));

    const notice = await screen.findByText('Số phí xác nhận không khớp phí đã chốt. Hãy tải lại và xác nhận lại các sách sẵn sàng nhận.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
    expect(handoverCalls).toBe(1);
    expect(screen.queryByText('Đã xác nhận phí và bàn giao toàn bộ sách READY còn lại.')).toBeNull();
  });

  it('lets staff paste a QR reference and shows the matched member and overdue preparation warning', async () => {
    const requests: string[] = [];
    const found = staffRequest();
    found.preparingOverdueItemIds = [3];
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.url ?? '');
      if (config.url === '/api/v1/librarian/borrow-requests') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([])));
      if (config.url === '/api/v1/librarian/pickups/QR-SECRET-REFERENCE') {
        return response(config, success('BORROW_REQUEST_DETAIL_SUCCESS', found));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /><LocationSearchProbe /></AppNotificationProvider></MemoryRouter>);
    const qrInput = await screen.findByRole('searchbox', { name: 'Mã QR / mã nhận sách' });
    fireEvent.change(qrInput, { target: { value: 'QR-SECRET-REFERENCE' } });
    fireEvent.keyDown(qrInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByRole('dialog', { name: new RegExp(found.loanCode) })).toBeTruthy();
    expect(screen.getByLabelText('current search').textContent).toContain('request=QR-SECRET-REFERENCE');
    expect(screen.getByText(/chuẩn bị quá 24 giờ/i)).toBeTruthy();
    expect(requests).toContain('/api/v1/librarian/pickups/QR-SECRET-REFERENCE');
  });

  it('shows pickup lookup errors in the shared top-right notification', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([])));
      if (config.url === '/api/v1/librarian/pickups/UNKNOWN-REFERENCE') throw failure(config, 404, 'BORROW_REQUEST_NOT_FOUND');
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    const qrInput = await screen.findByRole('searchbox', { name: 'Mã QR / mã nhận sách' });
    fireEvent.change(qrInput, { target: { value: 'UNKNOWN-REFERENCE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));

    const notice = await screen.findByText('Không tìm thấy sách hoặc yêu cầu bằng mã đã nhập.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
  });

  it('reloads stale staff state after a 409 instead of advancing the item', async () => {
    let reads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        reads += 1;
        const request = staffRequest();
        request.items[0] = item(1, 'RESERVED', 'Clean Architecture');
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([request])));
      }
      if (config.method === 'post' && config.url?.endsWith('/prepare')) throw failure(config, 409, 'BORROW_STATE_CONFLICT');
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read', 'borrow:prepare'] },
      permissions: ['borrow:read', 'borrow:prepare'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /></AppNotificationProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: `Xử lý yêu cầu ${staffRequest().loanCode}` }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: new RegExp(staffRequest().loanCode) })).getByRole('button', { name: 'Bắt đầu chuẩn bị: Clean Architecture' }));

    const notice = await screen.findByText('Yêu cầu đã thay đổi ở nơi khác. Danh sách đã được tải lại; hãy kiểm tra trạng thái mới.');
    expect(notice.closest('.ant-notification-notice')).toBeTruthy();
    expect(document.querySelector('.borrow-page-alert')).toBeNull();
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
  });

  it('shows staff requests in a compact table with status counts and opens a fee-aware drawer', async () => {
    const request = staffRequest();
    request.items = [
      item(1, 'READY_FOR_PICKUP', 'Clean Architecture'),
      item(2, 'WAITLISTED', 'Sách đang chờ'),
      item(3, 'PREPARING', 'Sách đang chuẩn bị'),
    ];
    const queries: Array<Record<string, unknown>> = [];
    const counts: Record<string, number> = {
      ALL: 5, PENDING: 2, READY_FOR_PICKUP: 1, WAITLISTED: 2, BORROWED: 1, HISTORY: 3,
    };
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') {
        const query = config.params as Record<string, unknown>;
        queries.push(query);
        if (query.size === 1) {
          return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([], { totalElements: counts[String(query.status)] ?? 0, size: 1 })));
        }
        return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([request], { totalElements: 1 })));
      }
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /><LocationSearchProbe /></AppNotificationProvider></MemoryRouter>);

    const scanInput = await screen.findByRole('searchbox', { name: 'Mã QR / mã nhận sách' });
    const table = await screen.findByRole('table');
    expect(within(table).getByText(request.loanCode)).toBeTruthy();
    expect(within(table).queryByText('QR-SECRET-REFERENCE')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(scanInput));
    await waitFor(() => expect(queries.some((query) => query.status === 'READY_FOR_PICKUP' && query.size === 1)).toBe(true));
    expect(screen.getByRole('tab', { name: /Tất cả.*5/ })).toBeTruthy();
    expect(document.querySelector('[data-request-fee-total="15000"]')).toBeTruthy();

    fireEvent.click(within(table).getByRole('button', { name: `Xem yêu cầu ${request.loanCode}` }));

    expect(await screen.findByRole('dialog', { name: new RegExp(request.loanCode) })).toBeTruthy();
    expect(screen.getByLabelText('current search').textContent).toContain('request=QR-SECRET-REFERENCE');
    expect(screen.getByText('QR-SECRET-REFERENCE')).toBeTruthy();
    expect(document.querySelector('[data-loan-item-fee="2"]')?.textContent).toContain('Không thu tại quầy');
  });

  it('opens a scanned QR request in the drawer and synchronizes the request query parameter', async () => {
    const found = staffRequest();
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/librarian/borrow-requests') return response(config, success('BORROW_REQUEST_LIST_SUCCESS', page([])));
      if (config.url === '/api/v1/librarian/pickups/QR-SECRET-REFERENCE') return response(config, success('BORROW_REQUEST_DETAIL_SUCCESS', found));
      throw new Error(`Unexpected request: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;
    Object.assign(auth, {
      role: 'CIRCULATION_CLERK',
      currentUser: { id: 52, username: 'clerk', email: 'clerk@example.test', role: 'CIRCULATION_CLERK', permissions: ['borrow:read'] },
      permissions: ['borrow:read'],
    });

    render(<MemoryRouter initialEntries={['/librarian/borrow-requests']}><AppNotificationProvider><App /><LocationSearchProbe /></AppNotificationProvider></MemoryRouter>);
    const scanInput = await screen.findByRole('searchbox', { name: 'Mã QR / mã nhận sách' });
    fireEvent.change(scanInput, { target: { value: 'QR-SECRET-REFERENCE' } });
    fireEvent.keyDown(scanInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByRole('dialog', { name: new RegExp(found.loanCode) })).toBeTruthy();
    expect(screen.getByLabelText('current search').textContent).toContain('request=QR-SECRET-REFERENCE');
    expect(screen.getByText(/không thay thế xác minh danh tính/i)).toBeTruthy();
  });
});
