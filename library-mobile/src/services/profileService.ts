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
};
