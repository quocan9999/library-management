import type { PermissionCatalogEntry } from './types';

export interface PermissionDependencyIssue {
  permission: string;
  dependency: string;
}

/** Đọc quan hệ từ permission catalog của backend để UI không tự duy trì một bộ luật khác. */
export function requiredPermissionsFor(
  permissionCode: string,
  catalog: PermissionCatalogEntry[],
): string[] {
  const dependenciesByCode = new Map(
    catalog.map((permission) => [permission.code, permission.dependencies ?? []]),
  );
  const required = new Set<string>();
  const completed = new Set<string>();
  const visiting = new Set<string>();

  const visit = (code: string) => {
    if (visiting.has(code)) {
      throw new Error(`Vòng phụ thuộc quyền tại ${code}.`);
    }
    if (completed.has(code)) return;
    visiting.add(code);
    for (const dependency of dependenciesByCode.get(code) ?? []) {
      if (!dependenciesByCode.has(dependency)) {
        throw new Error(`Danh mục không có quyền phụ thuộc ${dependency}.`);
      }
      required.add(dependency);
      visit(dependency);
    }
    visiting.delete(code);
    completed.add(code);
  };

  visit(permissionCode);
  return [...required].sort();
}

export function validatePermissionDependencyCatalog(catalog: PermissionCatalogEntry[]): string | null {
  try {
    for (const permission of catalog) requiredPermissionsFor(permission.code, catalog);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Danh mục phụ thuộc quyền không hợp lệ.';
  }
}

export function findMissingPermissionDependencies(
  selectedPermissions: Set<string>,
  catalog: PermissionCatalogEntry[],
): PermissionDependencyIssue[] {
  const selectedDependencies = new Map(
    catalog.map((permission) => [permission.code, permission.dependencies ?? []]),
  );
  return [...selectedPermissions].flatMap((permission) =>
    (selectedDependencies.get(permission) ?? [])
      .filter((dependency) => !selectedPermissions.has(dependency))
      .map((dependency) => ({ permission, dependency })),
  ).sort((left, right) => `${left.permission}:${left.dependency}`.localeCompare(`${right.permission}:${right.dependency}`));
}
