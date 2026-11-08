import {backupFilename} from './database-backup-filename.service';
import {randomUUID} from 'crypto';
import {db} from '../config/db';
import {ensureBackupSchema,backupForDownload,backupPolicy,backupOptions,parse,BackupError,nextRun} from './database-backups.service';
import {backupRemote} from './database-backup-remote.service';
import {writeMasterAdminAuditLog} from './audit.service';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';

let schema:Promise<unknown>|undefined;
export function ensureVerificationSchema(){
 return schema??=db.query(`CREATE TABLE IF NOT EXISTS database_backup_verifications(
 id CHAR(36) PRIMARY KEY,request_id CHAR(36) NOT NULL UNIQUE,backup_id CHAR(36) NOT NULL,
 server_id BIGINT UNSIGNED NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'queued',result JSON NULL,attempts INT NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),started_at DATETIME(6) NULL,finished_at DATETIME(6) NULL,
 INDEX verification_queue(status,created_at),INDEX verification_source(backup_id,created_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error:unknown)=>{schema=undefined;throw error;});
}
export async function requestVerification(id:string,requestId:string,req:AuthenticatedRequest){
 await ensureVerificationSchema();
 if(!/^[a-f0-9-]{36}$/.test(requestId))throw new BackupError(422,'طلب الفحص غير صالح.');
 const backup=await backupForDownload(id);
 const connection=await db.pool.getConnection();let locked=false;
 try{
  const [lock]:any=await connection.query("SELECT GET_LOCK('radius-backup-verification-request',0) acquired");locked=Boolean(lock[0].acquired);
  if(!locked)throw new BackupError(409,'يجري تسجيل طلب فحص. أعد المحاولة.');
  const [existing]:any=await connection.query("SELECT id,backup_id FROM database_backup_verifications WHERE request_id=? OR (backup_id=? AND status IN ('queued','running')) ORDER BY created_at DESC LIMIT 1",[requestId,id]);
  if(existing[0]){if(existing[0].backup_id!==id)throw new BackupError(409,'معرّف الطلب مستخدم لنسخة أخرى.');return {id:existing[0].id};}
  const checkId=randomUUID();await connection.beginTransaction();
  await connection.query("INSERT INTO database_backup_verifications(id,request_id,backup_id,server_id,actor_id,created_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP(6))",[checkId,requestId,id,backup.server_id,req.auth!.accountId]);
  await writeMasterAdminAuditLog(req,req.auth!.accountId,{actionCode:'CREATE',entityTypeCode:'DATABASE_SERVER',entityId:backup.server_id,description:'طلب فحص استعادة نسخة داخل MySQL مؤقت معزول',metadata:{operation:'backup_restore_check',backupId:id,checkId}},connection);
  await connection.commit();return {id:checkId};
 }catch(error){await connection.rollback().catch(()=>{});throw error;}
 finally{if(locked)await connection.query("SELECT RELEASE_LOCK('radius-backup-verification-request')").catch(()=>{});connection.release();}
}
export async function processNextVerification(activeOnly=false){
 await ensureVerificationSchema();
 const [rows]:any=await db.query("SELECT v.*,b.metadata,b.database_name FROM database_backup_verifications v JOIN database_backup_jobs b ON b.id=v.backup_id WHERE v.status "+(activeOnly?"='running'":"IN ('queued','running')")+" ORDER BY v.status='running' DESC,v.created_at LIMIT 1");
 const row=rows[0];if(!row)return false;
 try{
  await db.query("UPDATE database_backup_verifications SET status='running',started_at=COALESCE(started_at,UTC_TIMESTAMP(6)) WHERE id=?",[row.id]);
  const metadata=parse<any>(row.metadata,{});
  let result=await backupRemote(Number(row.server_id),'verify-status',row.backup_id,{checkId:row.id});
  if(result.status==='not_found')result=await backupRemote(Number(row.server_id),'verify-start',row.backup_id,{checkId:row.id,sha256:metadata.sha256,database:row.database_name});
  const terminal=result.status==='failed'||result.status==='succeeded';
  const status=result.status==='succeeded'&&result.cleanupComplete===true&&Number(result.tables)>0?'succeeded':terminal?'failed':'running';
  await db.query("UPDATE database_backup_verifications SET status=?,result=?,attempts=0,finished_at=IF(?,UTC_TIMESTAMP(6),NULL) WHERE id=?",[status,JSON.stringify(result),terminal,row.id]);
 }catch(error){
  const failed=Number(row.attempts)>=4;
  await db.query("UPDATE database_backup_verifications SET status=?,attempts=attempts+1,result=?,finished_at=IF(?,UTC_TIMESTAMP(6),NULL) WHERE id=?",[failed?'failed':'running',JSON.stringify({status:failed?'failed':'waiting_remote',error:'RESTORE_REMOTE_UNAVAILABLE'}),failed,row.id]);
 }
 return true;
}
export async function verificationSummary(){
 await ensureVerificationSchema();
 const [options,policy]=await Promise.all([backupOptions(),backupPolicy()]);
 const [rows]:any=await db.query(`WITH good AS (
 SELECT j.*,ROW_NUMBER() OVER(PARTITION BY kind,server_id,database_name ORDER BY created_at DESC,id DESC) rn
 FROM database_backup_jobs j WHERE status='succeeded' AND removed_at IS NULL),
 checks AS (SELECT v.*,ROW_NUMBER() OVER(PARTITION BY backup_id ORDER BY created_at DESC,id DESC) rn FROM database_backup_verifications v)
 SELECT g.id,g.kind,g.tenant_id,g.server_id,g.database_name,g.name,g.metadata,
 DATE_FORMAT(COALESCE(g.finished_at,g.created_at),'%Y-%m-%dT%H:%i:%sZ') created_at,
 c.status verification_status,c.result verification_result,DATE_FORMAT(c.finished_at,'%Y-%m-%dT%H:%i:%sZ') verified_at
 FROM good g LEFT JOIN checks c ON c.backup_id=g.id AND c.rn=1 WHERE g.rn=1`);
 const targets:any[]=options.networks.map((n:any)=>({kind:'tenant',serverId:Number(n.serverId),database:n.databaseName,name:n.name,tenantId:Number(n.id)}));
 if(policy.centralServerId){const {env}=await import('../config/env');targets.unshift({kind:'central',serverId:policy.centralServerId,database:env.DB_NAME,name:'القاعدة المركزية',tenantId:null});}
 const now=Date.now();
 return {timezone:policy.timezone,enabled:policy.enabled,serverNow:new Date(now).toISOString(),items:targets.map(target=>{
  const row=rows.find((r:any)=>r.kind===target.kind&&Number(r.server_id)===target.serverId&&r.database_name===target.database);
  const metadata=parse<any>(row?.metadata,{}),due=row&&policy.enabled?nextRun(policy,new Date(row.created_at)):null;
  return {...target,backupId:row?.id??null,lastSuccessAt:row?.created_at??null,bytes:metadata.bytes??null,ageHours:row?Math.max(0,Math.floor((now-Date.parse(row.created_at))/3600000)):null,
   overdue:policy.enabled&&Boolean(row)&&Date.parse(due!)<now,dueAt:due,verification:row?.verification_status??'none',verificationResult:parse(row?.verification_result,{}),verifiedAt:row?.verified_at??null};
 })};
}

async function versionAnchor(id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new BackupError(422,'معرّف النسخة غير صالح.');
 const [rows]:any=await db.query('SELECT kind,server_id,database_name FROM database_backup_jobs WHERE id=?',[id]);
 if(!rows[0])throw new BackupError(404,'النسخة غير موجودة.');
 return rows[0];
}
export async function restorationVersions(id:string,page=1){
 await ensureBackupSchema();await ensureVerificationSchema();
 const [anchor,policy]=await Promise.all([versionAnchor(id),backupPolicy()]);
 const scope=[anchor.kind,anchor.server_id,anchor.database_name];
 const [totals]:any=await db.query("SELECT COUNT(*) total FROM database_backup_jobs WHERE kind=? AND server_id=? AND database_name=? AND status='succeeded' AND removed_at IS NULL",scope);
 const [passed]:any=await db.query("SELECT b.id FROM database_backup_jobs b JOIN database_backup_verifications v ON v.backup_id=b.id WHERE b.kind=? AND b.server_id=? AND b.database_name=? AND b.status='succeeded' AND b.removed_at IS NULL AND v.status='succeeded' ORDER BY v.finished_at DESC,v.id DESC LIMIT 1",scope);
 const [latest]:any=await db.query("SELECT id FROM database_backup_jobs WHERE kind=? AND server_id=? AND database_name=? AND status='succeeded' AND removed_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1",scope);
 const [rows]:any=await db.query(`WITH available AS (
 SELECT b.* FROM database_backup_jobs b WHERE kind=? AND server_id=? AND database_name=? AND status='succeeded' AND removed_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?),
 checks AS (SELECT v.*,ROW_NUMBER() OVER(PARTITION BY backup_id ORDER BY created_at DESC,id DESC) rn FROM database_backup_verifications v JOIN available a ON a.id=v.backup_id)
 SELECT a.*,DATE_FORMAT(a.created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,DATE_FORMAT(a.finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at,c.status verification_status,DATE_FORMAT(c.finished_at,'%Y-%m-%dT%H:%i:%sZ') verified_at
 FROM available a LEFT JOIN checks c ON c.backup_id=a.id AND c.rn=1 ORDER BY a.created_at DESC,a.id DESC`,[...scope,(page-1)*50]);
 const items=rows.map((r:any)=>{const metadata=parse<any>(r.metadata,{});return {id:r.id,name:r.name,database_name:r.database_name,batchId:r.batch_key,createdAt:metadata.startedAt??r.created_at,finishedAt:r.finished_at,bytes:metadata.bytes??0,filename:backupFilename({...r,metadata},policy.timezone),timezone:metadata.timezone??policy.timezone,verification:r.verification_status??'none',verifiedAt:r.verified_at,isLatest:r.id===latest[0]?.id,isLastPassed:r.id===passed[0]?.id};});
 return {items,total:Number(totals[0].total),page,timezone:policy.timezone,latestId:latest[0]?.id??null,lastPassedId:passed[0]?.id??null};
}
export async function restorationChecks(id:string,page=1){
 await ensureVerificationSchema();
 const [backup,policy]=await Promise.all([backupForDownload(id),backupPolicy()]);
 const [totals]:any=await db.query('SELECT COUNT(*) total FROM database_backup_verifications WHERE backup_id=?',[id]);
 const [rows]:any=await db.query(`SELECT id,status,result,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%sZ') started_at,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at,TIMESTAMPDIFF(SECOND,started_at,COALESCE(finished_at,UTC_TIMESTAMP(6))) duration_seconds FROM database_backup_verifications WHERE backup_id=? ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET ?`,[id,(page-1)*10]);
 const [current]:any=page===1?[rows]:await db.query(`SELECT id,status,result,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%sZ') started_at,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at,TIMESTAMPDIFF(SECOND,started_at,COALESCE(finished_at,UTC_TIMESTAMP(6))) duration_seconds FROM database_backup_verifications WHERE backup_id=? ORDER BY created_at DESC,id DESC LIMIT 1`,[id]);
 const safe=(row:any)=>row?{id:row.id,status:row.status,result:parse(row.result,{}),createdAt:row.created_at,startedAt:row.started_at,finishedAt:row.finished_at,durationSeconds:row.duration_seconds===null?null:Number(row.duration_seconds)}:null;
 return {version:{id:backup.id,name:backup.name,database_name:backup.database_name,batchId:(backup as any).batch_key,createdAt:backup.metadata.startedAt??new Date(backup.created_at).toISOString(),finishedAt:backup.finished_at,bytes:backup.metadata.bytes??0,filename:backupFilename(backup,policy.timezone),timezone:backup.metadata.timezone??policy.timezone,verification:current[0]?.status??"none",verifiedAt:current[0]?.finished_at??null},backupId:id,filename:backupFilename(backup,policy.timezone),timezone:backup.metadata.timezone??policy.timezone,serverNow:new Date().toISOString(),latest:safe(current[0]),items:rows.map(safe),total:Number(totals[0].total),page};
}
