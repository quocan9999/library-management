export interface RoleSummary {
  code: string;
  description: string;
  version: number;
  canEdit: boolean;
  displayName?: string;
  enabled?: boolean;
}

export interface RoleSearchItem {
  code: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  version: number;
  systemRole: boolean;
  accountCount: number;
  permissionCount: number;
  createdAt: string | null;
  canEdit: boolean;
}

export interface RoleDetailResponse extends RoleSearchItem {
  readOnly: boolean;
}

export interface RoleSearchPage {
  content: RoleSearchItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface RoleSearchQuery {
  q?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  page: number;
  size: number;
  sort?: string;
  direction?: 'ASC' | 'DESC';
}

export interface RoleCreateRequest {
  code: string;
  displayName: string;
  description: string;
  permissions: string[];
}

export interface RoleMetadataUpdateRequest {
  expectedVersion: number;
  displayName: string;
  description: string;
}

export interface RoleStatusUpdateRequest {
  expectedVersion: number;
  enabled: boolean;
}

export interface PermissionCatalogEntry {
  code: string;
  description: string;
  manageableByActor: boolean;
  dependencies?: string[];
}

export interface RolePermissions {
  roleCode: string;
  version: number;
  assignedPermissions: string[];
  effectivePermissions: string[];
  editablePermissions: string[];
  editable: boolean;
}

export interface RolePermissionDelta {
  expectedVersion: number;
  addPermissions: string[];
  removePermissions: string[];
}
