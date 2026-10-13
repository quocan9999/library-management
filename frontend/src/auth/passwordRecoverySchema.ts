import { z } from 'zod';
import { emailSchema, passwordSchema } from './registerSchema';

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
}).superRefine(({ newPassword, confirmNewPassword }, context) => {
  if (confirmNewPassword && newPassword !== confirmNewPassword) {
    context.addIssue({
      code: 'custom',
      path: ['confirmNewPassword'],
      message: 'Mật khẩu xác nhận không khớp.',
    });
  }
});

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordFormValues = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordFormInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordFormValues = z.output<typeof resetPasswordSchema>;
