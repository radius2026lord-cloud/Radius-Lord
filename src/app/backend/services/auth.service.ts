import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { db } from '../config/db';
import { env } from '../config/env';
import { Manager } from '../models/manger_Model';

interface LoginSuccess {
  success: true;
  status: number;
  token: string;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    username: string;
  };
}

interface LoginFail {
  success: false;
  status: number;
  message: string;
}

export type LoginResult = LoginSuccess | LoginFail;

export class AuthService {
  static async login(username: string, password: string): Promise<LoginResult> {
    const result = await db.query(
      'SELECT * FROM bab_managers WHERE username = ? LIMIT 1',
      [username],
    );

    const rows = result[0] as Manager[];
    const user = rows.length > 0 ? rows[0] : null;

    if (!user) {
      return { success: false, status: 404, message: 'المستخدم غير موجود' };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { success: false, status: 401, message: 'كلمة المرور غير صحيحة' };
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    return {
      success: true,
      status: 200,
      token: token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        username: user.username,
      },
    };
  }
}
