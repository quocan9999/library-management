import { apiClient } from '../../auth/api';
import type { ApiEnvelope } from '../../auth/types';
import type {
  LoanHistoryItem,
  LoanHistoryQuery,
  MemberDetail,
  MemberAccountStatusInput,
  MemberCreateInput,
  MemberListItem,
  MemberListQuery,
  MemberProfilePatchInput,
  PageResponse,
} from './types';

function readRequiredData<T>(envelope: ApiEnvelope<T>, expectedCode: string): T {
  if (!envelope.success || envelope.code !== expectedCode || envelope.data === null) {
    throw new Error('Phản hồi quản lý thành viên không hợp lệ.');
  }
  return envelope.data;
}

export const memberApi = {
  async getMembers(query: MemberListQuery, signal?: AbortSignal): Promise<PageResponse<MemberListItem>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<MemberListItem>>>(
      '/api/v1/members',
      { params: query, signal },
    );
    return readRequiredData(response.data, 'MEMBER_LIST_SUCCESS');
  },

  async getMember(id: number, signal?: AbortSignal): Promise<MemberDetail> {
    const response = await apiClient.get<ApiEnvelope<MemberDetail>>(
      `/api/v1/members/${id}`,
      { signal },
    );
    return readRequiredData(response.data, 'MEMBER_DETAIL_SUCCESS');
  },

  async patchProfile(id: number, input: MemberProfilePatchInput): Promise<MemberDetail> {
    const response = await apiClient.patch<ApiEnvelope<MemberDetail>>(
      `/api/v1/members/${id}`,
      input,
    );
    return readRequiredData(response.data, 'MEMBER_PROFILE_UPDATED');
  },

  async updateAccountStatus(id: number, input: MemberAccountStatusInput): Promise<MemberDetail> {
    const response = await apiClient.patch<ApiEnvelope<MemberDetail>>(
      `/api/v1/members/${id}/account-status`,
      input,
    );
    return readRequiredData(response.data, 'MEMBER_ACCOUNT_STATUS_UPDATED');
  },

  async createMember(input: MemberCreateInput): Promise<MemberDetail> {
    const response = await apiClient.post<ApiEnvelope<MemberDetail>>('/api/v1/members', input);
    return readRequiredData(response.data, 'MEMBER_CREATED');
  },

  async deleteMember(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/members/${id}`);
  },

  async getLoanHistory(
    id: number,
    query: LoanHistoryQuery,
    signal?: AbortSignal,
  ): Promise<PageResponse<LoanHistoryItem>> {
    const response = await apiClient.get<ApiEnvelope<PageResponse<LoanHistoryItem>>>(
      `/api/v1/members/${id}/loan-history`,
      { params: query, signal },
    );
    return readRequiredData(response.data, 'MEMBER_LOAN_HISTORY_SUCCESS');
  },
};
