import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const listCustomersController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, username, email, phone, country, status, last_login_at, created_at
       FROM customers
       ORDER BY id DESC`,
    );
    const rows = result[0] as any[];

    return res.json({
      success: true,
      customers: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        username: row.username,
        email: row.email,
        phone: row.phone,
        country: row.country,
        status: row.status,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('List customers error:', err);
    return res.status(500).json({ success: false, message: 'تعذر تحميل العملاء حاليًا.' });
  }
};
