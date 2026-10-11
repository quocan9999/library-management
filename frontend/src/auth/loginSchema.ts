import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export type LoginForm = z.infer<typeof loginSchema>;
