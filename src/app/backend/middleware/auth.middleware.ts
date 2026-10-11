import {requireAuthOrigin} from './auth-origin.middleware';
import { NextFunction, Request, Response } from 'express';
import {verifyCentralSession} from '../services/central-session.service';

export type AccountType = 'master_admin' | 'customer';
export type AuthenticatedRequest = Request & { auth?: { accountId: number; accountType: AccountType; username: string | null; sessionId?:string; expiresAt?: number } };
type TokenPayload = { sub: number | string; accountType: AccountType; username?: string | null; exp?: number };

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token:string|null;try{token=readCookie(req,'token');}catch{return res.status(401).json({success:false,message:'بيانات الجلسة غير صالحة.'});}
  if (!token) return res.status(401).json({ success: false, message: 'غير مصرح. يرجى تسجيل الدخول.' });

  try {
    const payload = await verifyCentralSession(token);
    const accountId = Number(payload.sub);
    if (!Number.isInteger(accountId) || !['master_admin', 'customer'].includes(payload.accountType)) throw new Error('Invalid auth payload');
    req.auth = { accountId, accountType: payload.accountType, username: payload.username ?? null, sessionId:payload.jti, expiresAt: payload.exp };
    return requireAuthOrigin(req,res,next);
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
