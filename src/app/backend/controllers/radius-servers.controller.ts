import {discoverInstalledRadius} from '../services/ssh-terminal.service';
import { randomUUID } from 'crypto';
import { isIP } from 'net';
import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { encryptProvisioningSecret } from '../services/provisioning-secrets.service';
import { writeAuditLog } from '../services/audit.service';
import {checkRadiusHealth} from '../services/radius-database-health.service';
const group = 'free_radius';
const active = new Set<number>();
const lastChecks = new Map<number, number>();
function id(req: AuthenticatedRequest) { const value = Number(req.params.id); if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_ID'); return value; }
async function row(value: number) {
  const [rows]: any = await db.query('SELECT id,setting_value FROM platform_settings WHERE id=? AND setting_group=?',[value,group]);
  if (!rows[0]) throw new Error('NOT_FOUND');
  return rows[0];
}
function safe(r: any) {
  const c = JSON.parse(r.setting_value);
  const { secretEncrypted, testPasswordEncrypted, probeDatabasePasswordEncrypted, ...visible } = c;
  return { id: r.id, ...visible, hasSecret: Boolean(secretEncrypted), hasTestPassword: Boolean(testPasswordEncrypted), hasProbeDatabasePassword: Boolean(probeDatabasePasswordEncrypted) };
}
export async function listRadiusServers(req: AuthenticatedRequest, res: Response) {
  res.setHeader('Cache-Control','no-store');
  try {
    const [rows]: any = await db.query('SELECT id,setting_value FROM platform_settings WHERE setting_group=? ORDER BY id DESC',[group]);
    const [databases]: any = await db.query("SELECT id,db_name FROM tenant_databases WHERE credentials_state='ready' AND status='active' ORDER BY id DESC");
    return res.json({ servers: rows.map(safe), databases: databases.map((d:any)=>({id:d.id,name:d.db_name})) });
  } catch { return res.status(503).json({message:'تعذر تحميل خوادم FreeRADIUS؛ راجع ترحيلات القاعدة المركزية.'}); }
}
export async function saveRadiusServer(req: AuthenticatedRequest, res: Response) {
  let connection;
  try {
    const serverId = req.params.id ? id(req) : null;
    const old = serverId ? JSON.parse((await row(serverId)).setting_value) : {};
    const b = req.body ?? {}, name = String(b.name ?? '').trim(), host = String(b.host ?? '').trim();
    if (!name || name.length>100 || (!isIP(host) && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host))) throw new Error('INVALID_CONFIG');
    // This first health client uses IPv4 UDP.
    if (isIP(host)===6) throw new Error('INVALID_CONFIG');
    const authPort = Number(b.authPort), accountingPort = Number(b.accountingPort);
    if (![authPort,accountingPort].every(p=>Number.isInteger(p)&&p>=1&&p<=65535)) throw new Error('INVALID_CONFIG');
    const testUsername = String(b.testUsername ?? '').trim();
    if (Buffer.byteLength(testUsername)>100) throw new Error('INVALID_CONFIG');
    if (typeof b.secret!=='string' || typeof b.testPassword!=='string' || Buffer.byteLength(b.secret)>253 || Buffer.byteLength(b.testPassword)>128) throw new Error('INVALID_CONFIG');
    const sameTarget = old.host===host && old.authPort===authPort && old.accountingPort===accountingPort;
    const secretEncrypted = b.secret ? encryptProvisioningSecret(b.secret) : sameTarget ? old.secretEncrypted : null;
    if (!secretEncrypted) throw new Error('SECRET_REQUIRED');
    const testPasswordEncrypted = b.testPassword ? encryptProvisioningSecret(b.testPassword) : old.testUsername===testUsername ? old.testPasswordEncrypted : null;
    const tenantDatabaseId = b.tenantDatabaseId == null || b.tenantDatabaseId==='' ? null : Number(b.tenantDatabaseId);
    if (tenantDatabaseId!==null) {
      if (!Number.isSafeInteger(tenantDatabaseId)||tenantDatabaseId<1) throw new Error('INVALID_CONFIG');
      const [found]:any=await db.query("SELECT id FROM tenant_databases WHERE id=? AND credentials_state='ready' AND status='active'",[tenantDatabaseId]);
      if (!found[0]) throw new Error('DATABASE_NOT_READY');
    }
    const probeDatabaseHost=String(b.probeDatabaseHost??old.probeDatabaseHost??'').trim(),probeDatabaseName=String(b.probeDatabaseName??old.probeDatabaseName??'').trim(),probeDatabaseUsername=String(b.probeDatabaseUsername??old.probeDatabaseUsername??'').trim(),probeDatabasePort=Number(b.probeDatabasePort??old.probeDatabasePort??3306);
    const probeDatabaseTls=b.probeDatabaseTls??old.probeDatabaseTls??false;
    const probeDatabasePassword=String(b.probeDatabasePassword??'');
    if(probeDatabasePassword.length>512||typeof probeDatabaseTls!=='boolean')throw new Error('INVALID_CONFIG');
    const hasProbe=Boolean(probeDatabaseHost||probeDatabaseName||probeDatabaseUsername||probeDatabasePassword);
    if(hasProbe&&(!isIP(probeDatabaseHost)&&!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(probeDatabaseHost)||!/^rl_infrastructure_[a-z0-9_]{1,40}$/.test(probeDatabaseName)||!probeDatabaseUsername||probeDatabaseUsername.length>100||!Number.isInteger(probeDatabasePort)||probeDatabasePort<1||probeDatabasePort>65535))throw new Error('PROBE_CONFIG');
    const sameProbe=old.probeDatabaseHost===probeDatabaseHost&&old.probeDatabaseName===probeDatabaseName&&old.probeDatabaseUsername===probeDatabaseUsername&&old.probeDatabasePort===probeDatabasePort&&old.probeDatabaseTls===probeDatabaseTls;
    const probeDatabasePasswordEncrypted=hasProbe?(probeDatabasePassword?encryptProvisioningSecret(probeDatabasePassword):sameProbe?old.probeDatabasePasswordEncrypted:null):null;
    if(hasProbe&&!probeDatabasePasswordEncrypted)throw new Error('PROBE_CONFIG');
    if(hasProbe){const [used]:any=await db.query('SELECT id FROM tenant_databases WHERE db_name=? LIMIT 1',[probeDatabaseName]);if(used[0])throw new Error('PROBE_CONFIG');}
    const config = { sshServerId:old.sshServerId??null,discovery:old.discovery??null, name, host, authPort, accountingPort, testUsername, tenantDatabaseId, secretEncrypted, testPasswordEncrypted, probeDatabaseHost,probeDatabaseName,probeDatabaseUsername,probeDatabasePort,probeDatabaseTls,probeDatabasePasswordEncrypted,lastHealth: null };
    connection = await db.pool.getConnection(); await connection.beginTransaction();
    let savedId = serverId;
    if (serverId) await connection.query('UPDATE platform_settings SET setting_value=?,is_public=0,updated_by_master_admin_id=? WHERE id=? AND setting_group=?',[JSON.stringify(config),req.auth!.accountId,serverId,group]);
    else { const [result]:any=await connection.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public,updated_by_master_admin_id) VALUES (?,?,?,'json',0,?)",[group,'server_'+randomUUID(),JSON.stringify(config),req.auth!.accountId]); savedId=result.insertId; }
    await connection.query("INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active) VALUES ('PLATFORM_SETTINGS','إعدادات المنصة','Platform Settings','إعدادات منصة Radius Lord',1) ON DUPLICATE KEY UPDATE is_active=1");
    await writeAuditLog(req,{actionCode:serverId?'UPDATE':'CREATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:savedId,description:'حفظ اتصال مخدم FreeRADIUS',metadata:{settingGroup:group}},connection);
    await connection.commit(); return res.json({server:safe({id:savedId,setting_value:JSON.stringify(config)})});
  } catch (error) {
    if(connection)await connection.rollback();
    const messages:Record<string,string>={PROBE_CONFIG:'أكمل بيانات قاعدة اختبار مستقلة باسم يبدأ بـ rl_infrastructure_، ولا تستخدم قاعدة زبون.',SECRET_REQUIRED:'أدخل Shared Secret؛ تغيير المخدم يحتاج السر الخاص به.',DATABASE_NOT_READY:'قاعدة الاختبار غير جاهزة.',INVALID_CONFIG:'راجع اسم المخدم وعنوان IPv4 أو الدومين والمنافذ وبيانات الاختبار.',INVALID_ID:'رقم المخدم غير صالح.',NOT_FOUND:'المخدم غير موجود.'};
    return res.status(400).json({message:messages[(error as Error).message] || 'تعذر حفظ المخدم؛ تحقق من مفتاح تشفير الاتصالات وإعدادات القاعدة.'});
  } finally {connection?.release();}
}
export async function radiusServerHealth(req: AuthenticatedRequest, res: Response) {
  let ownsProbe=false, serverId: number | undefined;
  try {
    serverId=id(req);
    if(active.has(serverId)||active.size>=4||Date.now()-(lastChecks.get(serverId)??0)<10000) return res.status(429).json({message:'انتظر اكتمال الفحص وعشر ثوانٍ قبل تكراره.'});
    active.add(serverId); ownsProbe=true; lastChecks.set(serverId,Date.now());
    const saved=await row(serverId), c=JSON.parse(saved.setting_value);
    if(!c.testUsername||!c.testPasswordEncrypted) return res.status(409).json({message:'أدخل حساب اختبار صالحًا ومخصصًا للصحة في إعداد المخدم أولًا.'});
    const health=await checkRadiusHealth(c);
    await db.query('UPDATE platform_settings SET setting_value=? WHERE id=? AND setting_group=? AND BINARY setting_value=BINARY ?',[JSON.stringify({...c,lastHealth:health}),serverId,group,saved.setting_value]);
    await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:serverId,description:'فحص مصادقة ومحاسبة مخدم FreeRADIUS',metadata:{result:health.overall,authentication:health.authentication,accounting:health.accounting,database:health.database}});
    return res.json({health});
  } catch {return res.status(400).json({message:'تعذر تنفيذ فحص FreeRADIUS أو حفظ نتيجته.'});}
  finally {if(ownsProbe&&serverId)active.delete(serverId);}
}

