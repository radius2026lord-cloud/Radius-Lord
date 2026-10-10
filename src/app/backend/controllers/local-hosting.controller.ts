import { Response } from 'express';
import { isIP } from 'net';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

const GROUP = 'local_hosting';
const KEY = 'shared_cloud_connection';
const defaults = { domain: '', public_ip: '', local_ip: '', public_https_port: 443, local_https_port: 443 };

export async function getLocalHostingSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const [rows] = await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?', [GROUP, KEY]);
    const row = (rows as any[])[0];
    return res.json({ success: true, settings: row ? { ...defaults, ...JSON.parse(row.setting_value) } : defaults });
  } catch (error) {
    console.error('Local hosting settings read failed', error);
    return res.status(500).json({ message: 'تعذر تحميل إعدادات ربط الدومين.' });
  }
}

export async function saveLocalHostingSettings(req: AuthenticatedRequest, res: Response) {
  const body = req.body ?? {};
  const domain = String(body.domain ?? '').trim().toLowerCase();
  const publicIp = String(body.public_ip ?? '').trim();
  const localIp = String(body.local_ip ?? '').trim();
  // This first hosting path uses an IPv4 DNS A record and router NAT rule.
  if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain) || isIP(domain))
    return res.status(400).json({ message: 'أدخل الدومين فقط دون https أو مسار، مثل panel.example.com.' });
  const octets = publicIp.split('.').map(Number);
  if (isIP(publicIp) !== 4 || octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254) || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127))
    return res.status(400).json({ message: 'أدخل عنوان IPv4 عامًا قابلاً للوصول من الإنترنت، وليس عنوانًا محليًا أو CGNAT.' });
  const local = localIp.split('.').map(Number);
  if (isIP(localIp) !== 4 || !(local[0] === 10 || (local[0] === 172 && local[1] >= 16 && local[1] <= 31) || (local[0] === 192 && local[1] === 168)))
    return res.status(400).json({ message: 'أدخل عنوان IPv4 المحلي للمخدم ضمن الشبكة الداخلية.' });
  const publicPort = Number(body.public_https_port), localPort = Number(body.local_https_port);
  if (![publicPort, localPort].every(port => Number.isInteger(port) && port >= 1 && port <= 65535))
    return res.status(400).json({ message: 'المنافذ يجب أن تكون أعدادًا صحيحة بين 1 و65535.' });
  const settings = { domain, public_ip: publicIp, local_ip: localIp, public_https_port: publicPort, local_https_port: localPort };
  try {
    await db.query(`INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public,updated_by_master_admin_id)
      VALUES (?,?,?,'json',0,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type='json',is_public=0,updated_by_master_admin_id=VALUES(updated_by_master_admin_id)`,
      [GROUP, KEY, JSON.stringify(settings), req.auth!.accountId]);
    await db.query(`INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active) VALUES ('PLATFORM_SETTINGS','إعدادات المنصة','Platform Settings','إعدادات منصة Radius Lord',1) ON DUPLICATE KEY UPDATE is_active=1`);
    await writeAuditLog(req, { actionCode: 'UPDATE', entityTypeCode: 'PLATFORM_SETTINGS', entityId: null, description: 'تحديث إعدادات ربط الدومين بالمخدم المحلي', metadata: { settingGroup: GROUP } });
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('Local hosting settings save failed', error);
    return res.status(500).json({ message: 'تعذر حفظ إعدادات ربط الدومين.' });
  }
}
