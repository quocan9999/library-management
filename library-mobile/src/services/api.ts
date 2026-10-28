import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';

import { storage } from '@/utils/storage';

export const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    if (Platform.OS === 'android' && envUrl.includes('localhost')) {
      return envUrl.replace('localhost', '10.0.2.2');
    }
    return envUrl;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8081' : 'http://localhost:8081';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore token read error
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface ApiErrorResponse {
  success?: boolean;
  code?: string;
  statusCode?: number;
  errorCode?: string;
  message?: string;
  errors?: Record<string, string>;
  data?: any;
}

  export const extractErrorMessage = (error: unknown, defaultMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      const resData = axiosError.response?.data;
      const serverMessage = resData?.message;
      if (serverMessage) {
        return serverMessage;
      }
      const code = resData?.code || resData?.errorCode;
      if (code === 'CURRENT_PASSWORD_INVALID') {
        return 'Mật khẩu hiện tại không chính xác.';
      }
      if (code === 'EMAIL_ALREADY_REGISTERED') {
        return 'Email này đã được sử dụng bởi tài khoản khác.';
      }
      if (code === 'EMAIL_CHANGE_CODE_INVALID') {
        return 'Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.';
      }
      if (code === 'EMAIL_CHANGE_RATE_LIMITED') {
        return 'Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.';
      }
      if (code === 'MAINTENANCE_MODE_ACTIVE') {
        return 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.';
      }
      if (axiosError.code === 'ECONNABORTED') {
        return 'Kết nối máy chủ quá thời gian. Vui lòng thử lại.';
      }
      if (!axiosError.response) {
        return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc backend.';
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return defaultMessage;
  };
