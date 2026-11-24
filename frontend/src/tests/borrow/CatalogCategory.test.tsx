// @vitest-environment jsdom
import { AxiosHeaders, type AxiosAdapter, type AxiosResponse } from 'axios';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import { UserCartContext, type UserCartContextType } from '../../components/user';
import { CatalogDetailPage, CatalogPage } from '../../features/borrow/CatalogPage';
import type { CatalogBook, PageResponse } from '../../features/borrow/types';

const emptyCartContext: UserCartContextType = {
  cartItems: [],
  addToCart: () => true,
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
  isCartOpen: false,
  setIsCartOpen: vi.fn(),
  openCart: vi.fn(),
  closeCart: vi.fn(),
};

const originalAdapter = apiClient.defaults.adapter;
const authState = vi.hoisted(() => ({
  permissions: ['book:read', 'category:read', 'borrow:create'] as string[],
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ permissions: authState.permissions, capabilityStatus: 'ready' }),
  useOptionalAuth: () => ({ permissions: authState.permissions, capabilityStatus: 'ready' }),
}));

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

function page(content: CatalogBook[]): PageResponse<CatalogBook> {
  return {
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
  };
}

function sampleBook(id: number, title: string, categories: Array<{ id: number; name: string }>): CatalogBook {
  return {
    id,
    bookCode: `B00000${id}`,
    isbn: '9786041234567',
    title,
    author: 'Nguyễn An',
    publisher: 'NXB Trẻ',
    publishedDate: '2024-03-10',
    totalQuantity: 4,
    availableQuantity: 3,
    borrowFee: 10000,
    price: 120000,
    lateFeePerDay: 2000,
    categories,
    coverImageUrl: null,
  };
}

afterEach(() => {
  cleanup();
  apiClient.defaults.adapter = originalAdapter;
  authState.permissions = ['book:read', 'category:read', 'borrow:create'];
});

describe('Web Customer Catalog Categories', () => {
  it('loads category chips, filters catalog by categoryId & sort, and shows category tag on cards', async () => {
    const catalogQueries: Array<Record<string, unknown>> = [];
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/categories/options') {
        return response(config, success('CATEGORY_OPTIONS_SUCCESS', [
          { id: 1, name: 'Văn học' },
          { id: 2, name: 'Kỹ thuật' },
        ]));
      }
      if (config.url === '/api/v1/catalog/books') {
        const params = (config.params ?? {}) as Record<string, unknown>;
        catalogQueries.push(params);
        const books = params.categoryId === 2
          ? [sampleBook(2, 'Clean Code', [{ id: 2, name: 'Kỹ thuật' }, { id: 3, name: 'CNTT' }])]
          : [
              sampleBook(1, 'Số Đỏ', [{ id: 1, name: 'Văn học' }]),
              sampleBook(2, 'Clean Code', [{ id: 2, name: 'Kỹ thuật' }, { id: 3, name: 'CNTT' }]),
            ];
        return response(config, success('BOOK_CATALOG_LIST_SUCCESS', page(books)));
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(
      <MemoryRouter initialEntries={['/books']}>
        <UserCartContext.Provider value={emptyCartContext}>
          <CatalogPage />
        </UserCartContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Kỹ thuật' })).toBeTruthy();
    const grid = await screen.findByRole('region', { name: 'Sách trong danh mục' });
    expect(within(grid).getByText('Văn học')).toBeTruthy();
    expect(within(grid).getByText('Kỹ thuật +1')).toBeTruthy();
    expect(screen.getByText('2 đầu sách')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Kỹ thuật' }));
    await waitFor(() => expect(catalogQueries.some((q) => q.categoryId === 2)).toBe(true));
    expect(await screen.findByText('1 đầu sách')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sắp xếp sách' }), { target: { value: 'createdAt,desc' } });
    await waitFor(() =>
      expect(catalogQueries.some((q) => q.categoryId === 2 && q.sort === 'createdAt,desc')).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => {
      const last = catalogQueries[catalogQueries.length - 1];
      expect(last).not.toHaveProperty('categoryId');
      expect(last.sort).toBe('title,asc');
    });
  });

  it('displays book categories on customer book detail page', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/api/v1/catalog/books/5') {
        return response(
          config,
          success('BOOK_CATALOG_DETAIL_SUCCESS', sampleBook(5, 'Thiết kế hệ thống', [
            { id: 2, name: 'Kỹ thuật' },
            { id: 4, name: 'Kiến trúc' },
          ])),
        );
      }
      throw new Error(`Unexpected request: ${config.url}`);
    }) satisfies AxiosAdapter;

    render(
      <MemoryRouter initialEntries={['/books/5']}>
        <UserCartContext.Provider value={emptyCartContext}>
          <Routes>
            <Route path="/books/:id" element={<CatalogDetailPage />} />
          </Routes>
        </UserCartContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Thiết kế hệ thống' })).toBeTruthy();
    expect(screen.getByText('Kỹ thuật')).toBeTruthy();
    expect(screen.getByText('Kiến trúc')).toBeTruthy();
  });
});
