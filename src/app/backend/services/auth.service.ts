import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { db } from '../config/db';
import { env } from '../config/env';

type AccountType = 'master_admin' | 'customer';

interface LoginSuccess {
  success: true;
  status: number;
  token: string;
  accountType: AccountType;
  redirectTo: '/admin/dashboard' | '/customer/dashboard';
  user: {
    id: number;
    fullName: string;
    username: string | null;
    email: string;
    accountType: AccountType;
  };
}

interface LoginFail {
  success: false;
  status: number;
  message: string;
}

export type LoginResult = LoginSuccess | LoginFail;

type AuthAccount = {
  id: number;
  full_name: string;
  username: string | null;
  email: string;
  password_hash: string;
  status: string;
};

export class AuthService {
  private static async findAccount(table: 'master_admins' | 'customers', identifier: string) {
    const result = await db.query(
      `SELECT id, full_name, username, email, password_hash, status
       FROM ${table}
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier],
    );

    const rows = result[0] as AuthAccount[];
    return rows[0] ?? null;
  }

  static async login(identifier: string, password: string): Promise<LoginResult> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    // One login endpoint, while each account type remains isolated in its own table.
    let account = await this.findAccount('master_admins', normalizedIdentifier);
    let accountType: AccountType = 'master_admin';

    if (!account) {
      account = await this.findAccount('customers', normalizedIdentifier);
      accountType = 'customer';
    }

    // Keep one generic response so login does not reveal which identifiers exist.
    if (!account) {
      return { success: false, status: 401, message: 'بيانات تسجيل الدخول غير صحيحة' };
    }

    if (account.status !== 'active') {
      return { success: false, status: 403, message: 'هذا الحساب غير نشط حاليًا' };
    }

    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return { success: false, status: 401, message: 'بيانات تسجيل الدخول غير صحيحة' };
    }

    const token = jwt.sign(
      {
        sub: account.id,
        accountType,
        username: account.username,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const table = accountType === 'master_admin' ? 'master_admins' : 'customers';
    await db.query(`UPDATE ${table} SET last_login_at = NOW() WHERE id = ?`, [account.id]);

    const redirectTo = accountType === 'master_admin'
      ? '/admin/dashboard'
      : '/customer/dashboard';

    return {
      success: true,
      status: 200,
      token,
      accountType,
      redirectTo,
      user: {
        id: account.id,
        fullName: account.full_name,
        username: account.username,
        email: account.email,
        accountType,
      },
    };
  }
}
