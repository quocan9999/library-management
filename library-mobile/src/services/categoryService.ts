import { api } from './api';

export interface CategorySummary {
  id: number;
  name: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export const categoryService = {
  /**
   * Lấy danh sách danh mục rút gọn cho bộ lọc catalog.
   * Phòng thủ lỗi (403/404/mạng): trả mảng rỗng để UI tự ẩn phần lọc theo danh mục.
   */
  async getOptions(q?: string): Promise<CategorySummary[]> {
    try {
      const response = await api.get<ApiEnvelope<CategorySummary[]>>('/api/v1/categories/options', {
        params: q?.trim() ? { q: q.trim() } : undefined,
      });
      return Array.isArray(response.data?.data) ? response.data.data : [];
    } catch {
      return [];
    }
  },
};
