import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type {
  BorrowListQuery,
  BorrowRequestFilter,
  BorrowRequest,
  BorrowRequestSummary,
  CatalogBook,
  HandoverRequest,
  PageResponse,
  StaffBorrowRequest,
} from './types';

export const BORROW_PAGE_SIZE = 10;

function readRequiredData<T>(envelope: ApiEnvelope<T>, expectedCode: string): T {
  if (!envelope.success || envelope.code !== expectedCode || envelope.data === null) {
    throw new Error('Phản hồi dịch vụ mượn sách không hợp lệ.');
  }
  return envelope.data;
}

export const borrowApi = {
  async listCatalog(query: BorrowListQuery, signal?: AbortSignal): Promise<PageResponse<CatalogBook>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<CatalogBook>>>('/api/v1/catalog/books', { params: query, signal });
    return readRequiredData(response.data, 'BOOK_CATALOG_LIST_SUCCESS');
  },

  async getCatalogBook(bookId: number, signal?: AbortSignal): Promise<CatalogBook> {
    const response = await apiClient.get<ApiEnvelope<CatalogBook>>(`/api/v1/catalog/books/${bookId}`, { signal });
    return readRequiredData(response.data, 'BOOK_CATALOG_DETAIL_SUCCESS');
  },

  async createRequest(bookIds: number[]): Promise<BorrowRequest> {
    if (bookIds.length < 1 || bookIds.length > 3 || new Set(bookIds).size !== bookIds.length) {
      throw new Error('Chọn từ 1 đến 3 đầu sách khác nhau.');
    }
    const response = await apiClient.post<ApiEnvelope<BorrowRequest>>('/api/v1/borrow-requests', { bookIds });
    return readRequiredData(response.data, 'BORROW_REQUEST_CREATED');
  },

  async listMine(page = 0, status: BorrowRequestFilter = 'ALL', signal?: AbortSignal): Promise<PageResponse<BorrowRequestSummary>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<BorrowRequestSummary>>>('/api/v1/borrow-requests/mine', {
      params: { page, size: BORROW_PAGE_SIZE, sort: 'createdAt,desc', status },
      signal,
    });
    return readRequiredData(response.data, 'BORROW_REQUEST_LIST_SUCCESS');
  },

  async cancelMine(loanCode: string, itemId: number): Promise<BorrowRequest> {
    const response = await apiClient.post<ApiEnvelope<BorrowRequest>>(`/api/v1/borrow-requests/mine/${encodeURIComponent(loanCode)}/items/${itemId}/cancel`);
    return readRequiredData(response.data, 'BORROW_ITEM_CANCELLED');
  },

  async renewMine(loanCode: string, itemId: number, expectedItemVersion: number): Promise<unknown> {
    const response = await apiClient.post<ApiEnvelope<unknown>>(
      `/api/v1/borrow-requests/mine/${encodeURIComponent(loanCode)}/items/${itemId}/renew`,
      { expectedItemVersion },
    );
    return readRequiredData(response.data, 'BORROW_ITEM_RENEWED');
  },

  async listStaff(page = 0, status: BorrowRequestFilter = 'PENDING'): Promise<PageResponse<StaffBorrowRequest>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<StaffBorrowRequest>>>('/api/v1/librarian/borrow-requests', {
      params: { page, size: BORROW_PAGE_SIZE, sort: 'createdAt,desc', status },
    });
    return readRequiredData(response.data, 'BORROW_REQUEST_LIST_SUCCESS');
  },

  async findPickup(pickupReference: string): Promise<StaffBorrowRequest> {
    const response = await apiClient.get<ApiEnvelope<StaffBorrowRequest>>(
      `/api/v1/librarian/pickups/${encodeURIComponent(pickupReference)}`,
    );
    return readRequiredData(response.data, 'BORROW_REQUEST_DETAIL_SUCCESS');
  },

  async prepare(loanCode: string, itemId: number): Promise<StaffBorrowRequest> {
    return this.postStaffItem(loanCode, itemId, 'prepare', 'BORROW_ITEM_PREPARING');
  },

  async markReady(loanCode: string, itemId: number): Promise<StaffBorrowRequest> {
    return this.postStaffItem(loanCode, itemId, 'ready', 'BORROW_ITEM_READY');
  },

  async cancelReady(loanCode: string, itemId: number): Promise<StaffBorrowRequest> {
    return this.postStaffItem(loanCode, itemId, 'cancel', 'BORROW_ITEM_CANCELLED');
  },

  async reject(loanCode: string, itemId: number): Promise<StaffBorrowRequest> {
    return this.postStaffItem(loanCode, itemId, 'reject', 'BORROW_ITEM_REJECTED');
  },

  async handover(loanCode: string, body: HandoverRequest): Promise<StaffBorrowRequest> {
    const response = await apiClient.post<ApiEnvelope<StaffBorrowRequest>>(
      `/api/v1/librarian/borrow-requests/${encodeURIComponent(loanCode)}/handover`,
      body,
    );
    return readRequiredData(response.data, 'BORROW_HANDOVER_COMPLETED');
  },

  async postStaffItem(loanCode: string, itemId: number, action: string, expectedCode: string): Promise<StaffBorrowRequest> {
    const response = await apiClient.post<ApiEnvelope<StaffBorrowRequest>>(
      `/api/v1/librarian/borrow-requests/${encodeURIComponent(loanCode)}/items/${itemId}/${action}`,
    );
    return readRequiredData(response.data, expectedCode);
  },
};
