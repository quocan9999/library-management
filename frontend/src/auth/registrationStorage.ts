export const REGISTRATION_EMAIL_KEY = 'registrationEmail';
const REGISTRATION_COOLDOWN_KEY = 'registrationCooldownUntil';

export function saveRegistrationEmail(email: string, cooldownSeconds = 0): void {
  try {
    window.sessionStorage.setItem(REGISTRATION_EMAIL_KEY, email.trim().toLowerCase());
    if (cooldownSeconds > 0) {
      window.sessionStorage.setItem(REGISTRATION_COOLDOWN_KEY, String(Date.now() + cooldownSeconds * 1000));
    } else {
      window.sessionStorage.removeItem(REGISTRATION_COOLDOWN_KEY);
    }
  } catch {
    // Lưu email chỉ hỗ trợ hiển thị lại trên trang; tiếp tục luồng nếu storage không dùng được.
  }
}

export function readRegistrationCooldownSeconds(): number {
  try {
    const deadline = Number(window.sessionStorage.getItem(REGISTRATION_COOLDOWN_KEY));
    return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
  } catch {
    return 0;
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
    window.sessionStorage.removeItem(REGISTRATION_COOLDOWN_KEY);
  } catch {
    // Không để lỗi storage làm sai trạng thái xác thực đã nhận từ server.
  }
}
