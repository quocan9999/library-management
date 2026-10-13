import { z } from 'zod';
import { emailSchema } from '../auth/registerSchema';

export function createChangeEmailSchema(currentEmail: string) {
  return z.object({
    newEmail: emailSchema,
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  }).superRefine(({ newEmail }, context) => {
    if (newEmail === currentEmail.trim().toLowerCase()) {
      context.addIssue({
        code: 'custom',
        path: ['newEmail'],
        message: 'Email mới phải khác email hiện tại.',
      });
    }
  });
}

export const changeEmailCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Mã xác thực phải gồm đúng 6 chữ số.'),
});

export type ChangeEmailFormInput = z.input<ReturnType<typeof createChangeEmailSchema>>;
export type ChangeEmailFormValues = z.output<ReturnType<typeof createChangeEmailSchema>>;
