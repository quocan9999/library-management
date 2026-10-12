import type { HistoryStatus, MemberListQuery } from './types';

const STORAGE_KEY = 'memberManagement:listState:v1';
const PAGE_SIZE = 10;
const SORT_FIELDS = ['createdAt', 'memberCode', 'fullName', 'dateOfBirth'] as const;
const SORT_DIRECTIONS = ['asc', 'desc'] as const;
const SORT_OPTIONS = new Set(SORT_FIELDS.flatMap((field) =>
  SORT_DIRECTIONS.map((direction) => `${field},${direction}`)));

export interface MemberListFilters {
  fullName: string;
  memberCode: string;
  email: string;
  phone: string;
  birthFrom: string;
  birthTo: string;
  book: string;
  borrowStatus: HistoryStatus;
  emailVerified: 'all' | 'true' | 'false';
  enabled: 'all' | 'true' | 'false';
}

export interface MemberListViewState {
  filters: MemberListFilters;
  page: number;
  sort: string;
}

export const DEFAULT_MEMBER_LIST_STATE: MemberListViewState = {
  filters: {
    fullName: '',
    memberCode: '',
    email: '',
    phone: '',
    birthFrom: '',
    birthTo: '',
    book: '',
    borrowStatus: 'ALL',
    emailVerified: 'all',
    enabled: 'all',
  },
  page: 1,
  sort: 'createdAt,desc',
};

/** Lưu lại thao tác tìm kiếm trong tab để back/F5 khôi phục bảng, không lưu thông tin xác thực. */
export function readMemberListState(): MemberListViewState {
  if (typeof window === 'undefined') return DEFAULT_MEMBER_LIST_STATE;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_MEMBER_LIST_STATE;
    return sanitizeState(JSON.parse(stored) as unknown);
  } catch {
    return DEFAULT_MEMBER_LIST_STATE;
  }
}

export function saveMemberListState(state: MemberListViewState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
  } catch {
    // Tìm kiếm vẫn dùng được khi trình duyệt chặn sessionStorage.
  }
}

export function clearMemberListState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Token vẫn được xóa bởi AuthContext nếu sessionStorage không khả dụng.
  }
}

/** Dạng ISO cho phép so sánh ngày theo thứ tự, chặn khoảng sinh đảo trước khi gửi API. */
export function isValidBirthRange(birthFrom: string, birthTo: string): boolean {
  return !birthFrom || !birthTo || birthFrom <= birthTo;
}

export function buildMemberListQuery(
  filters: MemberListFilters,
  page: number,
  sort: string,
): MemberListQuery {
  const query: MemberListQuery = {
    page: Math.max(0, Math.floor(page) - 1),
    size: PAGE_SIZE,
    sort: SORT_OPTIONS.has(sort) ? sort : DEFAULT_MEMBER_LIST_STATE.sort,
  };
  for (const field of ['fullName', 'memberCode', 'email', 'phone', 'birthFrom', 'birthTo', 'book'] as const) {
    const value = filters[field].trim();
    if (value) query[field] = value;
  }
  if (filters.borrowStatus !== 'ALL') query.borrowStatus = filters.borrowStatus;
  if (filters.emailVerified !== 'all') query.emailVerified = filters.emailVerified === 'true';
  if (filters.enabled !== 'all') query.enabled = filters.enabled === 'true';
  return query;
}

function sanitizeState(value: unknown): MemberListViewState {
  if (!isRecord(value)) return DEFAULT_MEMBER_LIST_STATE;
  const rawFilters = isRecord(value.filters) ? value.filters : {};
  const filters = { ...DEFAULT_MEMBER_LIST_STATE.filters };
  for (const field of ['fullName', 'memberCode', 'email', 'phone', 'book'] as const) {
    if (typeof rawFilters[field] === 'string') filters[field] = rawFilters[field].slice(0, 255);
  }
  for (const field of ['birthFrom', 'birthTo'] as const) {
    if (typeof rawFilters[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawFilters[field])) {
      filters[field] = rawFilters[field];
    }
  }
  if (rawFilters.borrowStatus === 'ALL' || rawFilters.borrowStatus === 'BORROWED'
      || rawFilters.borrowStatus === 'RETURNED') {
    filters.borrowStatus = rawFilters.borrowStatus;
  }
  if (rawFilters.emailVerified === 'all' || rawFilters.emailVerified === 'true'
      || rawFilters.emailVerified === 'false') {
    filters.emailVerified = rawFilters.emailVerified;
  }
  if (rawFilters.enabled === 'all' || rawFilters.enabled === 'true' || rawFilters.enabled === 'false') {
    filters.enabled = rawFilters.enabled;
  }
  return {
    filters,
    page: Number.isInteger(value.page) && Number(value.page) >= 1 ? Math.min(Number(value.page), 1_000_000) : 1,
    sort: typeof value.sort === 'string' && SORT_OPTIONS.has(value.sort)
      ? value.sort : DEFAULT_MEMBER_LIST_STATE.sort,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
