import { api, extractErrorMessage } from './api';

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

export interface ChangePasswordCredentials {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
  currentPassword: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await api.get<ApiEnvelope<UserProfile>>('/api/v1/profile');
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể lấy thông tin hồ sơ.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải thông tin hồ sơ.'));
    }
  },

  async updateProfile(request: UpdateUserProfileRequest): Promise<UserProfile> {
    try {
      const response = await api.patch<ApiEnvelope<UserProfile>>('/api/v1/profile', request);
      if (!response.data.data) {
        throw new Error(response.data.message || 'Không thể cập nhật hồ sơ.');
      }
      return response.data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Cập nhật thông tin thất bại.'));
    }
  },

  async changePassword(credentials: ChangePasswordCredentials): Promise<void> {
    try {
      const response = await api.post<ApiEnvelope<null>>('/api/v1/profile/change-password', credentials);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Không thể đổi mật khẩu.');
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đổi mật khẩu thất bại.'));
    }
  },

  async requestChangeEmail(request: ChangeEmailRequest): Promise<void> {
    try {
      const response = await api.post<ApiEnvelope<null>>('/api/v1/profile/change-email/request', request);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Không thể gửi mã xác thực đổi email.');
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Gửi yêu cầu đổi email thất bại.'));
    }
  },

  async verifyChangeEmail(code: string): Promise<void> {
    try {
      const response = await api.post<ApiEnvelope<null>>('/api/v1/profile/change-email/verify', { code });
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Mã xác thực không hợp lệ.');
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xác thực đổi email thất bại.'));
    }
  },
};
