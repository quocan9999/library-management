export interface BookListItem {
  id: number;
  bookCode: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  coverImageUrl?: string | null;
  publishedDate: string | null;
  totalQuantity: number;
  availableQuantity: number;
  borrowFee: number;
  lateFeePerDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookDetail extends BookListItem {
  version: number;
}

export interface BookWriteInput {
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publishedDate: string | null;
  totalQuantity: number;
  borrowFee: number;
  lateFeePerDay: number;
  confirmSimilar?: boolean;
}

export interface BookUpdateInput extends BookWriteInput {
  version: number;
}

export interface BookListQuery {
  q?: string;
  publisher?: string;
  publishedFrom?: string;
  publishedTo?: string;
  availability?: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE';
  page: number;
  size: number;
  sort: string;
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

export interface BookImportError {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

export interface BookImportReport {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: BookImportError[];
  omittedErrorCount: number;
}
