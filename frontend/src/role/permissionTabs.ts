import type { PermissionCatalogEntry } from './types';

export const USER_PERMISSION_CODES = new Set<string>([
  'account:change-password',
  'account:change-email',
  'book:read',
  'borrow:create',
  'borrow:read-own',
  'borrow:cancel-own',
  'borrow:renew',
]);

export function isUserPermission(code: string): boolean {
  return USER_PERMISSION_CODES.has(code);
}

export function isAdminPermission(code: string): boolean {
  if (code === 'book:read') return true;
  return !USER_PERMISSION_CODES.has(code);
}

export const GROUP_LABELS: Record<string, string> = {
  account: 'Tài khoản',
  book: 'Sách',
  borrow: 'Mượn trả',
  member: 'Thành viên',
  role: 'Vai trò',
  config: 'Nhóm config',
};

export function groupLabel(prefix: string): string {
  return GROUP_LABELS[prefix] ?? `Nhóm ${prefix}`;
}

export interface PermissionGroup {
  prefix: string;
  permissions: PermissionCatalogEntry[];
}

export function groupPermissionsByDomain(catalog: PermissionCatalogEntry[]): PermissionGroup[] {
  const groups = new Map<string, PermissionCatalogEntry[]>();
  for (const permission of catalog) {
    const separator = permission.code.indexOf(':');
    const prefix = separator > 0 ? permission.code.slice(0, separator) : 'other';
    groups.set(prefix, [...(groups.get(prefix) ?? []), permission]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([prefix, permissions]) => ({ prefix, permissions }));
}

export function filterCatalogForTab(
  catalog: PermissionCatalogEntry[],
  tab: 'admin' | 'user',
): PermissionGroup[] {
  const filtered = catalog.filter((permission) =>
    tab === 'user' ? isUserPermission(permission.code) : isAdminPermission(permission.code),
  );
  return groupPermissionsByDomain(filtered);
}
