export const REGISTRATION_EMAIL_KEY = 'registrationEmail';

export function saveRegistrationEmail(email: string): void {
  try {
    window.sessionStorage.setItem(REGISTRATION_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    // Lưu email chỉ hỗ trợ hiển thị lại trên trang; tiếp tục luồng nếu storage không dùng được.
  }
}

export function readRegistrationEmail(): string | null {
  try {
    return window.sessionStorage.getItem(REGISTRATION_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function clearRegistrationEmail(): void {
  try {
    window.sessionStorage.removeItem(REGISTRATION_EMAIL_KEY);
  } catch {
    // Không để lỗi storage làm sai trạng thái xác thực đã nhận từ server.
  }
}
