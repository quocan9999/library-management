import { z } from 'zod';

export const emailSchema = z.string()
    .trim()
    .min(1, 'Vui lòng nhập địa chỉ email.')
    .max(255, 'Email không được vượt quá 255 ký tự.')
    .email('Vui lòng nhập địa chỉ email hợp lệ.')
    .transform((email) => email.toLowerCase());

export const passwordSchema = z.string()
    .min(1, 'Vui lòng nhập mật khẩu.')
    .superRefine((password, context) => {
      if (!password) return;
      if (password.length < 8) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu cần có ít nhất 8 ký tự.' });
      }
      if (password.length > 20) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu không được vượt quá 20 ký tự.' });
      }
      if (!/[A-Z]/.test(password)) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu cần có ít nhất một chữ hoa.' });
      }
      if (!/[a-z]/.test(password)) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu cần có ít nhất một chữ thường.' });
      }
      if (!/\p{Nd}/u.test(password)) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu cần có ít nhất một chữ số.' });
      }
      if (!/[\p{P}\p{S}]/u.test(password)) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu cần có ít nhất một ký tự đặc biệt.' });
      }
      if (/\s/.test(password)) {
        context.addIssue({ code: 'custom', message: 'Mật khẩu không được chứa khoảng trắng.' });
      }
    });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
}).superRefine(({ password, confirmPassword }, context) => {
  if (confirmPassword && password !== confirmPassword) {
    context.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'Mật khẩu xác nhận không khớp.',
    });
  }
});

export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterFormValues = z.output<typeof registerSchema>;
