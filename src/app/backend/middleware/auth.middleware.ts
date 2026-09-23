import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AccountType = 'master_admin' | 'customer';
export type AuthenticatedRequest = Request & { auth?: { accountId: number; accountType: AccountType; username: string | null } };
type TokenPayload = { sub: number | string; accountType: AccountType; username?: string | null };

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = readCookie(req, 'token');
  if (!token) return res.status(401).json({ success: false, message: 'غير مصرح. يرجى تسجيل الدخول.' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    const accountId = Number(payload.sub);
    if (!Number.isInteger(accountId) || !['master_admin', 'customer'].includes(payload.accountType)) throw new Error('Invalid auth payload');
    req.auth = { accountId, accountType: payload.accountType, username: payload.username ?? null };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'انتهت الجلسة أو أن بياناتها غير صالحة.' });
  }
}

export function requireAccountType(...allowed: AccountType[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ success: false, message: 'غير مصرح.' });
    if (!allowed.includes(req.auth.accountType)) return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.' });
    return next();
  };
}
