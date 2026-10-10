import {createHash,randomBytes} from 'crypto';
import mysql from 'mysql2/promise';
import {lookup} from 'dns/promises';
import {db} from '../config/db';
import {readHostingPreflight} from './hosting-preflight.service';
import {decryptProvisioningSecret} from './provisioning-secrets.service';
import {checkRadiusHealth} from './radius-database-health.service';
import {RouterApi} from './routeros-api.service';
import {inspectRouter,preflightInventory,validateProvision} from './ovpn-provision.service';
import {inspectInstalledRadius} from './ssh-terminal.service';
export type InfrastructureSelection={databaseServerId:number;radiusServerId:number;gatewayId:number;radiusSshServerId:number};
export class InfrastructureNotReady extends Error {code='INFRASTRUCTURE_NOT_READY';constructor(){super('افحص صحة البنية التحتية وأكمل جميع الشروط قبل توليد البيئة.');}}
const group='infrastructure_health';
export async function readInfrastructureSelection():Promise<InfrastructureSelection|null>{
 const [rows]:any=await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?',[group,'selection']);
 return rows[0]?JSON.parse(rows[0].setting_value):null;
}
async function snapshot(){
 const selection=await readInfrastructureSelection();
 if(!selection)throw new InfrastructureNotReady();
 const [databases]:any=await db.query('SELECT * FROM database_servers WHERE id=? AND archived_at IS NULL',[selection.databaseServerId]);
 const [radiusRows]:any=await db.query("SELECT * FROM platform_settings WHERE id=? AND setting_group='free_radius'",[selection.radiusServerId]);
 const [gateways]:any=await db.query('SELECT * FROM ovpn_gateways WHERE id=?',[selection.gatewayId]);
 const [hosting]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='local_hosting' AND setting_key='shared_cloud_connection'");
 let ssh:any=null;try{const [rows]:any=await db.query('SELECT * FROM server_ssh_connections WHERE database_server_id=?',[selection.radiusSshServerId]);ssh=rows[0];}catch(e){if((e as any)?.code!=='ER_NO_SUCH_TABLE')throw e;}
 const radius=radiusRows[0]?JSON.parse(radiusRows[0].setting_value):null;
 // Probe output changes must not invalidate the saved configuration fingerprint.
 const {lastHealth,...radiusConfig}=radius??{};
 const gateway=gateways[0]?JSON.parse(gateways[0].settings_json):null;
 const {display_health,last_checked_at,...gatewayConfig}=gateway??{};
 const fingerprint=createHash('sha256').update(JSON.stringify({selection,database:databases[0],radius:radiusConfig,gateway:gatewayConfig,gatewaySecret:gateways[0]?.api_password_encrypted,hosting:hosting[0]?.setting_value,ssh})).digest('hex');
 return {selection,database:databases[0],radius,gateway,gatewaySecret:gateways[0]?.api_password_encrypted,ssh,fingerprint};
}
export async function readInfrastructureReport(){
 const [rows]:any=await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?',[group,'last_report']);
 if(!rows[0])return null;
 const report=JSON.parse(rows[0].setting_value);
 let current=false;try{current=(await snapshot()).fingerprint===report.fingerprint;}catch{}
 const age=Date.now()-new Date(report.checkedAt).getTime();
 const ready=report.ready===true&&current&&age>=0&&age<60000;
 return {...report,ready,stale:!current||age<0||age>=60000};
}
async function checkDatabase(s:any,environmentId?:number){
 if(!s||s.status!=='active'||(!environmentId&&!s.accepts_new_environments)||s.tls_ca_reference)throw new Error('خادم القواعد غير متاح لاستقبال البيئات أو يحتاج شهادة مخصصة.');
 let admin:mysql.Connection|undefined,client:mysql.Connection|undefined,createdDatabase=false,createdUser=false;
 const probe='rl_probe_'+randomBytes(10).toString('hex'),user='rlp_'+randomBytes(8).toString('hex'),password=randomBytes(32).toString('base64url');let account='';
 const options={host:s.host,port:s.port,connectTimeout:8000,...(s.tls_required?{ssl:{rejectUnauthorized:true}}:{})};
 try{
  admin=await mysql.createConnection({...options,user:s.provisioning_username,password:decryptProvisioningSecret(s.provisioning_password_encrypted)});
  const [info]:any=await admin.query({sql:'SELECT VERSION() version,USER() source,@@GLOBAL.max_connections max_connections',timeout:5000});
  if(!/^8\./.test(info[0].version)||/mariadb/i.test(info[0].version))throw new Error('يلزم MySQL 8.');
  const [usage]:any=await db.query('SELECT COALESCE(SUM(app_pool_limit),0) app,COALESCE(SUM(radius_pool_limit),0) radius FROM tenant_databases WHERE database_server_id=? AND (? IS NULL OR id NOT IN (SELECT tenant_database_id FROM tenant_environments WHERE id=? AND tenant_database_id IS NOT NULL))',[s.id,environmentId??null,environmentId??null]);
  if(Number(s.app_connection_budget)<Number(usage[0].app)+4||Number(s.radius_connection_budget)<Number(usage[0].radius)+4||Number(info[0].max_connections)<Number(s.app_connection_budget)+Number(s.radius_connection_budget)+10)throw new Error('ميزانية اتصالات MySQL لا تكفي لبيئة إضافية مع احتياطي الإدارة.');
  const source=String(info[0].source).split('@').slice(1).join('@');
  if(!source||/[\x00-\x1f%_]/.test(source)||source.length>255)throw new Error('تعذر تحديد مصدر اتصال الفحص.');
  account=mysql.escape(user)+'@'+mysql.escape(source);
  const run=(sql:string)=>admin!.query({sql,timeout:5000});
  await run(`CREATE DATABASE \`${probe}\``);createdDatabase=true;
  await run(`CREATE USER ${account} IDENTIFIED BY ${mysql.escape(password)}`);createdUser=true;
  await run(`CREATE TABLE \`${probe}\`.verification (id INT PRIMARY KEY,value INT NOT NULL)`);
  await run(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${probe.replace(/_/g,'\\_')}\`.* TO ${account}`);
  client=await mysql.createConnection({...options,user,password,database:probe});
  for(const sql of ['INSERT INTO verification VALUES (1,1)','UPDATE verification SET value=2 WHERE id=1','SELECT value FROM verification WHERE id=1','DELETE FROM verification WHERE id=1'])await client.query({sql,timeout:5000});
 }finally{
  await client?.end().catch(()=>{});
  let cleanupFailed=false;
  if(admin){if(createdUser)try{await admin.query({sql:`DROP USER ${account}`,timeout:5000});}catch{cleanupFailed=true;}
   if(createdDatabase)try{await admin.query({sql:`DROP DATABASE \`${probe}\``,timeout:5000});}catch{cleanupFailed=true;}
   await admin.end().catch(()=>{});}
  if(cleanupFailed)throw new Error('تعذر تنظيف موارد فحص MySQL؛ راجع الخادم قبل إعادة الفحص.');
 }
}
async function executeInfrastructureChecks(environmentId?:number){
 const s=await snapshot();
 const checks:Array<{key:string;label:string;status:'ready'|'failed'|'not_checked';message:string;checkedAt:string}>=[];
 async function check(key:string,label:string,operation:()=>Promise<string>){try{checks.push({key,label,status:'ready',message:await operation(),checkedAt:new Date().toISOString()});}catch(e){checks.push({key,label,status:'failed',message:e instanceof Error&&!('code' in e)&&!('level' in e)?e.message:'فشل الاتصال أو الصلاحيات؛ راجع إعداد الخدمة.',checkedAt:new Date().toISOString()});}}
 await check('hosting','استضافة المنصة',async()=>{
  const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));const nonce=randomBytes(16).toString('hex');
  const response=await fetch(`${hosting.baseUrl}/api/platform-health?nonce=${nonce}`,{redirect:'error',signal:AbortSignal.timeout(8000)});
  const body=await response.json();if(!response.ok||body.application!=='radius-lord'||body.nonce!==nonce||body.backend!=='reachable')throw new Error('لم يستجب تطبيق Radius Lord والخلفية على عنوان الاستضافة المحفوظ.');
  return 'نجحت استجابة الواجهة والخلفية على عنوان الاستضافة المحفوظ.';
 });
 await check('database','MySQL والصلاحيات والسعة',async()=>{await checkDatabase(s.database,environmentId);return 'نجح إنشاء قاعدة وحساب مؤقتين والقراءة والكتابة والتنظيف وفحص السعة.';});
 await check('radius_service','خدمة FreeRADIUS وإعداداتها',async()=>{if(!s.ssh)throw new Error('اختر اتصال SSH المحفوظ لمخدم FreeRADIUS.');const [sshAddresses,radiusAddresses]=await Promise.all([lookup(s.ssh.host,{all:true}),lookup(s.radius?.host??'',{all:true})]);if(!sshAddresses.some(a=>radiusAddresses.some(b=>a.address===b.address)))throw new Error('اتصال SSH المختار لا يشير إلى عنوان مخدم FreeRADIUS المحدد.');await inspectInstalledRadius(s.selection.radiusSshServerId);return 'الخدمة مثبتة وقيد التشغيل، ونجح فحص إعداداتها عبر SSH.';});
 await check('radius','مصادقة ومحاسبة FreeRADIUS',async()=>{
  if(!s.radius?.testUsername||!s.radius?.testPasswordEncrypted||!s.radius?.probeDatabasePasswordEncrypted)throw new Error('حدد حسابًا وقاعدة اختبار مستقلة لـ FreeRADIUS أولًا، من إعداد مخدم RADIUS.');
  const health=await checkRadiusHealth(s.radius);
  if(health.overall!=='healthy')throw new Error('لم تنجح المصادقة والمحاسبة والتحقق من السجل في قاعدة الاختبار.');
  return 'نجحت المصادقة والمحاسبة والتحقق من سجل الاختبار في القاعدة المحددة.';
 });
 await check('ovpn','بوابة OpenVPN وإعداداتها وسعتها',async()=>{
  const g=s.gateway;if(!g?.enabled||g.provision_state!=='ready'||!s.gatewaySecret)throw new Error('أكمل تجهيز بوابة OpenVPN وتفعيلها أولًا.');
  const api=await RouterApi.connect({host:g.api_host,port:g.api_port,username:g.api_username,password:decryptProvisioningSecret(s.gatewaySecret),secure:g.api_tls});
  try{const options=validateProvision({...g,pool_mode:'existing',profile_mode:'existing',certificate_mode:'existing'});const inventory=await inspectRouter(api);const {server}=preflightInventory(inventory,options);
   if(!server||!(['yes','true'].includes(server.enabled)||['no','false'].includes(server.disabled))||Number(server.port)!==options.ovpn_port||server.certificate!==options.certificate_name||server['default-profile']!==options.ppp_profile||(server.protocol??'tcp')!=='tcp')throw new Error('إعداد خدمة OpenVPN الفعلي لا يطابق الإعداد المحفوظ.');
   const used=await api.command('/ip/pool/used/print',{'.proplist':'pool,address'});const pool=inventory.pools.find(p=>p.name===options.pool_name)!;
   const ip=(v:string)=>v.split('.').reduce((n,x)=>n*256+Number(x),0);
   const capacity=pool.ranges.split(',').reduce((n,r)=>{const [a,b]=r.split('-');return n+ip(b??a)-ip(a)+1;},0);
   if(!Number.isFinite(capacity)||capacity<=used.filter(r=>r.pool===options.pool_name).length)throw new Error('لا يوجد عنوان متاح في نطاق OpenVPN.');
   return 'نجح API والتحقق من الخدمة والشهادة وPPP Profile ونطاق العناوين؛ تجربة النفق تتم عند تجهيز الزبون.';
  }finally{api.close();}
 });
 const current=await snapshot();
 const report={checkedAt:new Date().toISOString(),fingerprint:s.fingerprint,selection:s.selection,checks,ready:checks.every(c=>c.status==='ready')&&current.fingerprint===s.fingerprint};
 await db.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES (?,? ,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[group,'last_report',JSON.stringify(report)]);
 return report;
}
export async function requireInfrastructureReady(environmentId?:number){const report=await checkInfrastructure(environmentId);if(!report.ready)throw new InfrastructureNotReady();return report;}

export async function checkInfrastructure(environmentId?:number){
 const lock=await db.pool.getConnection();let acquired=false;
 try{const [rows]:any=await lock.query("SELECT GET_LOCK('radius-lord:infrastructure-health',0) acquired");acquired=Boolean(rows[0]?.acquired);if(!acquired)throw new InfrastructureNotReady();return await executeInfrastructureChecks(environmentId);}
 finally{try{if(acquired)await lock.query("SELECT RELEASE_LOCK('radius-lord:infrastructure-health')");}finally{lock.release();}}
}
