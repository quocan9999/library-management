export interface RoleSummary {
  code: string;
  description: string;
  version: number;
  canEdit: boolean;
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
