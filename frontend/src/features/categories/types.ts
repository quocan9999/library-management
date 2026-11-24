/** Thông tin rút gọn danh mục dùng cho dropdown và hiển thị trong sách. */
export interface CategorySummary {
  id: number;
  name: string;
}

/** Danh mục đầy đủ trả về cho trang quản trị. */
export interface Category {
  id: number;
  name: string;
  description: string | null;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Dữ liệu tạo/cập nhật danh mục gửi lên API. */
export interface CategoryWriteInput {
  name: string;
  description: string | null;
}

export interface CategoryUpdateInput extends CategoryWriteInput {
  version: number;
}

export interface CategoryListQuery {
  q?: string;
  page: number;
  size: number;
  sort: string;
}

export interface CategoryOptionsQuery {
  q?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
