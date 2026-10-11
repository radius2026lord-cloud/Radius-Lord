import type {Response} from 'express';
import mysql from 'mysql2/promise';
import {lookup} from 'dns/promises';
import {db} from '../config/db';
import {env} from '../config/env';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {readHostingPreflight} from '../services/hosting-preflight.service';
import {decryptProvisioningSecret} from '../services/provisioning-secrets.service';
import {readPrivateSetting,removeEnvironmentRadius,radiusDatabaseHost} from '../services/radius-provision.service';
import {writeAuditLog} from '../services/audit.service';
class CleanupError extends Error{}
export async function deleteEnvironment(req:AuthenticatedRequest,res:Response){
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({message:'رقم الاشتراك غير صالح.'});
 try{const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));if(req.headers.origin!==new URL(env.FRONTEND_URL).origin&&req.headers.origin!==new URL(hosting.baseUrl).origin)return res.status(403).json({message:'مصدر الطلب غير مصرح.'});}catch{return res.status(409).json({message:'راجع إعداد الوصول للمنصة.'});}
 const central=await db.pool.getConnection();let locked=false,admin:mysql.Connection|undefined,scope:any,journal:any;
 try{
 const [lock]:any=await central.query("SELECT GET_LOCK('radius-lord:database-provisioner',0) acquired");if(!lock[0]?.acquired)throw new CleanupError('يوجد تجهيز أو تنظيف قيد التنفيذ. انتظر اكتماله ثم أعد المحاولة.');locked=true;
 await central.beginTransaction();const [orders]:any=await central.query('SELECT * FROM payment_orders WHERE id=? FOR UPDATE',[id]);const order=orders[0];if(!order?.tenant_id||!order.subscription_id)throw new CleanupError('لا توجد بيئة مرتبطة بهذا الاشتراك.');
 const [rows]:any=await central.query(`SELECT e.*,t.name network_name,d.db_name,d.db_username,d.radius_username,d.database_server_id,d.db_host,d.db_port,dt.code deployment_code FROM tenant_environments e JOIN tenants t ON t.id=e.tenant_id JOIN deployment_types dt ON dt.id=e.deployment_type_id LEFT JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=e.tenant_id WHERE e.tenant_id=? FOR UPDATE`,[order.tenant_id]);scope=rows[0];
 if(!scope||scope.deployment_code!=='shared_cloud'||req.body?.confirmName!==scope.network_name)throw new CleanupError('اكتب اسم الشبكة الصحيح لتأكيد حذف بيئة الكلاود المشتركة.');
 const [licenses]:any=await central.query('SELECT subscription_id FROM subscription_licenses WHERE tenant_id=?',[scope.tenant_id]);if(!licenses[0]||Number(licenses[0].subscription_id)!==Number(order.subscription_id))throw new CleanupError('هذا الاشتراك ليس الاشتراك الحالي للشبكة؛ لا يسمح بحذف بيئة فترة أخرى.');
 const key='environment_'+scope.id;journal=await readPrivateSetting('environment_cleanup',key);if(journal?.status==='complete'){await central.rollback();return res.json({message:'موارد البيئة محذوفة بالفعل.'});}
 if(scope.archived_at&&!journal)throw new CleanupError('البيئة مؤرشفة خارج مسار التنظيف؛ تحتاج مراجعة.');
 const [jobs]:any=await central.query('SELECT id,status FROM environment_provisioning_jobs WHERE environment_id=? ORDER BY id DESC',[scope.id]);if(jobs.some((j:any)=>['queued','running'].includes(j.status)))throw new CleanupError('لا يمكن حذف البيئة أثناء التجهيز أو انتظار تنفيذ المهمة.');
 const [tunnels]:any=await central.query('SELECT COUNT(*) count FROM nas_tunnels WHERE environment_id=?',[scope.id]);if(tunnels[0].count)throw new CleanupError('توجد أنفاق NAS مرتبطة. أزل ربطها أولًا قبل تنظيف التجربة.');
 const [steps]:any=await central.query('SELECT s.* FROM environment_provisioning_steps s JOIN environment_provisioning_jobs j ON j.id=s.job_id WHERE j.environment_id=? ORDER BY s.id DESC',[scope.id]);
 const created=steps.some((s:any)=>s.step_code==='database_create'&&s.status==='success');
 if(scope.db_name&&(!/^rl_tenant_(?:zone_[0-9]+|[0-9]+_[a-f0-9]{16})$/.test(scope.db_name)||!/^rla_[a-f0-9]{16}$/.test(scope.db_username)||!/^rlr_[a-f0-9]{16}$/.test(scope.radius_username)))throw new CleanupError('ملكية موارد القاعدة لا تطابق موارد التوليد المدارة.');
 if(scope.db_name){const [other]:any=await central.query('SELECT id FROM tenant_databases WHERE id<>? AND (db_name=? OR db_username IN (?,?) OR radius_username IN (?,?))',[scope.tenant_database_id,scope.db_name,scope.db_username,scope.radius_username,scope.db_username,scope.radius_username]);if(other.length)throw new CleanupError('يوجد تعارض في ملكية موارد القاعدة.');
 const [servers]:any=await central.query('SELECT * FROM database_servers WHERE id=?',[scope.database_server_id]);const server=servers[0];if(!server||server.tls_ca_reference||server.host!==scope.db_host||Number(server.port)!==Number(scope.db_port))throw new CleanupError('اتصال حساب تجهيز القاعدة غير متاح للتنظيف.');
 admin=await mysql.createConnection({host:server.host,port:server.port,user:server.provisioning_username,password:decryptProvisioningSecret(server.provisioning_password_encrypted),connectTimeout:10000,...(server.tls_required?{ssl:{rejectUnauthorized:true}}:{})});
 if(created&&!journal?.databaseRemoved){const [tables]:any=await admin.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',[scope.db_name,'nas']);if(tables.length){const [nas]:any=await admin.query({sql:`SELECT COUNT(*) count FROM \`${scope.db_name}\`.nas`,timeout:5000});if(nas[0].count)throw new CleanupError('توجد أجهزة NAS داخل قاعدة الشبكة. احذفها أو انقلها أولًا.');}}
 if(!created&&!journal?.databaseRemoved){const [exists]:any=await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[scope.db_name]);if(exists.length)throw new CleanupError('القاعدة موجودة دون إثبات نجاح إنشائها بواسطة هذه المهمة. راجع ملكيتها قبل الحذف.');}
 scope.server=server;}
 const selectionStep=steps.find((s:any)=>s.step_code==='infrastructure_preflight'&&s.resource_reference);const selection=selectionStep?JSON.parse(selectionStep.resource_reference):null;
 if(!journal)journal={status:'cleaning',environmentId:scope.id,tenantId:scope.tenant_id,subscriptionId:order.subscription_id,startedAt:new Date().toISOString(),selection,created,clientHost:steps.find((s:any)=>s.step_code==='database_users'&&s.resource_reference)?.resource_reference??null};
 if(journal.environmentId!==scope.id||journal.tenantId!==scope.tenant_id||journal.subscriptionId!==order.subscription_id)throw new CleanupError('سجل التنظيف لا يطابق البيئة.');
 await central.query("UPDATE tenant_environments SET archived_at=COALESCE(archived_at,NOW()),system_url=NULL,status='failed' WHERE id=?",[scope.id]);await central.query("UPDATE tenants SET status='disabled',archived_at=COALESCE(archived_at,NOW()) WHERE id=?",[scope.tenant_id]);
 await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('environment_cleanup',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify(journal)]);
 await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'TENANT_ENVIRONMENT',entityId:scope.id,tenantId:scope.tenant_id,description:'بدء تنظيف موارد البيئة بإقرار اسم الشبكة',metadata:{event:'environment_cleanup_started',paymentOrderId:id}},central);await central.commit();
 const checkpoint=async()=>{await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_cleanup' AND setting_key=?",[JSON.stringify(journal),key]);};
 if(!journal.radiusRemoved){const runtime=await readPrivateSetting('environment_runtime',key);if(runtime){if(!journal.selection?.radiusSshServerId||runtime.tenantId!==Number(scope.tenant_id))throw new CleanupError('مرجع SSH الخاص بإعداد RADIUS غير متاح.');await removeEnvironmentRadius(journal.selection.radiusSshServerId,scope.id,scope.db_name);}journal.radiusRemoved=true;await checkpoint();}
 if(admin){
 if(!journal.databaseRemoved){if(journal.created)await admin.query({sql:`DROP DATABASE IF EXISTS \`${scope.db_name}\``,timeout:20000});journal.databaseRemoved=true;await checkpoint();}
 if(!journal.accountsRemoved){const hosts=new Set<string>();if(journal.clientHost)hosts.add(journal.clientHost);
 const runtime=await readPrivateSetting('environment_runtime',key);if(runtime?.radiusAccountHosts?.length){for(const host of runtime.radiusAccountHosts)hosts.add(String(host));}
 else if(runtime&&journal.selection?.radiusServerId){const [radiusRows]:any=await central.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[journal.selection.radiusServerId]);if(!radiusRows[0])throw new CleanupError('إعداد مخدم RADIUS الأصلي غير متاح لتنظيف حساباته.');const radius=JSON.parse(radiusRows[0].setting_value);if(await radiusDatabaseHost(scope.server,radius.host)==='127.0.0.1'){hosts.add('localhost');hosts.add('127.0.0.1');}else hosts.add((await lookup(radius.host,{family:4})).address);}
 for(const host of Array.from(hosts)){if(!host||/[\x00-\x20%_'"\\]/.test(host))throw new CleanupError('عنوان حساب القاعدة غير صالح للتنظيف.');for(const username of [scope.db_username,scope.radius_username])await admin.query({sql:`DROP USER IF EXISTS ${mysql.escape(username)}@${mysql.escape(host)}`,timeout:10000});}journal.accountsRemoved=true;await checkpoint();}}
 await central.beginTransaction();if(scope.tenant_database_id)await central.query("UPDATE tenant_databases SET status='inactive',app_pool_limit=0,radius_pool_limit=0,app_password_encrypted=NULL,radius_password_encrypted=NULL,db_password='[deleted]' WHERE id=? AND tenant_id=?",[scope.tenant_database_id,scope.tenant_id]);
 await central.query("UPDATE subscription_licenses SET status='revoked',revoked_at=COALESCE(revoked_at,NOW()) WHERE tenant_id=? AND subscription_id=?",[scope.tenant_id,journal.subscriptionId]);
 await central.query("UPDATE subscription_addons SET status='cancelled' WHERE tenant_id=? AND subscription_id=?",[scope.tenant_id,journal.subscriptionId]);
 await central.query("DELETE FROM platform_settings WHERE setting_group IN ('environment_runtime','environment_activation') AND setting_key=?",[key]);
 await central.query("UPDATE tenant_environment_status SET database_status='unavailable',radius_status='unavailable',reported_at=NOW() WHERE environment_id=?",[scope.id]);
 journal.status='complete';journal.finishedAt=new Date().toISOString();await checkpoint();await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'TENANT_ENVIRONMENT',entityId:scope.id,tenantId:scope.tenant_id,description:'حذف موارد البيئة وأرشفة سجلها مع الحفاظ على تاريخ الدفع',metadata:{event:'environment_cleanup_complete',paymentOrderId:id}},central);await central.commit();return res.json({message:'حُذفت موارد البيئة وأُوقف الدخول إليها. حُفظ سجل الاشتراك والدفع للمراجعة.'});
 }catch(e){await central.rollback();if(journal&&scope?.id){journal.status='failed';await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_cleanup' AND setting_key=?",[JSON.stringify(journal),'environment_'+scope.id]).catch(()=>{});}
 return res.status(e instanceof CleanupError?409:500).json({message:e instanceof CleanupError?e.message:'تعذر إكمال التنظيف. راجع اتصال MySQL وSSH وصلاحياتهما، ثم أعد الحذف لاستكمال الموارد المتبقية.'});
 }finally{await admin?.end().catch(()=>{});if(locked)await central.query("SELECT RELEASE_LOCK('radius-lord:database-provisioner')");central.release();}
}
