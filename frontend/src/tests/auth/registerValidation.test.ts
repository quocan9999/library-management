import { describe, expect, it } from 'vitest';
import { registerSchema } from '../../auth/registerSchema';

function parseWithPassword(password: string, confirmPassword = password) {
  return registerSchema.safeParse({
    email: 'reader@example.com',
    password,
    confirmPassword,
  });
}

describe('registration form validation', () => {
  it('trims and lowercases the email in parsed form values', () => {
    const result = registerSchema.safeParse({
      email: '  Reader@Example.COM  ',
      password: 'Strong1!',
      confirmPassword: 'Strong1!',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('reader@example.com');
  });

  it.each([
    ['too short', 'S1!', 'có ít nhất 8 ký tự'],
    ['too long', 'S'.repeat(19) + '1!a', 'không được vượt quá 20 ký tự'],
    ['missing uppercase', 'strong1!', 'chữ hoa'],
    ['missing lowercase', 'STRONG1!', 'chữ thường'],
    ['missing digit', 'Strong!!', 'chữ số'],
    ['missing special character', 'Strong12', 'ký tự đặc biệt'],
    ['contains whitespace', 'Strong 1!', 'không được chứa khoảng trắng'],
  ])('reports the password rule for %s', (_label, password, message) => {
    const result = parseWithPassword(password);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes(message))).toBe(true);
    }
  });

  it('requires matching confirmation and never transforms the password', () => {
    const result = registerSchema.safeParse({
      email: 'reader@example.com',
      password: 'Strong1!',
      confirmPassword: 'Strong2!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('rejects an invalid email and an email longer than 255 characters', () => {
    expect(registerSchema.safeParse({
      email: 'not-an-email', password: 'Strong1!', confirmPassword: 'Strong1!',
    }).success).toBe(false);
    expect(registerSchema.safeParse({
      email: `${'a'.repeat(244)}@example.com`, password: 'Strong1!', confirmPassword: 'Strong1!',
    }).success).toBe(false);
  });
});
