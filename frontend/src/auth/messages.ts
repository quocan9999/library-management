import axios from 'axios';
import type { ApiEnvelope } from './types';

const SERVICE_NOT_READY = 'Hệ thống hiện chưa sẵn sàng. Vui lòng thử lại sau ít phút.';
const TEMPORARY_SYSTEM_FAILURE = 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';

export interface LoginErrorCopy {
  title: string;
  description: string;
  code?: string;
}

export type LoginFieldErrors = Partial<Record<'identifier' | 'password', string>>;
export type RegisterFieldErrors = Partial<Record<'email' | 'password', string>>;
export type ResendFieldErrors = Partial<Record<'email', string>>;
export type ForgotPasswordFieldErrors = Partial<Record<'email', string>>;
export type ResetPasswordFieldErrors = Partial<Record<'newPassword' | 'confirmNewPassword', string>>;
export type VerificationErrorState = 'invalid' | 'expired' | 'used' | 'revoked' | 'unavailable';
export type PasswordResetErrorState = 'invalid' | 'unavailable';

export interface ResendErrorCopy {
  title: string;
  description: string;
  retryAfterSeconds?: number;
}

export interface ForgotPasswordErrorCopy {
  title: string;
  description: string;
  retryAfterSeconds?: number;
}

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
    case 'EMAIL_NOT_VERIFIED':
      return {
        title: 'Email chưa được xác thực',
        description: 'Hãy xác thực email trước khi đăng nhập. Vui lòng kiểm tra hộp thư và thư spam.',
        code: 'EMAIL_NOT_VERIFIED',
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

export function getRegisterError(error: unknown): LoginErrorCopy {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return {
      title: 'Không thể đăng ký',
      description: 'Không thể hoàn tất đăng ký lúc này. Vui lòng thử lại.',
    };
  }

  const response = error.response;
  if (!response) {
    return { title: 'Không thể kết nối đến hệ thống', description: SERVICE_NOT_READY };
  }
  if (response.status === 500 || response.status === 503) {
    return { title: 'Không thể đăng ký', description: TEMPORARY_SYSTEM_FAILURE };
  }

  switch (response.data?.code) {
    case 'EMAIL_ALREADY_REGISTERED':
      return {
        title: 'Email đã được đăng ký',
        description: 'Email này đã được đăng ký. Vui lòng đăng nhập.',
        code: 'EMAIL_ALREADY_REGISTERED',
      };
    case 'EMAIL_NOT_VERIFIED_REGISTERED':
      return {
        title: 'Email chưa được xác thực',
        description: 'Email này đã đăng ký nhưng chưa xác thực. Bạn có thể yêu cầu gửi lại hướng dẫn.',
        code: 'EMAIL_NOT_VERIFIED_REGISTERED',
      };
    case 'VALIDATION_ERROR':
      return {
        title: 'Thông tin đăng ký chưa hợp lệ',
        description: 'Vui lòng kiểm tra lại email và mật khẩu.',
      };
    default:
      return {
        title: 'Không thể đăng ký',
        description: 'Không thể hoàn tất đăng ký lúc này. Vui lòng thử lại.',
      };
  }
}

export function mapRegisterValidationErrors(error: unknown): RegisterFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const validation = error.response?.data;
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors) return null;

  const mapped: RegisterFieldErrors = {};
  if (validation.errors.email) mapped.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (validation.errors.password) mapped.password = 'Mật khẩu chưa đáp ứng yêu cầu.';
  return Object.keys(mapped).length > 0 ? mapped : null;
}

export function mapResendValidationErrors(error: unknown): ResendFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const validation = error.response?.data;
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors?.email) return null;
  return { email: 'Vui lòng nhập địa chỉ email hợp lệ.' };
}

export function mapForgotPasswordValidationErrors(error: unknown): ForgotPasswordFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const validation = error.response?.data;
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors?.email) return null;
  return { email: 'Vui lòng nhập địa chỉ email hợp lệ.' };
}

export function getForgotPasswordError(error: unknown): ForgotPasswordErrorCopy {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return { title: 'Không thể gửi yêu cầu', description: 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.' };
  }

  const response = error.response;
  if (!response) return { title: 'Không thể kết nối đến hệ thống', description: SERVICE_NOT_READY };
  if (response.status === 429) {
    const headers = response.headers as Record<string, unknown> | undefined;
    const rawRetryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
    const retryAfterSeconds = Number.parseInt(String(rawRetryAfter ?? ''), 10);
    return {
      title: 'Bạn đã gửi quá nhiều yêu cầu',
      description: 'Vui lòng chờ một lúc trước khi gửi yêu cầu khác.',
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? Math.max(1, retryAfterSeconds) : 60,
    };
  }
  if (response.status === 500 || response.status === 503) {
    return { title: 'Không thể gửi yêu cầu', description: TEMPORARY_SYSTEM_FAILURE };
  }
  return { title: 'Không thể gửi yêu cầu', description: 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.' };
}

export function mapResetPasswordValidationErrors(error: unknown): ResetPasswordFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const validation = error.response?.data;
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors) return null;
  const mapped: ResetPasswordFieldErrors = {};
  if (validation.errors.newPassword) {
    mapped.newPassword = validation.errors.newPassword === 'Mật khẩu mới phải khác mật khẩu hiện tại'
      ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
      : 'Mật khẩu chưa đáp ứng yêu cầu.';
  }
  if (validation.errors.confirmNewPassword) mapped.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
  return Object.keys(mapped).length > 0 ? mapped : null;
}

export function getPasswordResetError(error: unknown): PasswordResetErrorState {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return 'unavailable';
  return error.response?.data?.code === 'PASSWORD_RESET_TOKEN_INVALID' ? 'invalid' : 'unavailable';
}

export function getResendError(error: unknown): ResendErrorCopy {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return {
      title: 'Không thể gửi yêu cầu',
      description: 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.',
    };
  }

  const response = error.response;
  if (!response) return { title: 'Không thể kết nối đến hệ thống', description: SERVICE_NOT_READY };
  if (response.status === 429) {
    const headers = response.headers as Record<string, unknown> | undefined;
    const rawRetryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
    const retryAfterSeconds = Number.parseInt(String(rawRetryAfter ?? ''), 10);
    return {
      title: 'Bạn đã gửi quá nhiều yêu cầu',
      description: 'Vui lòng chờ trước khi thử gửi lại email xác thực.',
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? Math.max(1, retryAfterSeconds) : 60,
    };
  }
  if (response.status === 500 || response.status === 503) {
    return { title: 'Không thể gửi yêu cầu', description: TEMPORARY_SYSTEM_FAILURE };
  }
  return {
    title: 'Không thể gửi yêu cầu',
    description: 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.',
  };
}

export function getVerificationError(error: unknown): VerificationErrorState {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return 'unavailable';
  switch (error.response?.data?.code) {
    case 'VERIFICATION_TOKEN_INVALID': return 'invalid';
    case 'VERIFICATION_TOKEN_EXPIRED': return 'expired';
    case 'VERIFICATION_TOKEN_USED': return 'used';
    case 'VERIFICATION_TOKEN_REVOKED': return 'revoked';
    default: return 'unavailable';
  }
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
