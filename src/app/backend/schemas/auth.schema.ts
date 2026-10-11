import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم قصير جدًا').max(100, 'اسم المستخدم طويل جدًا'),
  password: z.string().min(3, 'كلمة المرور قصيرة جدًا').max(128, 'كلمة المرور طويلة جدًا'),
});

export type LoginInput = z.infer<typeof loginSchema>;
