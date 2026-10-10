import type {Response} from 'express';
import {db} from '../config/db';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {readInfrastructureSelection,readInfrastructureReport,checkInfrastructure,readInfrastructureSchedule} from '../services/infrastructure-health.service';
import {writeAuditLog} from '../services/audit.service';
export async function getInfrastructureHealth(req:AuthenticatedRequest,res:Response){
 res.setHeader('Cache-Control','no-store');
 try{
  const [databases]:any=await db.query('SELECT id,name FROM database_servers WHERE archived_at IS NULL ORDER BY id');
  const [radius]:any=await db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius' ORDER BY id");
  const [gateways]:any=await db.query('SELECT id,settings_json FROM ovpn_gateways ORDER BY id');
  res.json({schedule:await readInfrastructureSchedule(),selection:await readInfrastructureSelection(),report:await readInfrastructureReport(),databases,radius:radius.map((r:any)=>({id:r.id,name:JSON.parse(r.setting_value).name})),gateways:gateways.map((g:any)=>({id:g.id,name:JSON.parse(g.settings_json).name}))});
 }catch{res.status(503).json({message:'تعذر قراءة البنية التحتية؛ تحقق من ترحيلات القاعدة المركزية.'});}
}
export async function saveInfrastructureSelection(req:AuthenticatedRequest,res:Response){
 let connection;
 try{
  const intervalMinutes=Number(req.body?.intervalMinutes??5);
  if(!Number.isInteger(intervalMinutes)||intervalMinutes<1||intervalMinutes>1440)return res.status(400).json({message:'فاصل الفحص يجب أن يكون بين دقيقة و1440 دقيقة.'});
  const selection=Object.fromEntries(['databaseServerId','radiusServerId','gatewayId','radiusSshServerId'].map(key=>[key,Number(req.body?.[key])]));
  if(!Object.values(selection).every(id=>Number.isSafeInteger(id)&&id>0))return res.status(400).json({message:'اختر مخدمات قاعدة البيانات وRADIUS وSSH وبوابة OpenVPN.'});
  const [d]:any=await db.query('SELECT id FROM database_servers WHERE id IN (?,?) AND archived_at IS NULL',[selection.databaseServerId,selection.radiusSshServerId]);
  const [r]:any=await db.query("SELECT id FROM platform_settings WHERE id=? AND setting_group='free_radius'",[selection.radiusServerId]);
  const [g]:any=await db.query('SELECT id FROM ovpn_gateways WHERE id=?',[selection.gatewayId]);
  if(!d.some((x:any)=>x.id===selection.databaseServerId)||!d.some((x:any)=>x.id===selection.radiusSshServerId)||!r[0]||!g[0])return res.status(400).json({message:'أحد المخدمات المختارة غير موجود.'});
  connection=await db.pool.getConnection();await connection.beginTransaction();
  await connection.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public,updated_by_master_admin_id) VALUES ('infrastructure_health','selection',?,'json',0,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_master_admin_id=VALUES(updated_by_master_admin_id)",[JSON.stringify(selection),req.auth!.accountId]);
  await connection.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('infrastructure_health','schedule',?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[JSON.stringify({intervalMinutes})]);
  await connection.query("DELETE FROM platform_settings WHERE setting_group='infrastructure_health' AND setting_key='last_report'");
  await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',description:'اختيار مخدمات فحص البنية التحتية للكلاود المشتركة',metadata:{selection}},connection);
  await connection.commit();res.json({selection});
 }catch{await connection?.rollback();res.status(400).json({message:'تعذر حفظ اختيار المخدمات.'});}finally{connection?.release();}
}
export async function runInfrastructureHealth(req:AuthenticatedRequest,res:Response){
 res.setHeader('Cache-Control','no-store');
 try{const report=await checkInfrastructure();await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',description:'فحص صحة البنية التحتية للكلاود المشتركة',metadata:{ready:report.ready,checks:report.checks.map(c=>({key:c.key,status:c.status}))}});res.json({report:await readInfrastructureReport()});}
 catch{res.status(409).json({message:'تعذر تنفيذ الفحص؛ احفظ اختيار المخدمات أو انتظر انتهاء الفحص الجاري.'});}
}
