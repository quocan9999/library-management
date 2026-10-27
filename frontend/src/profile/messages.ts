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
  if (error.response.status === 503 && error.response.data?.code === 'MAINTENANCE_MODE_ACTIVE') {
    return 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.';
  }
  if (error.response.data?.code === 'CURRENT_PASSWORD_INVALID') {
    return 'Mật khẩu hiện tại không chính xác.';
  }
  if (error.response.status === 500 || error.response.status === 503) {
    return 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';
  }
  return 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.';
}

export type ProfileFieldErrors = Partial<
  Record<'fullName' | 'dateOfBirth' | 'phone' | 'address', string>
>;

export function mapProfileValidationErrors(error: unknown): ProfileFieldErrors | null {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) return null;
  const data = error.response?.data;
  if (data?.code === 'MEMBER_PHONE_DUPLICATED') {
    return { phone: 'Số điện thoại này đã được sử dụng bởi thành viên khác.' };
  }
  if (data?.code === 'MEMBER_PATCH_VALIDATION_ERROR' && data.errors) {
    return data.errors as ProfileFieldErrors;
  }
  if (data?.code === 'VALIDATION_ERROR' && data.errors) {
    return data.errors as ProfileFieldErrors;
  }
  return null;
}

export function getProfileUpdateError(error: unknown): string {
  if (!axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return 'Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại.';
  }
  if (!error.response) return 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau.';
  if (error.response.status === 503 && error.response.data?.code === 'MAINTENANCE_MODE_ACTIVE') {
    return 'Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.';
  }
  const code = error.response.data?.code;
  if (code === 'MEMBER_VERSION_CONFLICT') {
    return 'Dữ liệu hồ sơ đã được thay đổi từ một phiên làm việc khác. Vui lòng tải lại trang để xem thông tin mới nhất.';
  }
  if (code === 'MEMBER_PHONE_DUPLICATED') {
    return 'Số điện thoại này đã được sử dụng bởi thành viên khác.';
  }
  if (error.response.status === 500 || error.response.status === 503) {
    return 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';
  }
  return error.response.data?.message || 'Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại.';
}
