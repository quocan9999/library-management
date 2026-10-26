import { apiClient } from '../auth/api';
import type { ApiEnvelope } from '../auth/types';

export interface ChangePasswordCredentials {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
  currentPassword: string;
}

export interface UserProfile {
  accountId: number;
  username: string | null;
  email: string;
  role: string;
  memberId: number | null;
  memberCode: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  address: string | null;
  version: number | null;
}

export interface UpdateUserProfileRequest {
  version: number;
  fullName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  address?: string | null;
}

export const profileApi = {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<ApiEnvelope<UserProfile>>('/api/v1/profile');
    if (!response.data.data) {
      throw new Error('Dữ liệu hồ sơ không hợp lệ.');
    }
    return response.data.data;
  },
  async updateProfile(request: UpdateUserProfileRequest): Promise<UserProfile> {
    const response = await apiClient.patch<ApiEnvelope<UserProfile>>('/api/v1/profile', request);
    if (!response.data.data) {
      throw new Error('Cập nhật hồ sơ thất bại.');
    }
    return response.data.data;
  },
  async changePassword(credentials: ChangePasswordCredentials): Promise<void> {
    await apiClient.post<ApiEnvelope<null>>('/api/v1/profile/change-password', credentials);
  },
  async requestEmailChange(request: ChangeEmailRequest): Promise<void> {
    await apiClient.post<ApiEnvelope<null>>('/api/v1/profile/change-email/request', request);
  },
  async verifyEmailChange(request: { code: string }): Promise<void> {
    await apiClient.post<ApiEnvelope<null>>('/api/v1/profile/change-email/verify', request);
  },
};
