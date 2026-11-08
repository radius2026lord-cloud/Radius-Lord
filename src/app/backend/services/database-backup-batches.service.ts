import {backupFilename} from './database-backup-filename.service';
import {createHash,randomUUID} from 'crypto';
import {db} from '../config/db';
import {ensureBackupSchema,backupPolicy,backupOptions,parse,BackupError} from './database-backups.service';
import {cloudPublic,cloudDestinationsReady} from './database-backup-cloud.service';
import {writeMasterAdminAuditLog} from './audit.service';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';

export type BackupBatchFilters={q?:string;status?:string;kind?:string;trigger?:string;date?:string;from?:string;to?:string;timeFrom?:string;timeTo?:string;server?:string;network?:string;destination?:string;delivery?:string;sort?:string};
const latest=`WITH ranked AS (SELECT j.*,ROW_NUMBER() OVER(PARTITION BY batch_key,kind,server_id,database_name ORDER BY created_at DESC,id DESC) target_rank FROM database_backup_jobs j), latest AS (SELECT * FROM ranked WHERE target_rank=1), batch_summary AS (
 SELECT batch_key,MIN(created_at) latest_created_at,
 (SELECT MIN(original.created_at) FROM database_backup_jobs original WHERE original.batch_key=l.batch_key) created_at,
 MAX(finished_at) finished_at,COUNT(*) total,SUM(status='succeeded') succeeded,SUM(status='failed') failed,
 SUM(status IN ('running','waiting_remote')) running,SUM(status='queued') queued,
 SUM(delivery_state='attention') attention,SUM(status='succeeded' AND delivery_state IN ('pending','running')) uploading,SUM(COALESCE(JSON_EXTRACT(metadata,'$.bytes'),0)) bytes,
 CASE WHEN SUM(status IN ('running','waiting_remote'))>0 THEN 'running'
 WHEN SUM(status='queued')>0 THEN 'queued'
 WHEN SUM(status='succeeded')=COUNT(*) THEN 'succeeded'
 WHEN SUM(status='failed')=COUNT(*) THEN 'failed' ELSE 'mixed' END status,
 MIN(trigger_type) trigger_type
 FROM latest l GROUP BY batch_key)`;
