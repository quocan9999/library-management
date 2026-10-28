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
  statusCode?: number;
  errorCode?: string;
  message?: string;
  data?: any;
}

export const extractErrorMessage = (error: unknown, defaultMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const serverMessage = axiosError.response?.data?.message;
    if (serverMessage) {
      return serverMessage;
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
