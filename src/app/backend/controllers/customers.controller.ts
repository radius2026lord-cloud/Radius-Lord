import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

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


export const updateCustomerController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'معرّف العميل غير صالح.' });

    const fullName = String(req.body.fullName ?? '').trim();
    const username = String(req.body.username ?? '').trim().toLowerCase();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const phone = String(req.body.phone ?? '').trim();
    const country = String(req.body.country ?? '').trim();

    if (!fullName || !username || !email || !phone || !country) return res.status(400).json({ success: false, message: 'جميع بيانات العميل مطلوبة.' });
    if (fullName.length > 100 || username.length > 20 || email.length > 100 || phone.length > 20 || country.length > 100) return res.status(400).json({ success: false, message: 'إحدى القيم تتجاوز الطول المسموح.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح.' });

    const duplicateResult = await db.query(
      `SELECT id,
        CASE WHEN username = ? THEN 'username' WHEN email = ? THEN 'email' WHEN phone = ? THEN 'phone' END AS duplicate_field
       FROM customers
       WHERE id <> ? AND (username = ? OR email = ? OR phone = ?)
       LIMIT 1`,
      [username, email, phone, id, username, email, phone],
    );
    const duplicate = (duplicateResult[0] as any[])[0];
    if (duplicate) {
      const message = duplicate.duplicate_field === 'username' ? 'اسم المستخدم مستخدم مسبقًا.' : duplicate.duplicate_field === 'email' ? 'البريد الإلكتروني مستخدم مسبقًا.' : 'رقم الهاتف مستخدم مسبقًا.';
      return res.status(409).json({ success: false, message });
    }

    const beforeResult = await db.query(
      `SELECT full_name, username, email, phone, country FROM customers WHERE id = ? LIMIT 1`,
      [id],
    );
    const before = (beforeResult[0] as any[])[0];
    if (!before) return res.status(404).json({ success: false, message: 'العميل غير موجود.' });

    const updateResult = await db.query(
      `UPDATE customers SET full_name = ?, username = ?, email = ?, phone = ?, country = ? WHERE id = ?`,
      [fullName, username, email, phone, country, id],
    );
    if ((updateResult[0] as any).affectedRows === 0) return res.status(404).json({ success: false, message: 'العميل غير موجود.' });

    const result = await db.query(
      `SELECT id, full_name, username, email, phone, country, status, last_login_at, created_at, updated_at FROM customers WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = (result[0] as any[])[0];

    const after = { full_name: fullName, username, email, phone, country };
    const changes = Object.fromEntries(
      Object.entries(after)
        .filter(([key, value]) => String(before[key] ?? '') !== String(value ?? ''))
        .map(([key, value]) => [key, { before: before[key] ?? null, after: value ?? null }]),
    );

    if (Object.keys(changes).length > 0) {
      await writeAuditLog(req, {
        actionCode: 'UPDATE',
        entityTypeCode: 'CUSTOMER',
        entityId: id,
        description: `تعديل بيانات العميل #${id}`,
        metadata: { changes },
      });
    }

    return res.json({ success: true, message: 'تم حفظ تعديلات العميل بنجاح.', customer: { id: row.id, fullName: row.full_name, username: row.username, email: row.email, phone: row.phone, country: row.country, status: row.status, lastLoginAt: row.last_login_at, createdAt: row.created_at, updatedAt: row.updated_at } });
  } catch (err) {
    console.error('Update customer error:', err);
    return res.status(500).json({ success: false, message: 'تعذر حفظ تعديلات العميل حاليًا.' });
  }
};