const latestForBatch=latest.replace("FROM database_backup_jobs j)","FROM database_backup_jobs j WHERE batch_key=?)");
function safe(row:any){
 const deliveries=parse(row.deliveries,{});
 return {...row,metadata:parse(row.metadata,{}),destinations:parse(row.destinations,[]),
  deliveries:Object.fromEntries(Object.entries(deliveries).map(([key,value]:[string,any])=>{const {sessionEncrypted,...publicValue}=value;return [key,publicValue];}))};
}
function localDay(date:Date,timezone:string){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function shift(day:string,amount:number){const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function instant(day:string,time:string,timezone:string,end=false){
 const target=Date.parse(day+'T'+time+':00Z');
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const local=(timestamp:number)=>{const p=Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));return Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z');};
 let guess=target;
 for(let index=0;index<5;index++){const delta=target-local(guess);if(!delta)break;guess+=delta;}
 const candidates=[guess-7200000,guess-3600000,guess,guess+3600000,guess+7200000].filter(t=>local(t)===target);
 if(!candidates.length)throw new BackupError(422,'الوقت المختار غير موجود بسبب تغيير التوقيت الصيفي. اختر وقتًا آخر.');
 return new Date(end?Math.max(...candidates):Math.min(...candidates)).toISOString().slice(0,19).replace('T',' ');
}
function datePredicate(filters:BackupBatchFilters,timezone:string){
 const today=localDay(new Date(),timezone),preset=filters.date||'all',hasTime=Boolean(filters.timeFrom||filters.timeTo);
 let from='',to='';
 if(preset==='today'||preset==='all'&&hasTime)from=to=today;
 else if(preset==='yesterday')from=to=shift(today,-1);
 else if(preset==='week'){from=shift(today,-6);to=today;}
 else if(preset==='month'){from=today.slice(0,8)+'01';to=today;}
 else if(preset==='custom'){from=String(filters.from??'');to=String(filters.to??'');if(!validDate(from)||!validDate(to)||from>to)throw new BackupError(422,'حدد فترة تاريخ صحيحة.');}
 else if(preset!=='all')throw new BackupError(422,'فترة التاريخ غير صالحة.');
 if(!from)return {sql:'',params:[] as string[]};
 if(!hasTime)return {sql:'g.created_at>=? AND g.created_at<?',params:[instant(from,'00:00',timezone),instant(shift(to,1),'00:00',timezone,true)]};
 const start=filters.timeFrom||'00:00',finish=filters.timeTo||'23:59';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(finish))throw new BackupError(422,'حدد الوقت بصيغة ساعة ودقيقة.');
 const days=(Date.parse(to)-Date.parse(from))/86400000+1;
 if(days>366)throw new BackupError(422,'تصفية ساعات اليوم تدعم فترة تصل إلى سنة. قلّل فترة التاريخ.');
 const clauses:string[]=[],params:string[]=[];
 for(let day=from;day<=to;day=shift(day,1)){
  const endDay=finish<start?shift(day,1):day;
  const endMinute=new Date(Date.parse(endDay+'T'+finish+':00Z')+60000).toISOString();
  clauses.push('(g.created_at>=? AND g.created_at<?)');
  params.push(instant(day,start,timezone),instant(endMinute.slice(0,10),endMinute.slice(11,16),timezone,true));
 }
 return {sql:'('+clauses.join(' OR ')+')',params};
}
function childPredicate(f:BackupBatchFilters){
 const clauses:string[]=[],params:any[]=[];
 const q=String(f.q??'').trim().slice(0,100);
 if(q){clauses.push('(LOCATE(?,j.name)>0 OR LOCATE(?,j.database_name)>0 OR LOCATE(?,j.id)>0 OR LOCATE(?,j.batch_key)>0)');params.push(q,q,q,q);}
 if(['central','tenant'].includes(f.kind??'')){clauses.push('j.kind=?');params.push(f.kind);}
 for(const [value,column] of [[f.server,'server_id'],[f.network,'tenant_id']])if(value&&value!=='all'){
  const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new BackupError(422,'معرّف التصفية غير صالح.');
  clauses.push('j.'+column+'=?');params.push(id);
 }
 const destination=f.destination??'all',delivery=f.delivery??'all';
 if(['telegram','drive'].includes(destination)){
  clauses.push('JSON_CONTAINS(j.destinations,JSON_QUOTE(?))');params.push(destination);
 }else if(destination==='local')clauses.push("j.status='succeeded' AND j.removed_at IS NULL");
 if(['pending','uploading','succeeded','failed','unknown'].includes(delivery)){
  const destinations=['telegram','drive'].includes(destination)?[destination]:['telegram','drive'];
  clauses.push('('+destinations.map(d=>{params.push(delivery);return "(JSON_CONTAINS(j.destinations,JSON_QUOTE('"+d+"')) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.deliveries,'$."+d+".status')),'pending')=?)";}).join(' OR ')+')');
 }
 return {sql:clauses.length?clauses.join(' AND '):'1=1',params};
}
export async function listBackupBatches(page=1,filters:BackupBatchFilters={}){
 await ensureBackupSchema();
 const [policy,options,cloud]=await Promise.all([backupPolicy(),backupOptions(),cloudPublic()]);
 const child=childPredicate(filters),date=datePredicate(filters,policy.timezone);
 const clauses=['EXISTS(SELECT 1 FROM latest j WHERE j.batch_key=g.batch_key AND '+child.sql+')'],params:any[]=[...child.params];
 if(date.sql){clauses.push(date.sql);params.push(...date.params);}
 if(['manual','scheduled'].includes(filters.trigger??'')){clauses.push('g.trigger_type=?');params.push(filters.trigger);}
 const baseWhere=clauses.join(' AND ');
 const [counts]:any=await db.query(latest+' SELECT status,COUNT(*) count,SUM(attention>0) attention FROM batch_summary g WHERE '+baseWhere+' GROUP BY status',params);
 if(filters.status==='attention')clauses.push('g.attention>0');
 else if(['queued','running','succeeded','mixed','failed'].includes(filters.status??'')){clauses.push('g.status=?');params.push(filters.status);}
 const where=clauses.join(' AND ');
 const total=filters.status==='attention'?counts.reduce((n:number,r:any)=>n+Number(r.attention??0),0):['queued','running','succeeded','mixed','failed'].includes(filters.status??'')?Number(counts.find((r:any)=>r.status===filters.status)?.count??0):counts.reduce((n:number,r:any)=>n+Number(r.count),0);
 const [rows]:any=await db.query(latest+" SELECT g.*,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_iso,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_iso FROM batch_summary g WHERE "+where+' ORDER BY g.created_at '+(filters.sort==='oldest'?'ASC':'DESC')+',g.batch_key LIMIT 20 OFFSET ?',[...params,(page-1)*20]);
 return {policy,options,cloud,counts,total,page,timezone:policy.timezone,revision:Date.now(),batches:rows.map((r:any)=>({...r,created_at:r.created_iso,finished_at:Number(r.running)+Number(r.queued)>0?null:r.finished_iso,total:Number(r.total),succeeded:Number(r.succeeded),failed:Number(r.failed),running:Number(r.running),queued:Number(r.queued),attention:Number(r.attention),bytes:Number(r.bytes)}))};
}
export async function backupBatchDetails(batchKey:string,page=1,filters:BackupBatchFilters={}){
 await ensureBackupSchema();
 if(!batchKey||batchKey.length>128)throw new BackupError(422,'رقم الحزمة غير صالح.');
 const policy=await backupPolicy();
 const {ensureVerificationSchema}=await import("./database-backup-verification.service");await ensureVerificationSchema();
 const match=childPredicate(filters);
 const [totals]:any=await db.query(latestForBatch+' SELECT COUNT(*) total FROM latest WHERE batch_key=?',[batchKey,batchKey]);
 const [rows]:any=await db.query(latestForBatch+` SELECT j.*,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at,DATE_FORMAT(removed_at,'%Y-%m-%dT%H:%i:%sZ') removed_at,(`+match.sql+`) matched FROM latest j WHERE batch_key=? ORDER BY matched DESC,j.name,j.database_name LIMIT 50 OFFSET ?`,[batchKey,...match.params,batchKey,(page-1)*50]);
 let history:any[]=[];
 if(rows.length){const [attempts]:any=await db.query(`WITH attempts AS (SELECT h.*,ROW_NUMBER() OVER(PARTITION BY kind,server_id,database_name ORDER BY created_at DESC,id DESC) history_rank FROM database_backup_jobs h WHERE batch_key=? AND (kind,server_id,database_name) IN (${rows.map(()=>'(?,?,?)').join(',')}))
 SELECT id,kind,server_id,database_name,status,last_error,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at FROM attempts WHERE history_rank<=20`,[batchKey,...rows.flatMap((r:any)=>[r.kind,r.server_id,r.database_name])]);history=attempts;}
 let checks:any[]=[];
 if(rows.length){const [values]:any=await db.query("WITH ranked AS (SELECT v.*,ROW_NUMBER() OVER(PARTITION BY backup_id ORDER BY created_at DESC,id DESC) rn FROM database_backup_verifications v WHERE backup_id IN ("+rows.map(()=>'?').join(',')+")) SELECT backup_id,status,result,DATE_FORMAT(finished_at,'%Y-%m-%dT%H:%i:%sZ') finished_at FROM ranked WHERE rn=1",rows.map((r:any)=>r.id));checks=values;}
 return {items:rows.map((r:any)=>({...safe(r),verification:(()=>{const value=checks.find(v=>v.backup_id===r.id);return value?{status:value.status,result:parse(value.result,{}),finishedAt:value.finished_at}:null;})(),filename:backupFilename({...r,metadata:parse(r.metadata,{})},policy.timezone),matched:Boolean(r.matched),history:history.filter(h=>h.kind===r.kind&&Number(h.server_id)===Number(r.server_id)&&h.database_name===r.database_name)})),total:Number(totals[0].total),page};
}
export async function retryBackupBatch(batchKey:string,requestId:string,req:AuthenticatedRequest,jobId?:string){
 await ensureBackupSchema();
 if(!/^[a-f0-9-]{36}$/.test(requestId)||!batchKey||batchKey.length>128)throw new BackupError(422,'طلب إعادة المحاولة غير صالح.');
 const connection=await db.pool.getConnection();
 const lockName='backup-retry:'+createHash('sha256').update(batchKey).digest('hex').slice(0,40);
 let locked=false;
 try{
  const [lock]:any=await connection.query('SELECT GET_LOCK(?,0) acquired',[lockName]);locked=Boolean(lock[0].acquired);
  if(!locked)throw new BackupError(409,'تجري إعادة المحاولة لهذه الحزمة. حدّث السجل.');
  const [existing]:any=await connection.query("SELECT COUNT(*) count FROM database_backup_jobs WHERE batch_key=? AND request_key LIKE ?",[batchKey,'retry:'+requestId+':%']);
  if(Number(existing[0].count))return {batchId:batchKey,count:Number(existing[0].count)};
  const [rows]:any=await connection.query(latestForBatch+" SELECT * FROM latest WHERE batch_key=? AND status='failed'"+(jobId?' AND id=?':''),jobId?[batchKey,batchKey,jobId]:[batchKey,batchKey]);
  if(!rows.length)throw new BackupError(409,'لا توجد قواعد متعذّرة قابلة لإعادة المحاولة.');
  const policy=await backupPolicy();
  for(const row of rows)await cloudDestinationsReady(parse(row.destinations,[]));
  await connection.beginTransaction();
  for(const row of rows)await connection.query(`INSERT INTO database_backup_jobs(id,batch_key,request_key,server_id,database_name,name,tenant_id,kind,trigger_type,actor_id,destinations,deliveries,metadata,created_at,next_attempt_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,'{}',?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))`,[randomUUID(),batchKey,'retry:'+requestId+':'+row.id,row.server_id,row.database_name,row.name,row.tenant_id,row.kind,row.trigger_type,req.auth!.accountId,JSON.stringify(parse(row.destinations,[])),JSON.stringify({timezone:parse<any>(row.metadata,{}).timezone??policy.timezone})]);
  await writeMasterAdminAuditLog(req,req.auth!.accountId,{actionCode:'UPDATE',entityTypeCode:'DATABASE_SERVER',description:'إعادة محاولة قواعد متعذّرة داخل حزمة النسخ الأصلية',metadata:{operation:'database_backup_retry',batchId:batchKey,count:rows.length}},connection);
  await connection.commit();return {batchId:batchKey,count:rows.length};
 }catch(error){await connection.rollback().catch(()=>{});throw error;}
 finally{if(locked)await connection.query('SELECT RELEASE_LOCK(?)',[lockName]).catch(()=>{});connection.release();}
}
