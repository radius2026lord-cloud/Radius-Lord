import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const listAuditLogsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT l.id, l.admin_id, l.tenant_id, l.entity_id, l.description, l.ip_address, l.user_agent,
              l.metadata, l.created_at,
              a.code AS action_code, a.name_ar AS action_name,
              e.code AS entity_type_code, e.name_ar AS entity_type_name,
              m.full_name AS admin_name, m.username AS admin_username,
              CASE WHEN e.code = 'CUSTOMER' THEN c.full_name ELSE NULL END AS customer_name
       FROM central_audit_logs l
       JOIN audit_actions a ON a.id = l.action_id
       JOIN audit_entity_types e ON e.id = l.entity_type_id
       LEFT JOIN master_admins m ON m.id = l.admin_id
       LEFT JOIN customers c ON e.code = 'CUSTOMER' AND c.id = l.entity_id
       ORDER BY l.id DESC
       LIMIT 500`,
    );
    const rows = result[0] as any[];
    return res.json({
      success: true,
      logs: rows.map((row) => ({
        id: row.id,
        adminId: row.admin_id,
        adminName: row.admin_name,
        adminUsername: row.admin_username,
        tenantId: row.tenant_id,
        actionCode: row.action_code,
        actionName: row.action_name,
        entityTypeCode: row.entity_type_code,
        entityTypeName: row.entity_type_name,
        entityId: row.entity_id,
        entityName: row.customer_name,
        description: row.description,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('List audit logs error:', err);
    return res.status(500).json({ success: false, message: 'تعذر تحميل سجل نشاط الإدارة حاليًا.' });
  }
};


export const customerAuditLogsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!Number.isInteger(customerId) || customerId < 1) {
      return res.status(400).json({ success: false, message: 'معرّف العميل غير صالح.' });
    }

    const result = await db.query(
      `SELECT l.id, l.entity_id, l.description, l.metadata, l.created_at,
              a.code AS action_code, a.name_ar AS action_name,
              m.full_name AS admin_name, m.username AS admin_username
       FROM central_audit_logs l
       JOIN audit_actions a ON a.id = l.action_id
       JOIN audit_entity_types e ON e.id = l.entity_type_id
       LEFT JOIN master_admins m ON m.id = l.admin_id
       WHERE e.code = 'CUSTOMER' AND l.entity_id = ?
       ORDER BY l.id DESC
       LIMIT 5`,
      [customerId],
    );
    const rows = result[0] as any[];
    return res.json({
      success: true,
      logs: rows.map((row) => ({
        id: row.id,
        actionCode: row.action_code,
        actionName: row.action_name,
        description: row.description,
        adminName: row.admin_name,
        adminUsername: row.admin_username,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Customer audit logs error:', err);
    return res.status(500).json({ success: false, message: 'تعذر تحميل آخر نشاطات العميل حاليًا.' });
  }
};
