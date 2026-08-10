import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم قصير جدًا'),
  password: z.string().min(3, 'كلمة المرور قصيرة جدًا'),
});

export type LoginInput = z.infer<typeof loginSchema>;
