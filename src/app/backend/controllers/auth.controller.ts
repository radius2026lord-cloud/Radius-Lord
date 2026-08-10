import { Request, Response } from 'express';

import { loginSchema } from '../schemas/auth.schema';
import { AuthService } from '../services/auth.service';

export const loginController = async (req: Request, res: Response) => {
  try {
    console.log('BODY:', req.body); ////////////////////////////
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message,
      });
    }

    const { username, password } = parsed.data;

    const result = await AuthService.login(username, password);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    // Set cookie (Express version)
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 20 * 60 * 1000, // 👈 20 دقيقة
      path: '/',
    });

    return res.json({
      success: true,
      user: result.user,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
    });
  }
};
