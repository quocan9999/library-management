import { api } from '@/services/api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName?: string;
  permissions: string[];
}

export interface LoginResponseData {
  accessToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
}

export interface RegisterResponseData {
  email: string;
  emailVerificationRequired: boolean;
}

export interface ApiResponse<T> {
  statusCode: number;
  errorCode: string;
  message: string;
  data: T;
}

export const authService = {
  async login(identifier: string, password: string): Promise<LoginResponseData> {
    const res = await api.post<ApiResponse<LoginResponseData>>('/api/v1/auth/login', {
      identifier: identifier.trim(),
      password,
    });
    return res.data.data;
  },

  async register(email: string, password: string): Promise<RegisterResponseData> {
    const res = await api.post<ApiResponse<RegisterResponseData>>('/api/v1/auth/register', {
      email: email.trim().toLowerCase(),
      password,
    });
    return res.data.data;
  },

  async forgotPassword(email: string): Promise<string> {
    const res = await api.post<ApiResponse<void>>('/api/v1/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
    return res.data.message;
  },

  async resetPassword(
    token: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<string> {
    const res = await api.post<ApiResponse<void>>('/api/v1/auth/reset-password', {
      token: token.trim(),
      newPassword,
      confirmNewPassword,
    });
    return res.data.message;
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/api/v1/auth/me');
    return res.data.data;
  },

  async resendVerification(email: string): Promise<string> {
    const res = await api.post<ApiResponse<void>>('/api/v1/auth/resend-verification', {
      email: email.trim().toLowerCase(),
    });
    return res.data.message;
  },
};
