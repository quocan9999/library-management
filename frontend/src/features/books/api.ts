import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type {
  BookDetail,
  BookImportReport,
  BookListItem,
  BookListQuery,
  BookUpdateInput,
  BookWriteInput,
  PageResponse,
} from './types';

function readRequiredData<T>(envelope: ApiEnvelope<T>, expectedCode: string): T {
  if (!envelope.success || envelope.code !== expectedCode || envelope.data === null) {
    throw new Error('Phản hồi quản lý sách không hợp lệ.');
  }
  return envelope.data;
}

export const bookApi = {
  async getBooks(query: BookListQuery, signal?: AbortSignal): Promise<PageResponse<BookListItem>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<BookListItem>>>('/api/v1/books', {
      params: query,
      signal,
    });
    return readRequiredData(response.data, 'BOOK_LIST_SUCCESS');
  },

  async getBook(id: number, signal?: AbortSignal): Promise<BookDetail> {
    const response = await apiClient.get<ApiEnvelope<BookDetail>>(`/api/v1/books/${id}`, { signal });
    return readRequiredData(response.data, 'BOOK_DETAIL_SUCCESS');
  },

  async createBook(input: BookWriteInput): Promise<BookDetail> {
    const response = await apiClient.post<ApiEnvelope<BookDetail>>('/api/v1/books', input);
    return readRequiredData(response.data, 'BOOK_CREATED');
  },

  async updateBook(id: number, input: BookUpdateInput): Promise<BookDetail> {
    const response = await apiClient.put<ApiEnvelope<BookDetail>>(`/api/v1/books/${id}`, input);
    return readRequiredData(response.data, 'BOOK_UPDATED');
  },

  async deleteBook(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/books/${id}`);
  },

  async importBooks(file: File): Promise<BookImportReport> {
    const body = new FormData();
    body.append('file', file);
    const response = await apiClient.post<ApiEnvelope<BookImportReport>>('/api/v1/books/import', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return readRequiredData(response.data, 'BOOK_IMPORT_PROCESSED');
  },
};
