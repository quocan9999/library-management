import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
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

/**
 * Trích xuất refreshToken từ header set-cookie (nếu có)
 */
export function extractRefreshTokenFromCookieHeader(setCookieHeader?: string | string[]): string | null {
  if (!setCookieHeader) return null;
  const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookieStr of cookieStrings) {
    const match = cookieStr.match(/refreshToken=([^;]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Event listener cho việc hủy phiên khi refresh thất bại
type SessionExpiredListener = () => void;
const sessionExpiredListeners: SessionExpiredListener[] = [];

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.push(listener);
  return () => {
    const idx = sessionExpiredListeners.indexOf(listener);
    if (idx !== -1) sessionExpiredListeners.splice(idx, 1);
  };
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignored
    }
  });
}

// Request interceptor: tự động gắn Bearer Token và Cookie (nếu gọi refresh/logout)
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getToken();
      if (token && config.headers && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Nếu gọi endpoint /auth/refresh hoặc /auth/logout thì gắn header Cookie chứa refreshToken
      const isAuthRefreshOrLogout =
        config.url?.includes('/api/v1/auth/refresh') || config.url?.includes('/api/v1/auth/logout');
      if (isAuthRefreshOrLogout && config.headers && !config.headers.Cookie) {
        const refreshToken = await storage.getRefreshToken();
        if (refreshToken) {
          config.headers.Cookie = `refreshToken=${refreshToken}`;
        }
      }
    } catch {
      // Ignore token read error
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Quản lý mutex/promise refresh để tránh race condition
let refreshInFlightPromise: Promise<string> | null = null;

async function doRefreshToken(): Promise<string> {
  const currentRefreshToken = await storage.getRefreshToken();
  if (!currentRefreshToken) {
    throw new Error('Không có refresh token');
  }

  const response = await axios.post<{
    success: boolean;
    data: {
      accessToken: string;
      tokenType: string;
      accessTokenExpiresIn: number;
    };
  }>(
    `${getBaseUrl()}/api/v1/auth/refresh`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `refreshToken=${currentRefreshToken}`,
      },
    }
  );

  const newAccessToken = response.data?.data?.accessToken;
  if (!newAccessToken) {
    throw new Error('Phản hồi làm mới token không hợp lệ');
  }

  // Cập nhật accessToken mới vào SecureStore
  await storage.saveToken(newAccessToken);

  // Nếu backend trả Set-Cookie mới thì cập nhật refreshToken
  const newSetCookie = response.headers?.['set-cookie'];
  const newRefreshToken = extractRefreshTokenFromCookieHeader(newSetCookie);
  if (newRefreshToken) {
    await storage.saveRefreshToken(newRefreshToken);
  }

  return newAccessToken;
}

// Response interceptor: Lưu cookie và tự động refresh token khi gặp 401 AUTH_TOKEN_EXPIRED
api.interceptors.response.use(
  async (response) => {
    // Tự động kiểm tra và lưu refreshToken nếu backend trả về set-cookie
    const setCookie = response.headers?.['set-cookie'];
    const refreshToken = extractRefreshTokenFromCookieHeader(setCookie);
    if (refreshToken) {
      await storage.saveRefreshToken(refreshToken);
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const resData = error.response?.data;
    const errorCode = resData?.code || resData?.errorCode;
    const status = error.response?.status;

    // Kiểm tra nếu là lỗi Access Token hết hạn
    const isTokenExpired = status === 401 && (errorCode === 'AUTH_TOKEN_EXPIRED' || errorCode === 'TOKEN_EXPIRED');
    const isRefreshEndpoint = originalRequest?.url?.includes('/api/v1/auth/refresh');

    if (isTokenExpired && originalRequest && !originalRequest._retry && !isRefreshEndpoint) {
      originalRequest._retry = true;

      try {
        if (!refreshInFlightPromise) {
          refreshInFlightPromise = doRefreshToken().finally(() => {
            refreshInFlightPromise = null;
          });
        }

        const newAccessToken = await refreshInFlightPromise;

        // Cập nhật header Authorization cho request gốc và thử lại
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        // Refresh token cũng đã hết hạn hoặc bị thu hồi -> Dọn dẹp phiên và báo hết hạn
        await storage.clearAuth();
        notifySessionExpired();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
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
