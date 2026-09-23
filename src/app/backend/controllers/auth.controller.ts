import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';

import { db } from '../config/db';
import { loginSchema } from '../schemas/auth.schema';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const transliteration: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j',
  ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh',
  ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q',
  ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a',
  ة: 'a', ئ: 'y', ؤ: 'w', ء: '',
};

function usernameBase(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] || 'user';
  const latin = Array.from(firstName)
    .map((char) => transliteration[char] ?? char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return (latin || 'user').slice(0, 20);
}

async function nextAvailableUsername(fullName: string) {
  const base = usernameBase(fullName);
  let suffix = 1;

  while (true) {
    const suffixText = suffix === 1 ? '' : String(suffix);
    const candidate = base.slice(0, 20 - suffixText.length) + suffixText;
    const result = await db.query(
      'SELECT id FROM customers WHERE username = ? LIMIT 1',
      [candidate],
    );
    const rows = result[0] as any[];

    if (rows.length === 0) return candidate;
    suffix += 1;
  }
}

export const signupController = async (req: Request, res: Response) => {
  try {
    const fullName = String(req.body?.fullName || '').trim().replace(/\s+/g, ' ');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
    const country = String(req.body?.country || '').trim();
    const password = String(req.body?.password || '');

    if (!fullName || !email || !phone || !country || !password) {
      return res.status(400).json({
        success: false,
        code: 'REQUIRED_FIELDS',
        message: 'يرجى تعبئة جميع الحقول المطلوبة.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'يرجى إدخال بريد إلكتروني صحيح.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        code: 'WEAK_PASSWORD',
        message: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
      });
    }

    const duplicateResult = await db.query(
      'SELECT email, phone FROM customers WHERE email = ? OR phone = ? LIMIT 2',
      [email, phone],
    );
    const duplicates = duplicateResult[0] as Array<{ email: string; phone: string }>;

    const errors = [];
    if (duplicates.some((row) => row.email === email)) {
      errors.push({ field: 'email', message: 'البريد الإلكتروني مستخدم مسبقًا.' });
    }
    if (duplicates.some((row) => row.phone === phone)) {
      errors.push({ field: 'phone', message: 'رقم الهاتف مستخدم مسبقًا.' });
    }
    if (errors.length > 0) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_CUSTOMER',
        errors,
      });
    }

    const username = await nextAvailableUsername(fullName);
    const passwordHash = await bcrypt.hash(password, 12);

    const insertResult = await db.query(
      `INSERT INTO customers
        (full_name, email, username, phone, country, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, username, phone, country, passwordHash],
    );
    const result = insertResult[0] as any;

    return res.status(201).json({
      success: true,
      customer: {
        id: result.insertId,
        fullName,
        email,
        username,
        phone,
        country,
      },
      message: 'تم إنشاء الحساب بنجاح.',
    });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_CUSTOMER',
        message: 'البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم مستخدم مسبقًا.',
      });
    }

    console.error('Signup error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'تعذر إنشاء الحساب حاليًا.',
    });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
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

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 20 * 60 * 1000,
      path: '/',
    });

    return res.json({
      success: true,
      user: result.user,
      accountType: result.accountType,
      redirectTo: result.redirectTo,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
    });
  }
};


export const meController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ success: false, message: 'غير مصرح.' });
    }

    const table = req.auth.accountType === 'master_admin' ? 'master_admins' : 'customers';
    const result = await db.query(
      `SELECT id, full_name, username, email, status FROM ${table} WHERE id = ? LIMIT 1`,
      [req.auth.accountId],
    );
    const rows = result[0] as Array<{ id: number; full_name: string; username: string | null; email: string; status: string }>;
    const account = rows[0];

    if (!account || account.status !== 'active') {
      return res.status(401).json({ success: false, message: 'الحساب غير متاح حاليًا.' });
    }

    return res.json({
      success: true,
      account: {
        id: account.id,
        fullName: account.full_name,
        username: account.username,
        email: account.email,
        accountType: req.auth.accountType,
      },
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return res.status(500).json({ success: false, message: 'تعذر قراءة بيانات الجلسة.' });
  }
};
