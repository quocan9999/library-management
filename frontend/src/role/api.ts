import { apiClient } from '../auth/api';
import type { ApiEnvelope } from '../auth/types';
import type {
  PermissionCatalogEntry,
  RolePermissionDelta,
  RolePermissions,
  RoleCreateRequest,
  RoleDetailResponse,
  RoleMetadataUpdateRequest,
  RoleSearchPage,
  RoleSearchQuery,
  RoleSummary,
  RoleStatusUpdateRequest,
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

  async searchRoles(query: RoleSearchQuery, signal?: AbortSignal): Promise<RoleSearchPage> {
    const response = await apiClient.get<ApiEnvelope<RoleSearchPage>>('/api/v1/roles/search', {
      params: query,
      signal,
    });
    return readRequiredData(response.data, 'ROLE_SEARCH_SUCCESS');
  },

  async createRole(request: RoleCreateRequest): Promise<RoleDetailResponse> {
    const response = await apiClient.post<ApiEnvelope<RoleDetailResponse>>('/api/v1/roles', request);
    return readRequiredData(response.data, 'ROLE_CREATED');
  },

  async updateMetadata(roleCode: string, request: RoleMetadataUpdateRequest): Promise<RoleDetailResponse> {
    const response = await apiClient.patch<ApiEnvelope<RoleDetailResponse>>(
      `/api/v1/roles/${encodeURIComponent(roleCode)}`,
      request,
    );
    return readRequiredData(response.data, 'ROLE_UPDATED');
  },

  async updateStatus(roleCode: string, request: RoleStatusUpdateRequest): Promise<RoleDetailResponse> {
    const response = await apiClient.patch<ApiEnvelope<RoleDetailResponse>>(
      `/api/v1/roles/${encodeURIComponent(roleCode)}/status`,
      request,
    );
    return readRequiredData(response.data, 'ROLE_STATUS_UPDATED');
  },

  async getPermissionCatalog(signal?: AbortSignal): Promise<PermissionCatalogEntry[]> {
    const response = await apiClient.get<ApiEnvelope<PermissionCatalogEntry[]>>('/api/v1/permissions', { signal });
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
