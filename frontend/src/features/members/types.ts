export type LoanItemStatus = 'BORROWED' | 'RETURNED';

export type LoanHeaderStatus = 'ACTIVE' | 'PARTIALLY_RETURNED' | 'RETURNED';

export type HistoryStatus = 'ALL' | LoanItemStatus;

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface MemberListItem {
  id: number;
  memberCode: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  emailVerified: boolean;
  enabled: boolean;
}

export interface MemberDetail extends MemberListItem {
  address: string | null;
  updatedAt: string;
  version: number;
  borrowedItemCount: number;
}

export interface LoanHistoryItem {
  loanItemId: number;
  loanId: number;
  loanCode: string;
  loanStatus: LoanHeaderStatus;
  bookId: number;
  bookCode: string;
  bookTitle: string;
  bookAuthor: string;
  isbn: string | null;
  itemStatus: LoanItemStatus;
  borrowedAt: string;
  dueDate: string;
  returnedAt: string | null;
  borrowFee: number;
  lateFeePerDay: number;
  lateFee: number;
  recordedTotalFee: number;
}

export interface MemberListQuery {
  fullName?: string;
  memberCode?: string;
  email?: string;
  phone?: string;
  birthFrom?: string;
  birthTo?: string;
  book?: string;
  borrowStatus?: HistoryStatus;
  emailVerified?: boolean;
  enabled?: boolean;
  page: number;
  size: number;
  sort: string;
}

export interface LoanHistoryQuery {
  status: HistoryStatus;
  page: number;
  size: number;
}
