import axios from 'axios';
import type { ApiEnvelope } from './types';

const SERVICE_NOT_READY = 'Hệ thống hiện chưa sẵn sàng. Vui lòng thử lại sau ít phút.';
const TEMPORARY_SYSTEM_FAILURE = 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';

export interface LoginErrorCopy {
  title: string;
  description: string;
}

export type LoginFieldErrors = Partial<Record<'identifier' | 'password', string>>;

export function getLoginError(error: unknown): LoginErrorCopy {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return {
      title: 'Không thể đăng nhập',
      description: 'Không thể đăng nhập lúc này. Vui lòng thử lại.',
    };
  }

  const response = error.response;
  if (!response) {
    return {
      title: 'Không thể kết nối đến hệ thống',
      description: SERVICE_NOT_READY,
    };
  }

  if (response.status === 500 || response.status === 503) {
    return {
      title: 'Không thể đăng nhập',
      description: TEMPORARY_SYSTEM_FAILURE,
    };
  }

  switch (response.data?.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return {
        title: 'Không thể đăng nhập',
        description: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
      };
    case 'AUTH_ACCOUNT_DISABLED':
      return {
        title: 'Không thể đăng nhập',
        description: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
      };
    case 'VALIDATION_ERROR':
      return {
        title: 'Thông tin đăng nhập chưa hợp lệ',
        description: 'Vui lòng kiểm tra lại thông tin đăng nhập.',
      };
    default:
      return {
        title: 'Không thể đăng nhập',
        description: 'Không thể đăng nhập lúc này. Vui lòng thử lại.',
      };
  }
}

export function mapLoginValidationErrors(error: unknown): LoginFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;

  const validation = error.response?.data;
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors) return null;

  const mapped: LoginFieldErrors = {};
  if (validation.errors.identifier) {
    mapped.identifier = 'Vui lòng nhập tên đăng nhập hoặc email.';
  }
  if (validation.errors.password) {
    mapped.password = 'Vui lòng nhập mật khẩu.';
  }

  return Object.keys(mapped).length > 0 ? mapped : null;
}

export function getLogoutErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    if (!error.response) return SERVICE_NOT_READY;
    if (error.response.status === 500 || error.response.status === 503) {
      return TEMPORARY_SYSTEM_FAILURE;
    }
  }

  return 'Không thể đăng xuất lúc này. Vui lòng thử lại.';
}
