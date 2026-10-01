import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { defaultHomepageConfig, isHomepageConfig } from '../config/homepage-layout';

async function loadConfig() {
  const [rows] = await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='homepage' AND setting_key='layout' LIMIT 1");
  const value = (rows as any[])[0]?.setting_value;
  if (value) {
    try { const config = JSON.parse(value); if (isHomepageConfig(config)) return config; } catch {}
  }
  return defaultHomepageConfig();
}

export async function getHomepageSettingsController(req: AuthenticatedRequest, res: Response) {
  try { return res.json({ success: true, settings: await loadConfig() }); }
  catch (error) { console.error('Homepage settings:', error); return res.status(500).json({ success: false, message: 'تعذر تحميل إعدادات الصفحة الرئيسية.' }); }
}

export async function updateHomepageSettingsController(req: AuthenticatedRequest, res: Response) {
  if (req.auth?.accountType !== 'master_admin') return res.status(403).json({ success: false, message: 'تخصيص الصفحة الرئيسية متاح للمسؤول الرئيسي فقط.' });
  if (!isHomepageConfig(req.body)) return res.status(400).json({ success: false, message: 'تحقق من رسالة الترحيب والأقسام وترتيبها.' });
  const settings = { welcomeText: req.body.welcomeText.trim(), sections: req.body.sections.map(section => ({ id: section.id, enabled: section.enabled })) };
  try {
    await db.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public,updated_by_master_admin_id) VALUES ('homepage','layout',?,'json',0,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type='json',is_public=0,updated_by_master_admin_id=VALUES(updated_by_master_admin_id)", [JSON.stringify(settings), req.auth.accountId]);
    return res.json({ success: true, settings, message: 'تم حفظ الصفحة الرئيسية للحسابين.' });
  } catch (error) { console.error('Save homepage settings:', error); return res.status(500).json({ success: false, message: 'تعذر حفظ إعدادات الصفحة الرئيسية.' }); }
}

export async function getHomepageController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.auth) return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول.' });
    const settings = await loadConfig();
    const enabled = (id: string) => settings.sections.some(section => section.id === id && section.enabled);
    const customer = req.auth.accountType === 'customer';
    const params = customer ? [req.auth.accountId] : [];
    let summary = { totalOrders: 0, awaitingConfirmation: 0, paid: 0, completed: 0 };
    if (enabled('statistics')) {
      const [rows] = await db.query(`SELECT COUNT(*) total_orders, COALESCE(SUM(status='awaiting_confirmation'),0) awaiting_confirmation, COALESCE(SUM(status='paid'),0) paid, COALESCE(SUM(status='completed'),0) completed FROM payment_orders ${customer ? 'WHERE customer_id=?' : ''}`, params);
      const row = (rows as any[])[0] ?? {};
      summary = { totalOrders: Number(row.total_orders ?? 0), awaitingConfirmation: Number(row.awaiting_confirmation ?? 0), paid: Number(row.paid ?? 0), completed: Number(row.completed ?? 0) };
    }
    let activity: any[] = [];
    if (enabled('activity')) {
      const [accounts] = await db.query(`SELECT id,full_name,username,created_at FROM customers ${customer ? 'WHERE id=?' : ''} ORDER BY created_at DESC,id DESC LIMIT 20`, params);
      const [orders] = await db.query(`SELECT o.id,o.customer_id,o.payment_code,o.plan_name_snapshot,o.deployment_name_snapshot,o.total_amount,o.currency_code,o.status,o.created_at,c.full_name,c.username FROM payment_orders o JOIN customers c ON c.id=o.customer_id ${customer ? 'WHERE o.customer_id=?' : ''} ORDER BY o.created_at DESC,o.id DESC LIMIT 30`, params);
      const [events] = await db.query(`SELECT e.id,e.event_type,e.to_status,e.created_at,o.payment_code,o.customer_id,o.plan_name_snapshot,c.full_name,c.username FROM payment_order_events e JOIN payment_orders o ON o.id=e.payment_order_id JOIN customers c ON c.id=o.customer_id WHERE e.event_type<>'created' ${customer ? 'AND o.customer_id=?' : ''} ORDER BY e.created_at DESC,e.id DESC LIMIT 30`, params);
      const eventLabels: Record<string, string> = { sent_to_whatsapp: 'الانتقال إلى واتساب', confirmed_paid: 'تأكيد الدفع', completed: 'اكتمال الطلب', cancelled: 'إلغاء الطلب', expired: 'انتهاء الطلب', awaiting_confirmation: 'بانتظار التأكيد', note_added: 'إضافة ملاحظة' };
      activity = [
        ...(accounts as any[]).map(row => ({ id: `account-${row.id}`, customerId: row.id, customerName: row.full_name, username: row.username, title: 'إنشاء حساب', description: 'إنشاء حساب في Radius Lord', status: 'account', createdAt: row.created_at })),
        ...(orders as any[]).map(row => ({ id: `order-${row.id}`, customerId: row.customer_id, customerName: row.full_name, username: row.username, title: 'طلب دفع جديد', description: `${row.plan_name_snapshot}${row.deployment_name_snapshot ? ' — ' + row.deployment_name_snapshot : ''}`, paymentCode: row.payment_code, totalAmount: Number(row.total_amount), currency: row.currency_code, status: row.status, createdAt: row.created_at })),
        ...(events as any[]).map(row => ({ id: `event-${row.id}`, customerId: row.customer_id, customerName: row.full_name, username: row.username, title: eventLabels[row.event_type] ?? 'تحديث طلب الدفع', description: row.plan_name_snapshot, paymentCode: row.payment_code, status: row.to_status, createdAt: row.created_at })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);
    }
    return res.json({ success: true, settings, summary, activity });
  } catch (error) { console.error('Homepage:', error); return res.status(500).json({ success: false, message: 'تعذر تحميل الصفحة الرئيسية. حاول مجددًا.' }); }
}
