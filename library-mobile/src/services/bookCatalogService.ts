import { api, extractErrorMessage } from './api';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface CatalogBook {
  id: number;
  bookCode: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;
  totalQuantity: number;
  availableQuantity: number;
  borrowFee: number;
  lateFeePerDay: number;
  coverImageUrl: string | null;
}

export interface CatalogQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  availability?: 'AVAILABLE' | 'UNAVAILABLE';
  categoryId?: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export const bookCatalogService = {
  async listBooks(params: CatalogQueryParams = {}): Promise<PageResponse<CatalogBook>> {
    try {
      const response = await api.get<ApiEnvelope<PageResponse<CatalogBook>>>('/api/v1/catalog/books', {
        params: {
          page: params.page ?? 0,
          size: params.size ?? 10,
          sort: params.sort ?? 'title,asc',
          ...(params.q ? { q: params.q } : {}),
          ...(params.availability ? { availability: params.availability } : {}),
          ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        },
      });

      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể tải danh mục sách.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể kết nối đến máy chủ danh mục sách.'));
    }
  },

  async getBookDetail(id: number): Promise<CatalogBook> {
    try {
      const response = await api.get<ApiEnvelope<CatalogBook>>(`/api/v1/catalog/books/${id}`);
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không tìm thấy sách.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết sách.'));
    }
  },
};
