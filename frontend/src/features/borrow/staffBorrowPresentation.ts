import type { BorrowItem, BorrowRequestFilter, LoanItemStatus, StaffBorrowRequest } from './types';

export type StaffDeskFilter = BorrowRequestFilter;

export const STAFF_DESK_FILTERS: Array<{ key: StaffDeskFilter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Cần chuẩn bị' },
  { key: 'READY_FOR_PICKUP', label: 'Sẵn sàng nhận' },
  { key: 'BORROWED', label: 'Đang mượn' },
  { key: 'RETURNED', label: 'Đã trả' },
  { key: 'CANCELLED', label: 'Đã hủy' },
  { key: 'EXPIRED', label: 'Đã hết hạn nhận' },
  { key: 'REJECTED', label: 'Không tìm thấy sách' },
];

export const ITEM_STATUS_LABELS: Record<LoanItemStatus, string> = {
  RESERVED: 'Cần chuẩn bị',
  PREPARING: 'Đang chuẩn bị',
  READY_FOR_PICKUP: 'Sẵn sàng nhận',
  BORROWED: 'Đang mượn',
  RETURNED: 'Đã trả',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn nhận',
  REJECTED: 'Không tìm thấy sách',
};

export const LOAN_STATUS_LABELS: Record<StaffBorrowRequest['status'], string> = {
  OPEN: 'Đang xử lý',
  ACTIVE: 'Đang mượn',
  PARTIALLY_RETURNED: 'Đang mượn một phần',
  RETURNED: 'Đã trả',
  CLOSED: 'Đã kết thúc',
};

const ITEM_STATUS_PRIORITY: LoanItemStatus[] = [
  'READY_FOR_PICKUP', 'PREPARING', 'RESERVED', 'BORROWED',
  'RETURNED', 'CANCELLED', 'EXPIRED', 'REJECTED',
];

export function getPrimaryItemStatus(items: BorrowItem[]): LoanItemStatus | null {
  const statuses = new Set(items.map((item) => item.status));
  return ITEM_STATUS_PRIORITY.find((status) => statuses.has(status)) ?? null;
}

/** Hiển thị các trạng thái thực tế; PREPARING cũ vẫn thuộc bước cần chuẩn bị ở quầy. */
export function getRequestDisplayStatuses(request: StaffBorrowRequest): LoanItemStatus[] {
  const statuses = new Set<LoanItemStatus>(request.items.map((item) => item.status === 'PREPARING' ? 'RESERVED' : item.status));
  return ITEM_STATUS_PRIORITY.filter((status) => statuses.has(status));
}

export function getRequestFeeTotal(request: StaffBorrowRequest): number {
  return request.items
    .filter((item) => item.status === 'READY_FOR_PICKUP')
    .reduce((total, item) => total + item.borrowFee, 0);
}

export function requestNeedsStaffAction(request: StaffBorrowRequest): boolean {
  return request.items.some((item) => ['RESERVED', 'PREPARING', 'READY_FOR_PICKUP'].includes(item.status));
}

export function statusTagColor(status: LoanItemStatus): string {
  if (status === 'READY_FOR_PICKUP' || status === 'RETURNED') return 'success';
  if (status === 'RESERVED' || status === 'PREPARING') return 'warning';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'error';
  if (status === 'BORROWED') return 'processing';
  return 'default';
}

export function aggregateStatusTagColor(status: StaffBorrowRequest['status']): string {
  if (status === 'RETURNED' || status === 'CLOSED') return 'default';
  if (status === 'OPEN') return 'warning';
  return 'processing';
}

export function formatDeskDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function getReadyItems(request: StaffBorrowRequest): BorrowItem[] {
  return request.items.filter((item) => item.status === 'READY_FOR_PICKUP');
}

export function getNextPreparationItem(request: StaffBorrowRequest): BorrowItem | null {
  return request.items.find((item) => item.status === 'RESERVED' || item.status === 'PREPARING') ?? null;
}
