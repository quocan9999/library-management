import { describe, expect, it } from 'vitest';
import { loginSchema } from '../../auth/loginSchema';

describe('login form validation', () => {
  it('requires an identifier with a Vietnamese message', () => {
    const result = loginSchema.safeParse({ identifier: '  ', password: 'valid-password' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Vui lòng nhập tên đăng nhập hoặc email.');
    }
  });

  it('requires a password with a Vietnamese message', () => {
    const result = loginSchema.safeParse({ identifier: 'reader', password: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Vui lòng nhập mật khẩu.');
    }
  });
});
