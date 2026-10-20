export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export type BorrowRequestFilter =
  | 'ALL'
  | 'PENDING'
  | 'HISTORY'
  | 'WAITLISTED'
  | 'RESERVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'BORROWED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

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
  waitlistCount: number;
  waitlistCap: number;
}

export type LoanItemStatus =
  | 'WAITLISTED'
  | 'RESERVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'BORROWED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

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
  renewalCount: number;
  version: number;
  waitlistPosition: number | null;
  waitlistTotal: number | null;
}

export interface BorrowRequestSummary {
  loanCode: string;
  pickupReference: string;
  aggregateStatus: string;
  createdAt: string;
  version: number;
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
  items: BorrowItem[];
}

export interface StaffBorrowRequest {
  loanCode: string;
  pickupReference: string;
  status: string;
  createdAt: string;
  version: number;
  member: { id: number; memberCode: string; fullName: string };
  items: BorrowItem[];
  preparingOverdueItemIds: number[];
}

export interface HandoverRequest {
  identityVerified: true;
  expectedLoanVersion: number;
  items: Array<{ loanItemId: number; collectedBorrowFee: number }>;
}

export interface BorrowListQuery {
  page: number;
  size: number;
  sort: string;
  q?: string;
  availability?: 'AVAILABLE' | 'UNAVAILABLE';
}
