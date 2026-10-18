// @vitest-environment jsdom
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { BookDetailPage } from '../../features/books/BookDetailPage';
import type { BookDetail } from '../../features/books/types';

const originalAdapter = apiClient.defaults.adapter;
const authState = vi.hoisted(() => ({ permissions: ['book:read', 'book:update', 'book:delete'] as string[] }));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ permissions: authState.permissions, capabilityStatus: 'ready' }),
}));

beforeAll(() => {
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

function detail(version = 0, title = 'Lập trình Java'): BookDetail {
  return {
    id: 12, bookCode: 'B000012', isbn: '9786041234567', title, author: 'Nguyễn An', publisher: 'NXB Trẻ',
    publishedDate: '2024-03-10', totalQuantity: 8, availableQuantity: 5, borrowFee: 150000, lateFeePerDay: 0,
    createdAt: '2026-10-01T08:30:00', updatedAt: '2026-10-02T08:30:00', version,
  };
}

function axiosFailure<T>(config: Parameters<AxiosAdapter>[0], status: number, code: string): AxiosError<ApiEnvelope<T>> {
  const body: ApiEnvelope<T> = {
    success: false, status, code, message: 'Conflict.', data: null, timestamp: new Date().toISOString(),
  };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response(config, body, status));
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/admin/books/12']}>
    <Routes><Route path="/admin/books/:id" element={<BookDetailPage />} /><Route path="/admin/books" element={<p>Danh sách sách</p>} /></Routes>
    <LocationProbe />
  </MemoryRouter>);
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  authState.permissions = ['book:read', 'book:update', 'book:delete'];
});

describe('BookDetailPage', () => {
  it('preserves both fractional fees from the API when editing only the title', async () => {
    const importedBook = { ...detail(), borrowFee: 1000.50, lateFeePerDay: 1000.01 };
    let submitted: Record<string, unknown> | undefined;
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'put') {
        submitted = JSON.parse(String(config.data)) as Record<string, unknown>;
        return response(config, success('BOOK_UPDATED', { ...importedBook, title: 'Chỉ sửa tên sách', version: 1 }));
      }
      return response(config, success('BOOK_DETAIL_SUCCESS', importedBook));
    }) satisfies AxiosAdapter;

    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    expect(screen.getByRole('textbox', { name: 'Phí mượn (VND)' })).toHaveProperty('value', '1.000,5');
    expect(screen.getByRole('textbox', { name: 'Phí trễ mỗi ngày (VND)' })).toHaveProperty('value', '1.000,01');
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sách' }), { target: { value: 'Chỉ sửa tên sách' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(submitted).toMatchObject({ title: 'Chỉ sửa tên sách', borrowFee: 1000.5, lateFeePerDay: 1000.01, version: 0 }));
    expect(typeof submitted?.borrowFee).toBe('number');
    expect(typeof submitted?.lateFeePerDay).toBe('number');
  });

  it('blocks over-precise fees and allows correcting both fields without losing decimal input', async () => {
    const requests: Record<string, unknown>[] = [];
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'put') {
        requests.push(JSON.parse(String(config.data)) as Record<string, unknown>);
        return response(config, success('BOOK_UPDATED', { ...detail(), borrowFee: 1000.5, lateFeePerDay: 1000.01, version: 1 }));
      }
      return response(config, success('BOOK_DETAIL_SUCCESS', detail()));
    }) satisfies AxiosAdapter;

    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    const borrow = screen.getByRole('textbox', { name: 'Phí mượn (VND)' });
    const late = screen.getByRole('textbox', { name: 'Phí trễ mỗi ngày (VND)' });
    fireEvent.change(borrow, { target: { value: '1.000,001' } });
    fireEvent.change(late, { target: { value: '1.000,001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.getAllByText('Nhập số tiền không âm, tối đa 2 chữ số thập phân sau dấu phẩy.')).toHaveLength(2));
    expect(requests).toHaveLength(0);
    expect(borrow).toHaveProperty('value', '1.000,001');
    expect(late).toHaveProperty('value', '1.000,001');

    fireEvent.change(borrow, { target: { value: '1000,' } });
    expect(borrow).toHaveProperty('value', '1.000,');
    fireEvent.change(borrow, { target: { value: '1.000,5' } });
    fireEvent.change(borrow, { target: { value: '1.000,50' } });
    expect(borrow).toHaveProperty('value', '1.000,50');
    fireEvent.change(late, { target: { value: '1000,01' } });
    expect(late).toHaveProperty('value', '1.000,01');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ borrowFee: 1000.5, lateFeePerDay: 1000.01 });
  });

  it('sends the loaded optimistic version and offers a reload after a stale update', async () => {
    let submitted: Record<string, unknown> | null = null;
    let detailReads = 0;
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'put') {
        submitted = JSON.parse(String(config.data)) as Record<string, unknown>;
        throw axiosFailure(config, 409, 'BOOK_VERSION_CONFLICT');
      }
      detailReads += 1;
      return response(config, success('BOOK_DETAIL_SUCCESS', detail(detailReads > 1 ? 1 : 0, detailReads > 1 ? 'Tên mới nhất từ máy chủ' : 'Lập trình Java')));
    }) satisfies AxiosAdapter;

    renderDetail();
    expect(await screen.findByText('Lập trình Java')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sách' }), { target: { value: 'Tên đang sửa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Sách đã được Admin khác cập nhật.')).toBeTruthy();
    await waitFor(() => expect(submitted).toMatchObject({ title: 'Tên đang sửa', version: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tên sách' })).toHaveProperty('value', 'Tên mới nhất từ máy chủ'));
    expect(detailReads).toBe(2);
  });

  it('keeps the detail visible and explains the history conflict after delete is rejected', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'delete') throw axiosFailure(config, 409, 'BOOK_HAS_LOAN_HISTORY');
      return response(config, success('BOOK_DETAIL_SUCCESS', detail()));
    }) satisfies AxiosAdapter;

    renderDetail();
    expect(await screen.findByText('Lập trình Java')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa sách' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'Xóa sách' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Không thể xóa sách đã có lịch sử mượn. Thông tin sách vẫn được giữ nguyên.')).toBeTruthy();
    expect(screen.getByLabelText('current path').textContent).toBe('/admin/books/12');
    expect(screen.getByText('Lập trình Java')).toBeTruthy();
  });
});
