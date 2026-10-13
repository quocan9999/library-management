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

export const profileApi = {
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
