import { apiClient } from '../auth/api';
import type { ApiEnvelope } from '../auth/types';

export interface ChangePasswordCredentials {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export const profileApi = {
  async changePassword(credentials: ChangePasswordCredentials): Promise<void> {
    await apiClient.post<ApiEnvelope<null>>('/api/v1/profile/change-password', credentials);
  },
};
