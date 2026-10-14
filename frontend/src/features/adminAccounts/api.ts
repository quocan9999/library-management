import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type {
  AdminAccount,
  AdminAccountCreateRequest,
  AdminAccountPage,
  AdminAccountRoleUpdateRequest,
  AdminAccountSearchQuery,
  AdminAccountStatusUpdateRequest,
} from './types';

function readRequiredData<T>(envelope: ApiEnvelope<T>, code: string): T {
  if (!envelope.success || envelope.code !== code || envelope.data === null) {
    throw new Error('Phản hồi quản lý tài khoản quản trị không hợp lệ.');
  }
  return envelope.data;
}

export const adminAccountApi = {
  async search(query: AdminAccountSearchQuery, signal?: AbortSignal): Promise<AdminAccountPage> {
    const response = await apiClient.get<ApiEnvelope<AdminAccountPage>>('/api/v1/admin/accounts', {
      params: query,
      signal,
    });
    return readRequiredData(response.data, 'ADMIN_ACCOUNT_SEARCH_SUCCESS');
  },

  async get(accountId: number): Promise<AdminAccount> {
    const response = await apiClient.get<ApiEnvelope<AdminAccount>>(`/api/v1/admin/accounts/${accountId}`);
    return readRequiredData(response.data, 'ADMIN_ACCOUNT_DETAIL_SUCCESS');
  },

  async create(request: AdminAccountCreateRequest): Promise<AdminAccount> {
    const response = await apiClient.post<ApiEnvelope<AdminAccount>>('/api/v1/admin/accounts', request);
    return readRequiredData(response.data, 'ADMIN_ACCOUNT_CREATED');
  },

  async updateRole(accountId: number, request: AdminAccountRoleUpdateRequest): Promise<AdminAccount> {
    const response = await apiClient.patch<ApiEnvelope<AdminAccount>>(
      `/api/v1/admin/accounts/${accountId}/role`,
      request,
    );
    return readRequiredData(response.data, 'ADMIN_ACCOUNT_ROLE_UPDATED');
  },

  async updateStatus(accountId: number, request: AdminAccountStatusUpdateRequest): Promise<AdminAccount> {
    const response = await apiClient.patch<ApiEnvelope<AdminAccount>>(
      `/api/v1/admin/accounts/${accountId}/status`,
      request,
    );
    return readRequiredData(response.data, 'ADMIN_ACCOUNT_STATUS_UPDATED');
  },
};
