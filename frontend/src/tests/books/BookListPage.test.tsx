// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { BookListPage } from '../../features/books/BookListPage';
import type { BookDetail, BookListItem, PageResponse } from '../../features/books/types';

const originalAdapter = apiClient.defaults.adapter;
const authState = vi.hoisted(() => ({ permissions: ['book:read'] as string[] }));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ permissions: authState.permissions, capabilityStatus: 'ready' }),
}));

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
});

function response<T>(config: Parameters<AxiosAdapter>[0], data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function success<T>(code: string, data: T): ApiEnvelope<T> {
  return { success: true, status: 200, code, message: 'Success.', data, timestamp: new Date().toISOString() };
}

function failure<T>(config: Parameters<AxiosAdapter>[0], status: number, code: string, errors?: Record<string, string>): AxiosError<ApiEnvelope<T>> {
  const body: ApiEnvelope<T> = { success: false, status, code, message: 'Invalid.', data: null, errors, timestamp: new Date().toISOString() };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, status));
}

function page(content: BookListItem[] = []): PageResponse<BookListItem> {
  return { content, page: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0, first: true, last: true };
}

function book(id: number, title = 'Lập trình Java'): BookDetail {
  return {
    id, bookCode: `B${String(id).padStart(6, '0')}`, isbn: '9786041234567', title, author: 'Nguyễn An',
    publisher: 'Nhà xuất bản Trẻ', publishedDate: '2024-03-10', totalQuantity: 0, availableQuantity: 0,
    borrowFee: 150000, lateFeePerDay: 0, createdAt: '2026-10-01T08:30:00', updatedAt: '2026-10-02T08:30:00', version: 0,
  };
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  authState.permissions = ['book:read'];
});