let discoveryRunning=false;
export async function discoverRadiusServers(req:AuthenticatedRequest,res:Response){
 res.setHeader('Cache-Control','no-store');
 if(discoveryRunning)return res.status(429).json({message:'جارٍ اكتشاف الخدمات؛ انتظر اكتمال الفحص.'});
 discoveryRunning=true;
 try{
  const [hosts]:any=await db.query('SELECT s.id,s.name,c.host FROM server_ssh_connections c JOIN database_servers s ON s.id=c.database_server_id WHERE s.archived_at IS NULL ORDER BY s.id LIMIT 50');
  const [saved]:any=await db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius'");
  const configured=saved.map((row:any)=>({id:row.id,...JSON.parse(row.setting_value)}));
  const candidates:any[]=[];
  // Bound concurrent SSH sessions and return per-server failures.
  for(let offset=0;offset<hosts.length;offset+=2){
   candidates.push(...await Promise.all(hosts.slice(offset,offset+2).map(async(host:any)=>{
    try{const discovery=await discoverInstalledRadius(host.id);const existing=configured.find((r:any)=>r.sshServerId===host.id||r.host===discovery.host);
     return {serverId:host.id,name:host.name,...discovery,addedId:existing?.id??null};
    }catch{return {serverId:host.id,name:host.name,host:host.host,status:'unavailable',message:'تعذر اكتشاف FreeRADIUS؛ تحقق من SSH ووجود الخدمة.'};}
   })));
  }
  return res.json({candidates});
 }catch{return res.status(503).json({message:'تعذر قراءة اتصالات SSH المحفوظة. احفظ اتصال مخدم Ubuntu أولًا.'});}
 finally{discoveryRunning=false;}
}
export async function addDiscoveredRadiusServer(req:AuthenticatedRequest,res:Response){
 try{
  const serverId=id(req);
  const discovery=await discoverInstalledRadius(serverId);
  const [rows]:any=await db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius'");
  const existing=rows.find((row:any)=>{const c=JSON.parse(row.setting_value);return c.sshServerId===serverId||c.host===discovery.host;});
  if(existing)return res.json({server:safe(existing),alreadyAdded:true});
  await discoverInstalledRadius(serverId,true);
  const [added]:any=await db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius' AND setting_key=?",['ssh_server_'+serverId]);
  await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:added[0].id,description:'إضافة خدمة FreeRADIUS المكتشفة عبر SSH',metadata:{sshServerId:serverId}});
  return res.json({server:safe(added[0])});
 }catch{return res.status(400).json({message:'تعذرت إضافة الخدمة؛ أعد الاكتشاف وتحقق من اتصال SSH.'});}
}
