/**
 * Chuẩn xác thực Email & Mật khẩu đồng bộ 100% với Web frontend (registerSchema / Zod)
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * Kiểm tra tính hợp lệ của địa chỉ email
 * @returns Thông báo lỗi cụ thể hoặc null nếu hợp lệ
 */
export const validateEmail = (email: string): string | null => {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Vui lòng nhập địa chỉ email.';
  }
  if (trimmed.length > 255) {
    return 'Email không được vượt quá 255 ký tự.';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Vui lòng nhập địa chỉ email hợp lệ.';
  }
  return null;
};
