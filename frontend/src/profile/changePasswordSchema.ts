import { z } from 'zod';
import { passwordSchema } from '../auth/registerSchema';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
}).superRefine(({ currentPassword, newPassword, confirmNewPassword }, context) => {
  if (currentPassword && currentPassword === newPassword) {
    context.addIssue({
      code: 'custom',
      path: ['newPassword'],
      message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    });
  }
  if (confirmNewPassword && newPassword !== confirmNewPassword) {
    context.addIssue({
      code: 'custom',
      path: ['confirmNewPassword'],
      message: 'Mật khẩu xác nhận không khớp.',
    });
  }
});

export type ChangePasswordFormInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordFormValues = z.output<typeof changePasswordSchema>;
