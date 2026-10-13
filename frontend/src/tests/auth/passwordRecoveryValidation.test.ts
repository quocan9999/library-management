import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema, resetPasswordSchema } from '../../auth/passwordRecoverySchema';

describe('password recovery validation', () => {
  it('normalizes a forgot-password email like registration', () => {
    expect(forgotPasswordSchema.parse({ email: ' Reader@Example.COM ' })).toEqual({
      email: 'reader@example.com',
    });
  });

  it('uses the registration password policy and points confirmation errors at its field', () => {
    expect(resetPasswordSchema.safeParse({ newPassword: 'weak', confirmNewPassword: 'weak' }).success).toBe(false);

    const mismatch = resetPasswordSchema.safeParse({
      newPassword: 'Strong1!',
      confirmNewPassword: 'Different2!',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0].path).toEqual(['confirmNewPassword']);
    }
  });

  it('accepts a policy-compliant password and matching confirmation', () => {
    expect(resetPasswordSchema.parse({
      newPassword: 'Fresh3!Password',
      confirmNewPassword: 'Fresh3!Password',
    })).toEqual({ newPassword: 'Fresh3!Password', confirmNewPassword: 'Fresh3!Password' });
  });
});
