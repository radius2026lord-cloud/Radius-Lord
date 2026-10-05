import { createCipheriv, randomBytes } from 'crypto';
import { isIP } from 'net';
import type { PoolConnection } from 'mysql2/promise';
import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

const defaults = { name: '', api_host: '', api_port: 8729, api_username: '', api_tls: true, ovpn_host: '', ovpn_port: 1194, ovpn_protocol: 'tcp', tunnel_cidr: '', certificate_name: '', ppp_profile: '', server_tunnel_address: '', description: '', enabled: false };
function publicSettings(row: any) { return { id: row?.id, ...defaults, ...(row ? JSON.parse(row.settings_json) : {}), has_api_password: Boolean(row?.api_password_encrypted) }; }
function host(value: string) { return Boolean(isIP(value) || /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value)); }
export async function getOvpnSettings(req: AuthenticatedRequest, res: Response) {
 try { const [rows] = await db.query('SELECT id, settings_json, api_password_encrypted FROM ovpn_gateways ORDER BY id DESC'); return res.json({ success: true, gateways: (rows as any[]).map(publicSettings) }); }
 catch { return res.status(500).json({ success: false, message: 'تعذر تحميل إعدادات البوابة. تأكد من تطبيق ترحيل إعدادات OpenVPN.' }); }
}
export async function updateOvpnSettings(req: AuthenticatedRequest, res: Response) {
 const b = req.body ?? {};
 const values = { ...defaults };
 for (const k of ['name','api_host','api_username','ovpn_host','tunnel_cidr','certificate_name','ppp_profile','server_tunnel_address','description'] as const) {
  if (typeof b[k] !== 'string' || b[k].length > 253) return res.status(400).json({ message: 'بيانات البوابة غير صالحة.' });
  values[k] = b[k].trim();
 }
 if (typeof b.enabled !== 'boolean' || typeof b.api_tls !== 'boolean') return res.status(400).json({ message: 'حالة البوابة غير صالحة.' });
 values.enabled=b.enabled; values.api_tls=b.api_tls;
 for (const k of ['api_port','ovpn_port'] as const) { const n=Number(b[k]); if (!Number.isInteger(n)||n<1||n>65535) return res.status(400).json({message:'أدخل منفذًا بين 1 و65535.'}); values[k]=n; }
 // TCP is the common baseline for RouterOS 6 and 7. Additional protocols require version-specific provisioning.
 if (b.ovpn_protocol !== 'tcp') return res.status(400).json({message:'بروتوكول النفق المعتمد حاليًا هو TCP.'});
 const parts=values.tunnel_cidr.split('/'), octets=(parts[0]??'').split('.').map(Number), prefix=Number(parts[1]);
 const privateRange=octets[0]===10 || (octets[0]===172 && octets[1]>=16 && octets[1]<=31) || (octets[0]===192 && octets[1]===168);
 const ip=octets.reduce((n,v)=>(n*256+v)>>>0,0), mask=(0xffffffff << (32-prefix))>>>0;
 if (!values.name||!values.api_username||!host(values.api_host)||!host(values.ovpn_host)||parts.length!==2||isIP(parts[0])!==4||!Number.isInteger(prefix)||prefix<(octets[0]===10?8:octets[0]===172?12:16)||prefix>30||!privateRange||((ip&mask)>>>0)!==ip) return res.status(400).json({message:'أكمل الاسم وبيانات الاتصال وأدخل نطاق شبكة خاصًا صحيحًا، مثل 10.80.0.0/16.'});
 if (isIP(values.server_tunnel_address)!==4 || !values.ppp_profile) return res.status(400).json({message:'أدخل عنوان طرف الخادم واسم PPP Profile.'});
 const serverIp=values.server_tunnel_address.split('.').map(Number).reduce((n,v)=>(n*256+v)>>>0,0);
 if (((serverIp&mask)>>>0)!==ip || serverIp===ip || serverIp===((ip|(~mask))>>>0)) return res.status(400).json({message:'عنوان طرف الخادم يجب أن يكون عنوان جهاز صالحًا ضمن نطاق الأنفاق.'});
 if (values.enabled&&!values.certificate_name) return res.status(400).json({message:'أدخل اسم شهادة الخادم قبل تفعيل البوابة.'});
 if (b.api_password!==undefined && (typeof b.api_password!=='string'||b.api_password.length>512)) return res.status(400).json({message:'كلمة مرور API غير صالحة.'});
 let encrypted: string|null=null;
 if (b.api_password) {
  const raw=process.env.GATEWAY_ENCRYPTION_KEY??'';
  if (!/^[a-f0-9]{64}$/i.test(raw)) return res.status(503).json({message:'يجب إعداد مفتاح تشفير البوابة على الخادم قبل حفظ كلمة المرور.'});
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(raw,'hex'),iv);
  const ciphertext=Buffer.concat([cipher.update(b.api_password,'utf8'),cipher.final()]);
  encrypted=['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join(':');
 }
 const id=req.params.id ? Number(req.params.id) : null;
 if (id!==null && (!Number.isSafeInteger(id)||id<1)) return res.status(400).json({message:'معرّف الخادم غير صالح.'});
 let connection: PoolConnection | undefined;
 try {
  connection=await db.pool.getConnection();
  await connection.beginTransaction();
  const [rows]=id ? await connection.query('SELECT api_password_encrypted FROM ovpn_gateways WHERE id=? FOR UPDATE',[id]) : [[],[]];
  if (id && !(rows as any[]).length) {await connection.rollback(); return res.status(404).json({message:'الخادم غير موجود.'});}
  const secret=encrypted??(rows as any[])[0]?.api_password_encrypted;
  if (values.enabled&&!secret) {await connection.rollback(); return res.status(400).json({message:'أدخل كلمة مرور API قبل تفعيل البوابة.'});}
  let savedId=id;
  if(id) await connection.query('UPDATE ovpn_gateways SET settings_json=?,api_password_encrypted=?,updated_by_master_admin_id=? WHERE id=?',[JSON.stringify(values),secret??null,req.auth!.accountId,id]);
  else {const [result]=await connection.query('INSERT INTO ovpn_gateways (settings_json,api_password_encrypted,updated_by_master_admin_id) VALUES (?,?,?)',[JSON.stringify(values),secret??null,req.auth!.accountId]); savedId=(result as any).insertId;}
  await writeAuditLog(req,{actionCode:id?'UPDATE':'CREATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:savedId,description:'حفظ إعدادات NAS وخادم OpenVPN',metadata:{settingGroup:'nas_ovpn',passwordChanged:Boolean(encrypted)}},connection);
  await connection.commit(); return res.json({success:true,settings:{id:savedId,...values,has_api_password:Boolean(secret)}});
 } catch {await connection?.rollback(); return res.status(500).json({message:'تعذر حفظ إعدادات البوابة.'});} finally {connection?.release();}
}
