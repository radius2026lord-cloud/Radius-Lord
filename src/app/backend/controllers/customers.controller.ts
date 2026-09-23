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


export const getCustomerController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'معرّف العميل غير صالح.' });
    }

    const result = await db.query(
      `SELECT id, full_name, username, email, phone, country, status, last_login_at, created_at, updated_at
       FROM customers
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    const row = (result[0] as any[])[0];
    if (!row) return res.status(404).json({ success: false, message: 'العميل غير موجود.' });

    return res.json({
      success: true,
      customer: {
        id: row.id,
        fullName: row.full_name,
        username: row.username,
        email: row.email,
        phone: row.phone,
        country: row.country,
        status: row.status,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('Get customer error:', err);
    return res.status(500).json({ success: false, message: 'تعذر تحميل بيانات العميل حاليًا.' });
  }
};
