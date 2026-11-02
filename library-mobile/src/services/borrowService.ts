import { api, extractErrorMessage } from './api';
import { PageResponse } from './bookCatalogService';

export type LoanItemStatus =
  | 'RESERVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'BORROWED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export type BorrowRequestFilter =
  | 'ALL'
  | 'PENDING'
  | 'HISTORY'
  | 'RESERVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'BORROWED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export interface BorrowItem {
  id: number;
  bookId: number;
  bookCode: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  status: LoanItemStatus;
  borrowFee: number;
  lateFeePerDay: number;
  paidBorrowFee: number;
  lateFee: number;
  borrowedAt: string | null;
  dueDate: string | null;
  readyAt: string | null;
  pickupExpiresAt: string | null;
  returnedAt?: string | null;
  renewalCount: number;
  version: number;
}

export interface BorrowRequestSummary {
  loanCode: string;
  pickupReference: string;
  aggregateStatus: string;
  createdAt: string;
  version: number;
  paymentStatus?: 'PENDING' | 'PAID' | 'NOT_REQUIRED' | 'EXPIRED';
  paymentAmount?: number;
  paymentExpiresAt?: string | null;
  itemCount: number;
  statuses: LoanItemStatus[];
  items: BorrowItem[];
}

export interface BorrowRequest {
  loanCode: string;
  pickupReference: string;
  status: string;
  createdAt: string;
  version: number;
  paymentStatus?: 'PENDING' | 'PAID' | 'NOT_REQUIRED' | 'EXPIRED';
  paymentAmount?: number;
  items: BorrowItem[];
}

interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export const borrowService = {
  async listMine(page = 0, status: BorrowRequestFilter = 'ALL', size = 10): Promise<PageResponse<BorrowRequestSummary>> {
    try {
      const response = await api.get<ApiEnvelope<PageResponse<BorrowRequestSummary>>>('/api/v1/borrow-requests/mine', {
        params: { page, size, sort: 'createdAt,desc', status },
      });
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể tải danh sách mượn sách.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải yêu cầu mượn sách của bạn.'));
    }
  },

  async createRequest(bookIds: number[]): Promise<BorrowRequest> {
    try {
      if (bookIds.length < 1 || bookIds.length > 3) {
        throw new Error('Chỉ có thể mượn từ 1 đến 3 cuốn sách mỗi lần.');
      }
      const response = await api.post<ApiEnvelope<BorrowRequest>>('/api/v1/borrow-requests', { bookIds });
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể tạo yêu cầu mượn.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đặt mượn sách không thành công.'));
    }
  },

  async cancelItem(loanCode: string, itemId: number): Promise<BorrowRequest> {
    try {
      const response = await api.post<ApiEnvelope<BorrowRequest>>(
        `/api/v1/borrow-requests/mine/${encodeURIComponent(loanCode)}/items/${itemId}/cancel`
      );
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể hủy sách.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể hủy cuốn sách này.'));
    }
  },

  async renewItem(loanCode: string, itemId: number, expectedItemVersion: number): Promise<void> {
    try {
      const response = await api.post<ApiEnvelope<unknown>>(
        `/api/v1/borrow-requests/mine/${encodeURIComponent(loanCode)}/items/${itemId}/renew`,
        { expectedItemVersion }
      );
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Không thể gia hạn sách.');
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Gia hạn sách không thành công.'));
    }
  },
};
