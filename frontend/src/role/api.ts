import { apiClient } from '../auth/api';
import type { ApiEnvelope } from '../auth/types';
import type {
  PermissionCatalogEntry,
  RolePermissionDelta,
  RolePermissions,
  RoleSummary,
} from './types';

function readRequiredData<T>(envelope: ApiEnvelope<T>, code: string): T {
  if (!envelope.success || envelope.code !== code || envelope.data === null) {
    throw new Error('Phản hồi quản lý vai trò không hợp lệ.');
  }
  return envelope.data;
}

export const roleApi = {
  async getRoles(): Promise<RoleSummary[]> {
    const response = await apiClient.get<ApiEnvelope<RoleSummary[]>>('/api/v1/roles');
    return readRequiredData(response.data, 'ROLE_LIST_SUCCESS');
  },

  async getPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
    const response = await apiClient.get<ApiEnvelope<PermissionCatalogEntry[]>>('/api/v1/permissions');
    return readRequiredData(response.data, 'PERMISSION_LIST_SUCCESS');
  },

  async getRolePermissions(roleCode: string): Promise<RolePermissions> {
    const response = await apiClient.get<ApiEnvelope<RolePermissions>>(
      `/api/v1/roles/${encodeURIComponent(roleCode)}/permissions`,
    );
    return readRequiredData(response.data, 'ROLE_PERMISSIONS_SUCCESS');
  },

  async updatePermissions(roleCode: string, delta: RolePermissionDelta): Promise<RolePermissions> {
    const response = await apiClient.patch<ApiEnvelope<RolePermissions>>(
      `/api/v1/roles/${encodeURIComponent(roleCode)}/permissions`,
      delta,
    );
    return readRequiredData(response.data, 'ROLE_PERMISSIONS_UPDATED');
  },
};
