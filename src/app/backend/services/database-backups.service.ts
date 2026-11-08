import {provisioningDatabaseOptions} from './database-server-connection.service';
import {randomUUID} from 'crypto';
import mysql from 'mysql2/promise';
import {db} from '../config/db';
import {env} from '../config/env';
import {hasBackupSsh} from './ssh-terminal.service';
import {backupRemote} from './database-backup-remote.service';
import {deliverBackup,cloudPublic,cloudDestinationsReady} from './database-backup-cloud.service';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {writeMasterAdminAuditLog} from './audit.service';

export type BackupJob={id:string;server_id:number;database_name:string;name:string;tenant_id:number|null;kind:'central'|'tenant';status:string;metadata:any;destinations:string[];deliveries:any;delivery_state:string;attempts:number;created_at:string;finished_at:string|null};
type Policy={lastAttemptAt?:string;lastError?:string|null;enabled:boolean;intervalValue:number;intervalUnit:'hours'|'days';time:string;timezone:string;centralServerId:number|null;retentionEnabled:boolean;retentionDays:number;keepLast:number;destinations:string[];revision:string;nextRunAt:string|null};
export class BackupError extends Error{constructor(public status:number,message:string){super(message);}}
let schema:Promise<unknown>|undefined;
export function ensureBackupSchema(){
 return schema??=db.query(`CREATE TABLE IF NOT EXISTS database_backup_jobs(
 id CHAR(36) PRIMARY KEY,batch_key VARCHAR(128) NOT NULL,request_key VARCHAR(220) NOT NULL UNIQUE,
 server_id BIGINT UNSIGNED NOT NULL,database_name VARCHAR(64) NOT NULL,name VARCHAR(200) NOT NULL,
 tenant_id BIGINT UNSIGNED NULL,kind VARCHAR(16) NOT NULL,trigger_type VARCHAR(16) NOT NULL,actor_id BIGINT UNSIGNED NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'queued',metadata JSON NULL,destinations JSON NOT NULL,deliveries JSON NOT NULL,
 delivery_owner CHAR(36) NULL,delivery_state VARCHAR(24) NOT NULL DEFAULT 'pending',attempts INT NOT NULL DEFAULT 0,last_error VARCHAR(160) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),finished_at DATETIME(6) NULL,
 next_attempt_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),removed_at DATETIME(6) NULL,
 INDEX backup_queue(status,next_attempt_at),INDEX backup_retention(server_id,database_name,status,finished_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error:unknown)=>{schema=undefined;throw error;});
}
export const parse=<T=any>(value:unknown,fallback:T):T=>{try{return typeof value==='string'?JSON.parse(value):value as T??fallback;}catch{return fallback;}};
async function setting(){
 const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='database_backups' AND setting_key='policy'");
 return parse<Partial<Policy>>(rows[0]?.setting_value,{});
}
export async function backupPolicy():Promise<Policy>{
 const saved=await setting();
 return {enabled:false,intervalValue:1,intervalUnit:'days',time:'03:00',timezone:'Asia/Damascus',centralServerId:null,retentionEnabled:false,retentionDays:30,keepLast:3,destinations:[],revision:'initial',nextRunAt:null,...saved};
}
function nextRun(policy:Policy,from:Date){
 if(policy.intervalUnit==='hours')return new Date(from.getTime()+policy.intervalValue*3600000).toISOString();
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:policy.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=(date:Date)=>Object.fromEntries(format.formatToParts(date).map(part=>[part.type,part.value]));
 const current=parts(from);
 const targetDate=new Date(Date.UTC(Number(current.year),Number(current.month)-1,Number(current.day)+policy.intervalValue));
 const wanted=targetDate.toISOString().slice(0,10);
 // Search UTC instants for the requested local day and time, including DST transitions.
 for(let timestamp=targetDate.getTime()-14*3600000;timestamp<targetDate.getTime()+38*3600000;timestamp+=60000){
  const value=parts(new Date(timestamp));
  if([value.year,value.month,value.day].join('-')===wanted&&value.hour+':'+value.minute>=policy.time)return new Date(timestamp).toISOString();
 }
 throw new BackupError(422,'تعذر حساب موعد النسخة القادمة لهذه المنطقة الزمنية.');
}
export async function backupOptions(){
 await ensureBackupSchema();
 const [servers]:any=await db.query("SELECT id,name,host,port FROM database_servers WHERE archived_at IS NULL AND status='active' ORDER BY id");
 const [networks]:any=await db.query("SELECT t.id,t.name,d.id databaseId,d.database_server_id serverId,d.db_name databaseName FROM tenant_databases d JOIN tenants t ON t.id=d.tenant_id WHERE d.status='active' AND t.archived_at IS NULL ORDER BY t.id");
 return {servers,networks};
}
export async function saveBackupPolicy(body:any){
 const current=await backupPolicy();
 const value=Number(body.intervalValue),retentionDays=Number(body.retentionDays),keepLast=Number(body.keepLast);
 const timezone=String(body.timezone??''),time=String(body.time??'');
 if(!Number.isInteger(value)||value<1||value>(body.intervalUnit==='hours'?720:30)||!['hours','days'].includes(body.intervalUnit)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||
 !Number.isInteger(retentionDays)||retentionDays<1||retentionDays>365||!Number.isInteger(keepLast)||keepLast<1||keepLast>100)throw new BackupError(422,'تحقق من مدة التكرار والتوقيت وسياسة الاحتفاظ.');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw new BackupError(422,'اختر منطقة زمنية صحيحة.');}
 const centralServerId=body.centralServerId?Number(body.centralServerId):null;
 if(centralServerId!==null&&(!Number.isSafeInteger(centralServerId)||centralServerId<1))throw new BackupError(422,'اختر خادم القاعدة المركزية.');
 const destinations=Array.isArray(body.destinations)?Array.from(new Set<string>(body.destinations)):[];
 if(destinations.some(value=>!['telegram','drive'].includes(value)))throw new BackupError(422,'وجهة الرفع غير صالحة.');
 if(body.enabled===true)await cloudDestinationsReady(destinations);
 if(centralServerId){const [rows]:any=await db.query("SELECT id FROM database_servers WHERE id=? AND archived_at IS NULL AND status='active'",[centralServerId]);if(!rows.length)throw new BackupError(422,'خادم القاعدة المركزية غير متاح.');}
 if(body.enabled===true&&!centralServerId)throw new BackupError(422,'حدد خادم القاعدة المركزية قبل تفعيل الجدولة.');
 const policy:Policy={...current,enabled:body.enabled===true,intervalValue:value,intervalUnit:body.intervalUnit,time,timezone,centralServerId,retentionEnabled:body.retentionEnabled===true,retentionDays,keepLast,destinations,revision:randomUUID(),nextRunAt:null,lastError:null,lastAttemptAt:undefined};
 policy.nextRunAt=policy.enabled?nextRun(policy,new Date()):null;
 await db.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES('database_backups','policy',?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[JSON.stringify(policy)]);
 return policy;
}
export async function requestBackups(input:any,req?:AuthenticatedRequest,scheduleKey?:string){
 await ensureBackupSchema();
 const policy=await backupPolicy(),options=await backupOptions();
 const scope=String(input?.scope??'all');
 if(!['all','central','network','networks'].includes(scope))throw new BackupError(422,'اختر نطاق النسخ.');
 const requestId=scheduleKey||String(input?.requestId??'');
 if(!scheduleKey&&!/^[a-f0-9-]{36}$/.test(requestId))throw new BackupError(422,'أعد إرسال طلب النسخ.');
 const destinations=scheduleKey?policy.destinations:Array.isArray(input?.destinations)?Array.from(new Set<string>(input.destinations)):[];
 await cloudDestinationsReady(destinations);
 const targets:Array<{serverId:number;database:string;name:string;tenantId:number|null;kind:'central'|'tenant'}>=[];
 if(scope==='all'||scope==='central'){
  if(!policy.centralServerId)throw new BackupError(422,'حدد خادم القاعدة المركزية من إعدادات النسخ.');
  targets.push({serverId:policy.centralServerId,database:env.DB_NAME,name:'القاعدة المركزية',tenantId:null,kind:'central'});
 }
 if(scope!=='central'){
  const networks=options.networks.filter((network:any)=>scope!=='network'||Number(network.id)===Number(input.tenantId));
  if(scope==='network'&&!networks.length)throw new BackupError(404,'قاعدة الشبكة غير متاحة.');
  for(const network of networks)targets.push({serverId:Number(network.serverId),database:network.databaseName,name:network.name,tenantId:Number(network.id),kind:'tenant'});
 }
 if(!targets.length)throw new BackupError(422,'لا توجد قواعد مطابقة للنسخ.');
 for(const id of new Set(targets.map(target=>target.serverId))){
  if(!options.servers.some((server:any)=>Number(server.id)===id)||!await hasBackupSsh(id))throw new BackupError(422,'جهّز اتصال SSH المحفوظ لخوادم القواعد المطلوبة أولًا.');
 }
 const connection=await db.pool.getConnection();
 try{
  await connection.beginTransaction();
  for(const target of targets){
   await connection.query(`INSERT INTO database_backup_jobs(id,batch_key,request_key,server_id,database_name,name,tenant_id,kind,trigger_type,actor_id,destinations,deliveries,created_at,next_attempt_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE id=id`,[randomUUID(),requestId,requestId+':'+target.kind+':'+target.serverId+':'+target.database,target.serverId,target.database,target.name,target.tenantId,target.kind,scheduleKey?'scheduled':'manual',req?.auth?.accountId??null,JSON.stringify(destinations),'{}']);
  }
  if(req)await writeMasterAdminAuditLog(req,req.auth!.accountId,{actionCode:'CREATE',entityTypeCode:'DATABASE_SERVER',entityId:targets[0].serverId,description:'طلب نسخ احتياطي لقواعد البيانات',metadata:{operation:'database_backup',batchId:requestId,count:targets.length,destinations}},connection);
  await connection.commit();
 }catch(error){await connection.rollback().catch(()=>{});throw error;}finally{connection.release();}
 return {batchId:requestId,count:targets.length};
}
function job(row:any):BackupJob{
 return {...row,metadata:parse(row.metadata,{}),destinations:parse(row.destinations,[]),deliveries:parse(row.deliveries,{})};
}
export async function listBackups(page=1,filters:{q?:string;status?:string;kind?:string;trigger?:string}={}){
 await ensureBackupSchema();
 const [policy,options,cloud]=await Promise.all([backupPolicy(),backupOptions(),cloudPublic()]);
 const clauses:string[]=[],params:unknown[]=[];
 const query=String(filters.q??"").trim().slice(0,100);
 if(query){clauses.push("(LOCATE(?,name)>0 OR LOCATE(?,database_name)>0 OR LOCATE(?,id)>0)");params.push(query,query,query);}
 if(filters.status==="pending")clauses.push("status IN ('queued','running','waiting_remote')");
 else if(filters.status==="attention")clauses.push("delivery_state='attention'");
 else if(["succeeded","failed"].includes(filters.status??"")){clauses.push("status=?");params.push(filters.status);}
 if(["central","tenant"].includes(filters.kind??"")){clauses.push("kind=?");params.push(filters.kind);}
 if(["manual","scheduled"].includes(filters.trigger??"")){clauses.push("trigger_type=?");params.push(filters.trigger);}
 const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
 const [totals]:any=await db.query("SELECT COUNT(*) total FROM database_backup_jobs"+where,params);
 const [rows]:any=await db.query("SELECT *,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at,DATE_FORMAT(removed_at,'%Y-%m-%dT%H:%i:%sZ') removed_at FROM database_backup_jobs"+where+" ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?",[...params,(page-1)*50]);
 const [counts]:any=await db.query("SELECT status,COUNT(*) count,SUM(delivery_state='attention') attention FROM database_backup_jobs GROUP BY status");
 return {policy,options,cloud,counts,total:Number(totals[0].total),items:rows.map((row:any)=>{
  const value=job(row);
  const deliveries=Object.fromEntries(Object.entries(value.deliveries).map(([key,entry]:[string,any])=>{const {sessionEncrypted,...safe}=entry;return [key,safe];}));
  return {...value,deliveries};
 }),page};
}
export async function backupForDownload(id:string){
 await ensureBackupSchema();
 const [rows]:any=await db.query("SELECT * FROM database_backup_jobs WHERE id=? AND status='succeeded' AND removed_at IS NULL",[id]);
 if(!rows[0])throw new BackupError(404,'النسخة غير متاحة للتنزيل.');
 return job(rows[0]);
}
export async function retryDelivery(id:string,destination:string){
 if(!['telegram','drive'].includes(destination))throw new BackupError(422,'الوجهة غير صالحة.');
 const value=await backupForDownload(id);
 const old=value.deliveries[destination];
 if(!value.destinations.includes(destination)||!old||!['failed','unknown'].includes(old.status))throw new BackupError(409,'لا توجد محاولة رفع قابلة للإعادة لهذه الوجهة.');
 await cloudDestinationsReady([destination]);
 const deliveries={...value.deliveries,[destination]:{...old,status:'pending',error:null}};
 const [updated]:any=await db.query("UPDATE database_backup_jobs SET deliveries=?,delivery_state='pending',next_attempt_at=UTC_TIMESTAMP(6) WHERE id=? AND delivery_state<>'running'",[JSON.stringify(deliveries),id]);
 if(!updated.affectedRows)throw new BackupError(409,'يجري الرفع الآن. حدّث السجل قبل إعادة المحاولة.');
}
export async function reconcileBackup(id:string){
 const [rows]:any=await db.query("SELECT * FROM database_backup_jobs WHERE id=? AND removed_at IS NULL",[id]);
 if(!rows[0])throw new BackupError(404,'النسخة غير موجودة.');
 const value=job(rows[0]),remote=await backupRemote(Number(value.server_id),'status',value.id);
 if(remote.status==='verified'&&remote.verified&&/^[a-f0-9]{64}$/.test(remote.sha256)){
  await db.query("UPDATE database_backup_jobs SET status='succeeded',metadata=?,finished_at=COALESCE(finished_at,UTC_TIMESTAMP(6)),last_error=NULL,next_attempt_at=UTC_TIMESTAMP(6) WHERE id=?",[JSON.stringify(remote),id]);
 }
 return {status:remote.status};
}
async function credentials(value:BackupJob){
 const [rows]:any=await db.query("SELECT * FROM database_servers WHERE id=? AND archived_at IS NULL AND status='active'",[value.server_id]);
 const server=rows[0];
 if(!server)throw Error('DATABASE_SERVER_UNAVAILABLE');
 if(value.kind==='tenant'){
  const [matching]:any=await db.query("SELECT id FROM tenant_databases WHERE tenant_id=? AND database_server_id=? AND db_name=? AND status='active'",[value.tenant_id,value.server_id,value.database_name]);
  if(!matching.length)throw Error('BACKUP_TARGET_CHANGED');
 }
 const source=provisioningDatabaseOptions(server),password=String(source.password);
 const connection=await mysql.createConnection({...source,database:value.database_name});
 try{
  const [uuid]:any=await connection.query('SELECT @@server_uuid id');
  if(value.kind==='central'){
   const [central]:any=await db.query('SELECT @@server_uuid id');
   if(central[0].id!==uuid[0].id)throw Error('BACKUP_CENTRAL_SERVER_MISMATCH');
  }
  const [sizes]:any=await connection.query("SELECT COALESCE(SUM(data_length+index_length),0) bytes FROM information_schema.tables WHERE table_schema=?",[value.database_name]);
  return {database:value.database_name,host:server.host,port:Number(server.port),user:server.provisioning_username,password,tls:Boolean(server.tls_required),serverUuid:uuid[0].id,estimatedBytes:Number(sizes[0].bytes)};
 }finally{await connection.end();}
}
async function processJob(value:BackupJob){
 if(value.status==='succeeded'){
  await deliverBackup(value);
  return;
 }
 try{
  await db.query("UPDATE database_backup_jobs SET status='running',next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 15 SECOND WHERE id=?",[value.id]);
  const remote=await backupRemote(value.server_id,'status',value.id);
  const result=remote.status==='not_found'||remote.status==='queued'?await backupRemote(value.server_id,'start',value.id,await credentials(value)):remote;
  await db.query('UPDATE database_backup_jobs SET attempts=0 WHERE id=?',[value.id]);
  if(result.status==='verified'&&result.verified===true&&Number.isSafeInteger(result.bytes)&&result.bytes>0&&/^[a-f0-9]{64}$/.test(result.sha256)){
   await db.query("UPDATE database_backup_jobs SET status='succeeded',metadata=?,finished_at=UTC_TIMESTAMP(6),last_error=NULL,next_attempt_at=UTC_TIMESTAMP(6) WHERE id=?",[JSON.stringify(result),value.id]);
  }else if(result.status==='failed')await db.query("UPDATE database_backup_jobs SET status='failed',last_error=?,finished_at=UTC_TIMESTAMP(6) WHERE id=?",[String(result.error??'BACKUP_FAILED').slice(0,160),value.id]);
  else if(['queued','running','verifying'].includes(result.status)){
   await db.query("UPDATE database_backup_jobs SET metadata=?,last_error=NULL WHERE id=?",[JSON.stringify({status:result.status,startedAt:result.startedAt}),value.id]);
  }
 }catch(error){
  const code=String((error as any)?.code||(error as Error).message||'BACKUP_REMOTE_UNAVAILABLE');
  const terminal=value.attempts>=4||['BACKUP_TARGET_CHANGED','BACKUP_CENTRAL_SERVER_MISMATCH','DATABASE_SERVER_UNAVAILABLE'].includes(code);
  await db.query("UPDATE database_backup_jobs SET status=?,attempts=attempts+1,last_error=?,next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 60 SECOND,finished_at=IF(?,UTC_TIMESTAMP(6),finished_at) WHERE id=?",[terminal?'failed':'waiting_remote',/^[A-Z0-9_]+$/.test(code)?code:'BACKUP_REMOTE_UNAVAILABLE',terminal,value.id]);
 }
}
async function retention(policy:Policy){
 if(!policy.retentionEnabled)return;
 const [rows]:any=await db.query(`SELECT j.* FROM database_backup_jobs j WHERE j.status='succeeded' AND j.delivery_state='done' AND j.removed_at IS NULL
 AND j.finished_at<UTC_TIMESTAMP()-INTERVAL ? DAY AND
 (SELECT COUNT(*) FROM database_backup_jobs n WHERE n.server_id=j.server_id AND n.database_name=j.database_name AND n.kind=j.kind
  AND n.status='succeeded' AND n.removed_at IS NULL AND (n.finished_at>j.finished_at OR n.finished_at=j.finished_at AND n.id>j.id))>=? ORDER BY j.finished_at LIMIT 1`,[policy.retentionDays,policy.keepLast]);
 if(rows[0]){
  const value=job(rows[0]);
  await backupRemote(value.server_id,'remove',value.id);
  await db.query("UPDATE database_backup_jobs SET removed_at=UTC_TIMESTAMP(6) WHERE id=?",[value.id]);
 }
}
export function startDatabaseBackupWorker(){
 let stopped=false,timer:ReturnType<typeof setTimeout>;
 async function tick(){
  let connection:mysql.PoolConnection|undefined,locked=false,heartbeat:ReturnType<typeof setInterval>|undefined;
  try{
   await ensureBackupSchema();
   const activeConnection=await db.pool.getConnection();connection=activeConnection;
   const [locks]:any=await activeConnection.query("SELECT GET_LOCK('lord-database-backups',0) acquired");
   locked=Number(locks[0]?.acquired)===1;if(!locked)return;
   heartbeat=setInterval(()=>{void connection?.ping().catch(()=>{});},30000);
   const policy=await backupPolicy();
   if(policy.enabled&&policy.nextRunAt&&Date.parse(policy.nextRunAt)<=Date.now()&&(!policy.lastAttemptAt||Date.now()-Date.parse(policy.lastAttemptAt)>=60000)){
    const updated={...policy,lastAttemptAt:new Date().toISOString()};
    try{
     await requestBackups({scope:'all'},undefined,'schedule:'+policy.revision+':'+policy.nextRunAt);
     updated.nextRunAt=nextRun(policy,new Date());updated.lastError=null;
    }catch(error){updated.lastError=error instanceof BackupError||error instanceof Error&&error.name==='CloudError'?error.message:'تعذر إدراج النسخ المجدولة. تحقق من الخوادم والوجهات.';}
    await db.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='database_backups' AND setting_key='policy' AND setting_value=?",[JSON.stringify(updated),JSON.stringify(policy)]);
   }
   const [rows]:any=await db.query(`SELECT * FROM database_backup_jobs WHERE
    (status IN ('queued','running','waiting_remote') OR status='succeeded' AND delivery_state IN ('pending','running'))
    AND next_attempt_at<=UTC_TIMESTAMP(6) ORDER BY status='running' DESC,created_at,id LIMIT 1`);
   if(rows[0])await processJob(job(rows[0]));else await retention(policy);
  }catch(error){console.error('[database-backups]',{code:(error as any)?.code||'UNAVAILABLE'});}
  finally{
   if(heartbeat)clearInterval(heartbeat);
   if(connection){try{if(locked)await connection.query("SELECT RELEASE_LOCK('lord-database-backups')");connection.release();}catch{connection.destroy();}}
   if(!stopped)timer=setTimeout(()=>void tick(),15000);
  }
 }
 timer=setTimeout(()=>void tick(),15000);
 return ()=>{stopped=true;clearTimeout(timer);};
}

export async function restartFailedBackup(id:string,requestId:string,req:AuthenticatedRequest){
 await ensureBackupSchema();
 const [rows]:any=await db.query("SELECT * FROM database_backup_jobs WHERE id=? AND status='failed'",[id]);
 if(!rows[0])throw new BackupError(409,'يمكن إعادة محاولة النسخ المتعذّر فقط.');
 const previous=job(rows[0]);
 return requestBackups({requestId,scope:previous.kind==='central'?'central':'network',tenantId:previous.tenant_id,destinations:previous.destinations},req);
}
