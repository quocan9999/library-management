import axios from 'axios';
import type { ApiEnvelope } from '../auth/types';

export type ChangePasswordFieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'confirmNewPassword', string>
>;

export function mapChangePasswordValidationErrors(error: unknown): ChangePasswordFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const validation = error.response?.data;
  if (validation?.code === 'CURRENT_PASSWORD_INVALID') {
    return { currentPassword: 'Mật khẩu hiện tại không chính xác.' };
  }
  if (validation?.code !== 'VALIDATION_ERROR' || !validation.errors) return null;

  const mapped: ChangePasswordFieldErrors = {};
  if (validation.errors.currentPassword) mapped.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
  if (validation.errors.newPassword) {
    mapped.newPassword = validation.errors.newPassword.includes('phải khác')
      ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
      : 'Mật khẩu chưa đáp ứng yêu cầu.';
  }
  if (validation.errors.confirmNewPassword) mapped.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
  return Object.keys(mapped).length > 0 ? mapped : null;
}

export function getChangePasswordError(error: unknown): string {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.';
  }
  if (!error.response) return 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau.';
  if (error.response.data?.code === 'CURRENT_PASSWORD_INVALID') {
    return 'Mật khẩu hiện tại không chính xác.';
  }
  if (error.response.status === 500 || error.response.status === 503) {
    return 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';
  }
  return 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.';
}
