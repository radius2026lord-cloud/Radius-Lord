import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

type AuditInput = {
  actionCode: string;
  entityTypeCode: string;
  entityId?: number | null;
  tenantId?: number | null;
  description?: string | null;
  metadata?: unknown;
};

function requestIp(req: AuthenticatedRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (value?.trim() || req.ip || req.socket.remoteAddress || null)?.slice(0, 45) ?? null;
}

export async function writeAuditLog(req: AuthenticatedRequest, input: AuditInput) {
  if (req.auth?.accountType !== 'master_admin') return;
  return writeMasterAdminAuditLog(req, req.auth.accountId, input);
}

export async function writeMasterAdminAuditLog(req: AuthenticatedRequest, adminId: number, input: AuditInput) {
  await writeMasterAdminAuditLog(req, req.auth.accountId, input);

}

export async function writeMasterAdminAuditLog(req: AuthenticatedRequest, adminId: number, input: AuditInput) {
  const lookup = await db.query(
    `SELECT
       (SELECT id FROM audit_actions WHERE code = ? AND is_active = 1 LIMIT 1) AS action_id,
       (SELECT id FROM audit_entity_types WHERE code = ? AND is_active = 1 LIMIT 1) AS entity_type_id`,
    [input.actionCode, input.entityTypeCode],
  );
  const ids = (lookup[0] as any[])[0];
  if (!ids?.action_id || !ids?.entity_type_id) {
    throw new Error(`Audit dictionary value missing: ${input.actionCode}/${input.entityTypeCode}`);
  }

  await db.query(
    `INSERT INTO central_audit_logs
      (admin_id, tenant_id, action_id, entity_type_id, entity_id, description, ip_address, user_agent, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      input.tenantId ?? null,
      ids.action_id,
      ids.entity_type_id,
      input.entityId ?? null,
      input.description ?? null,
      requestIp(req),
      String(req.headers['user-agent'] ?? '').slice(0, 255) || null,
      input.metadata === undefined ? null : JSON.stringify(input.metadata),
    ],
  );
}
