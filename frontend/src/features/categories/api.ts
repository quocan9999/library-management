import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type {
  Category,
  CategoryListQuery,
  CategoryOptionsQuery,
  CategorySummary,
  CategoryUpdateInput,
  CategoryWriteInput,
  PageResponse,
} from './types';

function readRequiredData<T>(envelope: ApiEnvelope<T>, expectedCode: string): T {
  if (!envelope.success || envelope.code !== expectedCode || envelope.data === null) {
    throw new Error('Phản hồi quản lý danh mục không hợp lệ.');
  }
  return envelope.data;
}

export const categoryApi = {
  /** Trang danh mục cho bảng quản trị. */
  async getCategories(query: CategoryListQuery, signal?: AbortSignal): Promise<PageResponse<Category>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<Category>>>('/api/v1/categories', {
      params: query,
      signal,
    });
    return readRequiredData(response.data, 'CATEGORY_LIST_SUCCESS');
  },

  /** Danh sách rút gọn cho dropdown gán danh mục cho sách. */
  async getOptions(query: CategoryOptionsQuery = {}, signal?: AbortSignal): Promise<CategorySummary[]> {
    const response = await apiClient.get<ApiEnvelope<CategorySummary[]>>('/api/v1/categories/options', {
      params: query,
      signal,
    });
    return readRequiredData(response.data, 'CATEGORY_OPTIONS_SUCCESS');
  },

  async createCategory(input: CategoryWriteInput): Promise<Category> {
    const response = await apiClient.post<ApiEnvelope<Category>>('/api/v1/categories', input);
    return readRequiredData(response.data, 'CATEGORY_CREATED');
  },

  async updateCategory(id: number, input: CategoryUpdateInput): Promise<Category> {
    const response = await apiClient.put<ApiEnvelope<Category>>(`/api/v1/categories/${id}`, input);
    return readRequiredData(response.data, 'CATEGORY_UPDATED');
  },

  async deleteCategory(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/categories/${id}`);
  },
};