describe('BookListPage', () => {
  it('automatically debounces publisher and quick search without an apply button', async () => {
    const requests: Record<string, unknown>[] = [];
    apiClient.defaults.adapter = (async (config) => {
      requests.push(config.params as Record<string, unknown>);
      return response(config, success('BOOK_LIST_SUCCESS', page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý sách' });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ page: 0, size: 10, sort: 'createdAt,desc' });

    fireEvent.click(screen.getByText('Bộ lọc nâng cao'));
    expect(screen.queryByRole('button', { name: 'Áp dụng bộ lọc' })).toBeNull();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhà xuất bản' }), { target: { value: 'Trẻ' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(449); });
    expect(requests).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toMatchObject({ publisher: 'Trẻ', page: 0 });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm sách' }), { target: { value: 'Java' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(449); });
    expect(requests).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await vi.waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]).toMatchObject({ q: 'Java', publisher: 'Trẻ', page: 0, size: 10 });

    fireEvent.change(screen.getByRole('textbox', { name: 'Nhà xuất bản' }), { target: { value: 'Pending' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    await vi.waitFor(() => expect(requests).toHaveLength(4));
    expect(requests[3]).not.toHaveProperty('publisher');
    expect(requests[3]).not.toHaveProperty('q');
  });

  it('does not let an older response overwrite the current search result', async () => {
    let resolveOld: (() => void) | undefined;
    let requests = 0;
    apiClient.defaults.adapter = (async (config) => {
      requests += 1;
      if (requests === 1) {
        return new Promise<AxiosResponse<ApiEnvelope<PageResponse<BookListItem>>>>((resolve) => {
          resolveOld = () => resolve(response(config, success('BOOK_LIST_SUCCESS', page([{
            ...book(1), title: 'Kết quả cũ',
          }]))));
        });
      }
      return response(config, success('BOOK_LIST_SUCCESS', page([{ ...book(2), title: 'Kết quả hiện tại' }])));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await vi.waitFor(() => expect(resolveOld).toBeDefined());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm sách' }), { target: { value: 'hiện tại' } });
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    await vi.waitFor(() => expect(requests).toBe(2));
    expect(await screen.findByText('Kết quả hiện tại')).toBeTruthy();
    await act(async () => { resolveOld?.(); await Promise.resolve(); });
    expect(screen.queryByText('Kết quả cũ')).toBeNull();
  });

  it('sends grouped VND input as a number and accepts zero amounts', async () => {
    authState.permissions = ['book:read', 'book:create'];
    let submitted: Record<string, unknown> | null = null;
    let listReads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'post') {
        submitted = JSON.parse(String(config.data)) as Record<string, unknown>;
        return response(config, success('BOOK_CREATED', book(12)));
      }
      listReads += 1;
      return response(config, success('BOOK_LIST_SUCCESS', page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý sách' });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm sách' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sách' }), { target: { value: '  Lập trình Java  ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tác giả' }), { target: { value: '  Nguyễn An  ' } });
    const borrowFee = screen.getByRole('textbox', { name: 'Phí mượn (VND)' });
    fireEvent.change(borrowFee, { target: { value: '150000' } });
    expect(borrowFee).toHaveProperty('value', '150.000');
    const submitButtons = screen.getAllByRole('button', { name: 'Thêm sách' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await vi.waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted).toMatchObject({
      title: 'Lập trình Java', author: 'Nguyễn An', borrowFee: 150000, lateFeePerDay: 0, totalQuantity: 0,
    });
    await vi.waitFor(() => expect(listReads).toBe(2));
  });

  it('maps a server 422 field error onto the matching form control', async () => {
    authState.permissions = ['book:read', 'book:create'];
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'post') throw failure(config, 422, 'VALIDATION_ERROR', { title: 'Tên sách không hợp lệ theo quy tắc máy chủ.' });
      return response(config, success('BOOK_LIST_SUCCESS', page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý sách' });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm sách' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sách' }), { target: { value: 'Sách' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tác giả' }), { target: { value: 'Tác giả' } });
    const submitButtons = screen.getAllByRole('button', { name: 'Thêm sách' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    expect(await screen.findByText('Tên sách không hợp lệ theo quy tắc máy chủ.')).toBeTruthy();
  });

  it('asks for explicit confirmation of a similar no-ISBN title before retrying', async () => {
    authState.permissions = ['book:read', 'book:create'];
    const bodies: Array<Record<string, unknown>> = [];
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'post') {
        bodies.push(JSON.parse(String(config.data)) as Record<string, unknown>);
        if (bodies.length === 1) throw failure(config, 409, 'SIMILAR_BOOK_CONFIRMATION_REQUIRED');
        return response(config, success('BOOK_CREATED', book(21)));
      }
      return response(config, success('BOOK_LIST_SUCCESS', page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý sách' });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm sách' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sách' }), { target: { value: 'Sách giống' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tác giả' }), { target: { value: 'Tác giả' } });
    let submitButtons = screen.getAllByRole('button', { name: 'Thêm sách' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    expect(await screen.findByText('Đã có sách cùng tên và tác giả chưa có ISBN.')).toBeTruthy();
    expect(bodies).toHaveLength(1);
    submitButtons = screen.getAllByRole('button', { name: 'Thêm sách' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0].confirmSimilar).toBe(false);
    expect(bodies[1].confirmSimilar).toBe(true);
  });

  it('shows an all-failed HTTP 200 import report and manual-confirmation guidance', async () => {
    authState.permissions = ['book:read', 'book:import'];
    let uploaded = false;
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/books/import') {
        uploaded = config.data instanceof FormData;
        return response(config, success('BOOK_IMPORT_PROCESSED', {
          totalRows: 1, importedRows: 0, failedRows: 1, omittedErrorCount: 0,
          errors: [{ rowNumber: 2, field: 'title', code: 'SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION', message: 'Sách cùng tên và tác giả.' }],
        }));
      }
      return response(config, success('BOOK_LIST_SUCCESS', page()));
    }) satisfies AxiosAdapter;
    render(<MemoryRouter><BookListPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Quản lý sách' });
    const importButtons = screen.getAllByRole('button', { name: 'Nhập CSV' });
    fireEvent.click(importButtons[importButtons.length - 1]);
    const file = new File(['title,author\nA,B'], 'books.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Chọn file CSV'), { target: { files: [file] } });
    const submitImportButtons = screen.getAllByRole('button', { name: 'Nhập CSV' });
    fireEvent.click(submitImportButtons[submitImportButtons.length - 1]);

    expect(await screen.findByText('0 sách được nhập')).toBeTruthy();
    expect(screen.getByText(/tạo từng sách từ biểu mẫu/i)).toBeTruthy();
    expect(screen.getByText('Sách cùng tên và tác giả.')).toBeTruthy();
    expect(uploaded).toBe(true);
  });
});
